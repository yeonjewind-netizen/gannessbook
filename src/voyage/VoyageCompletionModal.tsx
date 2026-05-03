// TODO: [Phase 2] 이 고래 도약 및 회고 로직은 추후 '목표 달성 전용 페이지' 라우팅이 구현되면 그쪽으로 이동시킬 것.

import { useEffect, useMemo, useState } from 'react'
import type { LogEntry } from './types'
import { TAG_LABEL } from './constants'

type CelebrationStep = 'intro' | 'whale' | 'panorama' | 'retrospective'

type Props = {
  open: boolean
  entries: LogEntry[]
  onComplete: (retrospective: string) => void
}

export function VoyageCompletionModal({
  open,
  entries,
  onComplete,
}: Props) {
  const [celebrationStep, setCelebrationStep] =
    useState<CelebrationStep | null>(null)
  const [finalDraft, setFinalDraft] = useState('')

  useEffect(() => {
    if (!open) {
      setCelebrationStep(null)
      setFinalDraft('')
      return
    }
    setFinalDraft('')
    setCelebrationStep('intro')
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || celebrationStep !== 'intro') return
    const t = window.setTimeout(() => setCelebrationStep('whale'), 520)
    return () => clearTimeout(t)
  }, [open, celebrationStep])

  useEffect(() => {
    if (!open || celebrationStep !== 'whale') return
    const t = window.setTimeout(() => setCelebrationStep('panorama'), 2400)
    return () => clearTimeout(t)
  }, [open, celebrationStep])

  useEffect(() => {
    if (!open || celebrationStep !== 'panorama') return
    const duration = entries.length === 0 ? 1600 : 10400
    const t = window.setTimeout(
      () => setCelebrationStep('retrospective'),
      duration,
    )
    return () => clearTimeout(t)
  }, [open, celebrationStep, entries.length])

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [entries],
  )

  const panoramaPairs =
    sorted.length > 0 ? [...sorted, ...sorted] : ([] as LogEntry[])

  function handleFinalRetrospectiveSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = finalDraft.trim()
    if (!text) return
    onComplete(text)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        celebrationStep === 'retrospective'
          ? '마지막 회고'
          : celebrationStep === 'panorama'
            ? '항해 일지 파노라마'
            : '항해 완료 축하'
      }
      aria-labelledby={
        celebrationStep === 'retrospective'
          ? 'final-retro-heading'
          : celebrationStep === 'whale'
            ? 'celebration-live'
            : undefined
      }
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900 animate-modal-fade-in"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        {(celebrationStep === 'intro' || celebrationStep === 'whale') && (
          <div
            className="flex flex-col items-center justify-end"
            aria-hidden={celebrationStep === 'intro'}
          >
            <span
              id="celebration-live"
              className={`select-none text-[clamp(4rem,18vw,10rem)] leading-none drop-shadow-[0_0_40px_rgba(56,189,248,0.35)] ${
                celebrationStep === 'whale'
                  ? 'animate-whale-breach'
                  : 'invisible translate-y-full'
              }`}
            >
              🐋
            </span>
            <p className="sr-only">항해 완료 축하, 고래 도약 애니메이션</p>
          </div>
        )}

        {celebrationStep === 'panorama' && (
          <div className="flex w-full max-w-4xl flex-col items-center gap-6">
            <p className="text-center text-sm font-medium text-slate-400">
              지나온 시행착오들이 파도처럼 스쳐 지나갑니다
            </p>
            <div className="relative h-40 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/50">
              {entries.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-slate-500">
                  아직 남겨 둔 일지가 없습니다. 그래도 이 항해는 소중했어요.
                </div>
              ) : (
                <div className="animate-panorama-strip flex w-max gap-3 px-3 py-6">
                  {panoramaPairs.map((entry, i) => (
                    <div
                      key={`${entry.id}-${i}`}
                      className="max-w-[min(100vw-2rem,22rem)] shrink-0 rounded-xl border border-sky-400/25 bg-slate-800/90 px-4 py-3 text-left shadow-lg"
                    >
                      <div className="mb-2 text-xs font-semibold text-sky-300">
                        {TAG_LABEL[entry.tag]}
                      </div>
                      <p className="line-clamp-4 text-sm leading-relaxed text-slate-200">
                        {entry.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {celebrationStep === 'retrospective' && (
          <div className="w-full max-w-md animate-modal-fade-in space-y-6 text-center">
            <h3
              id="final-retro-heading"
              className="text-lg font-semibold leading-snug text-slate-100 sm:text-xl"
            >
              가장 포기하고 싶었던 그날의 나에게, 지금 어떤 말을 해주고
              싶나요?
            </h3>
            <form
              onSubmit={handleFinalRetrospectiveSubmit}
              className="space-y-4 text-left"
            >
              <label htmlFor="final-retro" className="sr-only">
                마지막 회고
              </label>
              <textarea
                id="final-retro"
                value={finalDraft}
                onChange={(e) => setFinalDraft(e.target.value)}
                rows={6}
                placeholder="그날의 나에게 건네는 한 마디…"
                className="w-full resize-y rounded-xl border border-slate-600 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              <button
                type="submit"
                disabled={!finalDraft.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-sky-500 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                영감의 이정표 남기기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
