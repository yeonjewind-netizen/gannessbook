import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Anchor, Ship } from 'lucide-react'
import { loadMyVoyage } from '../voyage/myVoyageStorage'
import {
  loadCompletedVoyagesArchive,
  patchCompletedVoyageRetrospective,
} from '../voyage/completedVoyagesArchive'
import { loadVoyageMeta, saveVoyageMeta } from '../voyage/metaStorage'
import {
  aggregateDefaultCheersForDiaryIds,
  DEFAULT_CHEER_EMOJIS,
  loadCheerReactions,
} from '../voyage/cheerReactionsStorage'
import type { LogEntry } from '../voyage/types'
import { TAG_LABEL } from '../voyage/constants'
import { formatShortDate } from '../voyage/dateFormat'

type Phase = 'whale' | 'cheers' | 'reflect'

type CheerState = ReturnType<typeof aggregateDefaultCheersForDiaryIds> & {
  diaryChron: LogEntry[]
}

function buildCheerState(): CheerState {
  const meta = loadVoyageMeta()
  const at = meta.completedAt
  if (!at) {
    return {
      total: 0,
      byEmoji: {},
      ranked: [],
      bestEmoji: null,
      diaryChron: [],
    }
  }
  const row = loadCompletedVoyagesArchive().find((v) => v.completedAt === at)
  const diaryChron = [...(row?.diaryEntries ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const ids = diaryChron.map((e) => e.id)
  const base = aggregateDefaultCheersForDiaryIds(ids, loadCheerReactions())
  return { ...base, diaryChron }
}

function CheerWaveParticles({
  stats,
}: {
  stats: Pick<
    CheerState,
    'ranked' | 'total'
  >
}) {
  const particles = useMemo(() => {
    const pool: string[] = []
    if (stats.total <= 0) {
      for (let i = 0; i < 24; i++) {
        pool.push(
          DEFAULT_CHEER_EMOJIS[i % DEFAULT_CHEER_EMOJIS.length] ?? '❤️',
        )
      }
    } else {
      for (const { emoji, count } of stats.ranked) {
        const cap = Math.min(16, Math.max(3, Math.ceil(count / 2)))
        for (let j = 0; j < cap; j++) pool.push(emoji)
      }
      while (pool.length < 28) {
        const pick =
          stats.ranked[0]?.emoji ??
          DEFAULT_CHEER_EMOJIS[pool.length % DEFAULT_CHEER_EMOJIS.length]
        pool.push(pick)
      }
    }
    const out: {
      id: number
      emoji: string
      leftPct: number
      dur: number
      delay: number
      scale: number
      drift: number
    }[] = []
    for (let i = 0; i < 42; i++) {
      const emoji = pool[Math.floor(Math.random() * pool.length)] ?? '❤️'
      out.push({
        id: i,
        emoji,
        leftPct: 6 + Math.random() * 88,
        dur: 3.8 + Math.random() * 2.8,
        delay: Math.random() * 2.2,
        scale: 0.75 + Math.random() * 0.55,
        drift: (Math.random() - 0.5) * 36,
      })
    }
    return out
  }, [stats.total, stats.ranked])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="animate-cheer-rise absolute bottom-0 text-[clamp(1.1rem,4vw,1.85rem)] will-change-transform"
          style={{
            left: `${p.leftPct}%`,
            ['--cheer-dur' as string]: `${p.dur}s`,
            ['--cheer-delay' as string]: `${p.delay}s`,
            ['--cheer-scale' as string]: String(p.scale),
            ['--cheer-drift' as string]: `${p.drift}px`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

/**
 * 목표 달성 전용 페이지 — 전역 고래 도약 연출 → 응원의 파도 → 마지막 회고.
 */
export default function AchievementPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('whale')
  const [draft, setDraft] = useState('')
  const voyageProfile = loadMyVoyage()
  const cheerState = useMemo(() => buildCheerState(), [])

  useEffect(() => {
    const meta = loadVoyageMeta()
    if (!meta.isCompleted) {
      navigate('/', { replace: true })
      return
    }
    if (meta.finalRetrospective?.trim()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (phase !== 'whale') return
    const t = window.setTimeout(() => setPhase('cheers'), 2600)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'cheers') return
    const t = window.setTimeout(() => setPhase('reflect'), 4500)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'reflect') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [phase])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const meta = loadVoyageMeta()
    const completedAt = meta.completedAt ?? new Date().toISOString()
    const next = {
      ...meta,
      finalRetrospective: text,
      completedAt,
    }
    saveVoyageMeta(next)
    patchCompletedVoyageRetrospective(completedAt, text)
    navigate('/', { replace: true })
  }

  return (
    <div className="relative min-h-svh bg-slate-950 pb-28">
      {phase === 'whale' && (
        <div className="fixed inset-0 z-[100] flex min-h-svh flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black animate-modal-fade-in">
          <p className="mb-6 text-center text-sm font-medium text-sky-200/90">
            항해를 완료했습니다
          </p>
          <div className="flex flex-col items-center justify-end">
            <span
              className="select-none text-[clamp(4rem,22vw,12rem)] leading-none drop-shadow-[0_0_48px_rgba(56,189,248,0.45)] animate-whale-breach"
              aria-hidden
            >
              🐋
            </span>
            <p className="sr-only">고래 도약 축하 애니메이션</p>
          </div>
          <p className="mt-10 px-6 text-center text-xs text-slate-500">
            잠시 후 응원의 파도가 밀려옵니다…
          </p>
        </div>
      )}

      {phase === 'cheers' && (
        <div className="fixed inset-0 z-[100] flex min-h-svh flex-col justify-end bg-gradient-to-t from-sky-950/95 via-slate-950 to-slate-950 pb-28 pt-10 animate-modal-fade-in">
          <CheerWaveParticles
            stats={{
              total: cheerState.total,
              ranked: cheerState.ranked,
            }}
          />
          <div className="relative z-[2] mx-auto w-full max-w-md px-6 text-center">
            <p className="text-base font-medium leading-relaxed text-sky-100/95">
              선원님, 이번 항해 동안 총{' '}
              <strong className="text-3xl text-amber-300 tabular-nums">
                {cheerState.total}
              </strong>
              번의 따뜻한 응원을 받았습니다!
            </p>
            {cheerState.total === 0 && (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                아직 공동의 바다에서 모인 리액션이 없어요. 다음 항해에서는 친구들의
                이모지 응원을 모아 올 수 있어요.
              </p>
            )}
            <p className="mt-6 text-[11px] text-slate-600">
              잠시 후 마지막 회고로 넘어갑니다…
            </p>
          </div>
        </div>
      )}

      {phase === 'reflect' && (
        <main className="relative mx-auto max-w-lg px-4 pb-8 pt-12 animate-modal-fade-in sm:px-6">
          <header className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-100 shadow-sm backdrop-blur-sm">
              <Anchor className="h-3.5 w-3.5" aria-hidden />
              영감의 이정표
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {voyageProfile.goalName.trim()
                ? voyageProfile.goalName
                : '나의 항해'}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              이 항해의 마지막 한 마디를 남겨 주세요.
            </p>
          </header>

          <section
            className="mb-8 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-xl shadow-sky-950/40 backdrop-blur-md"
            aria-labelledby="cheer-wave-heading"
          >
            <h2
              id="cheer-wave-heading"
              className="text-sm font-bold tracking-wide text-sky-200"
            >
              응원의 파도 · 도착 항구
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              이번 목표에 묶인 일지마다 쌓인 친구들의 리액션(❤️ 🤣 🫡 😥 😝)을
              모았습니다.
            </p>

            <div className="mt-5 flex items-end gap-2 overflow-x-auto pb-1 pt-2">
              {cheerState.diaryChron.map((e) => (
                <div
                  key={e.id}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className="line-clamp-2 min-h-[2rem] text-[10px] font-medium leading-tight text-slate-500"
                    title={TAG_LABEL[e.tag]}
                  >
                    {TAG_LABEL[e.tag]}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                  <time
                    className="text-[9px] text-slate-600"
                    dateTime={e.createdAt}
                  >
                    {formatShortDate(e.createdAt)}
                  </time>
                </div>
              ))}
              <div className="flex min-w-[9.5rem] shrink-0 flex-col items-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/25 via-slate-900/80 to-sky-900/50 px-3 py-4 shadow-inner shadow-black/30">
                <Ship className="h-6 w-6 text-amber-200/90" aria-hidden />
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/90">
                  도착
                </p>
                {cheerState.bestEmoji ? (
                  <span
                    className="mt-2 text-5xl leading-none drop-shadow-lg"
                    aria-label="가장 많이 받은 응원"
                  >
                    {cheerState.bestEmoji}
                  </span>
                ) : (
                  <span className="mt-2 text-2xl opacity-40" aria-hidden>
                    ⚓
                  </span>
                )}
                <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
                  베스트 응원
                </p>
                {cheerState.ranked.length > 0 ? (
                  <div className="mt-2 flex max-w-full flex-wrap justify-center gap-1">
                    {cheerState.ranked.map((x) => (
                      <span
                        key={x.emoji}
                        className="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-slate-100"
                      >
                        {x.emoji}
                        <span className="tabular-nums"> {x.count}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-center text-[10px] text-slate-600">
                    아직 모인 응원이 없어요
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40 backdrop-blur-md">
            <h2 className="text-lg font-semibold leading-snug text-slate-100 sm:text-xl">
              가장 포기하고 싶었던 그날의 나에게, 지금 어떤 말을 해주고 싶나요?
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label htmlFor="achievement-retro" className="sr-only">
                마지막 회고
              </label>
              <textarea
                id="achievement-retro"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                placeholder="그날의 나에게 건네는 한 마디…"
                className="w-full resize-y rounded-xl border border-slate-600 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-sky-500 py-3.5 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                영감의 이정표 남기기
              </button>
            </form>
          </section>
        </main>
      )}
    </div>
  )
}
