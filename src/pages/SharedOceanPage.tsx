import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { MoodTag } from '../voyage/types'
import { TAG_LABEL } from '../voyage/constants'
import { formatShortDate } from '../voyage/dateFormat'
import { loadMyVoyage, saveMyVoyage } from '../voyage/myVoyageStorage'
import { bumpUserLogInspiredCountIfExists } from '../voyage/bumpUserLogInspired'
import {
  incrementSharedFeedInspiredDelta,
  loadSharedInspiredDeltas,
} from '../voyage/sharedFeedInspiredStorage'
import {
  loadCheerReactions,
  saveCheerReactions,
  DEFAULT_CHEER_EMOJIS,
} from '../voyage/cheerReactionsStorage'
import { deleteVoyageEntry, loadVoyageEntries } from '../voyage/voyageEntries'
import {
  appendBatonInspiredOwnerNotification,
  maybeAppendCheerForMyDiary,
} from '../voyage/notificationsStorage'
import { loadProfileApplicantName } from '../voyage/profileApplicantStorage'
import { BumpingCount } from '../components/BumpingCount'
import LighthouseToggleButton from '../components/LighthouseToggleButton'
import {
  loadLighthouses,
  LIGHTHOUSE_UPDATES_EVENT,
  rememberDisplayLabel,
} from '../voyage/lighthouseStorage'
import { getOrCreateUserId } from '../voyage/userIdentity'
import { useAuth } from '../context/AuthContext'

const HIDDEN_SHARED_POSTS_KEY = 'ganness-book:hidden-shared-posts'

function loadHiddenSharedPostIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(HIDDEN_SHARED_POSTS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(
      arr.filter((x): x is string => typeof x === 'string' && x.trim() !== ''),
    )
  } catch {
    return new Set()
  }
}

function saveHiddenSharedPostIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      HIDDEN_SHARED_POSTS_KEY,
      JSON.stringify(Array.from(ids)),
    )
  } catch {
    /* ignore */
  }
}

export type SharedFeedItem = {
  id: string
  /** 등대·피드 필터용 선원 식별자 */
  authorUserId: string
  author: string
  content: string
  tag: MoodTag
  cheers: Record<string, number>
  createdAt: string
  /** 누적 영감(바통) 횟수 — 저장소 델타와 합산해 표시 */
  inspiredCount: number
}

const MOCK_SHARED_FEED: SharedFeedItem[] = [
  {
    id: 'sf-1',
    authorUserId: 'mock-ocean-user-1',
    author: '3학년 선배',
    content:
      '수능 직전까지 동아리 공연 연습을 병행했는데, 밤마다 “이게 맞나” 싶었어요. 그래도 무대 서는 날 후배들 눈빛이 생각나서 버텼습니다.',
    tag: 'wall',
    cheers: { '🫂': 40, '🔥': 35, '⛵': 53 },
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'sf-2',
    authorUserId: 'mock-ocean-user-2',
    author: '동급생 A',
    content:
      '반장 하다가 친구랑 틀어진 적 있어요. 먼저 사과하는 게 패배인 줄 알았는데, 오히려 관계가 더 단단해졌어요.',
    tag: 'direction',
    cheers: { '🫂': 52, '✨': 37 },
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: 'sf-3',
    authorUserId: 'mock-ocean-user-3',
    author: '2학년 재학생',
    content:
      '첫 모의고사에서 목표보다 40점 낮게 나왔을 때 정말 무너졌어요. 그날 저녁에만 울고 다음 날부터는 오답만 정리했습니다.',
    tag: 'wall',
    cheers: { '🔥': 120, '🫂': 88, '⛵': 48 },
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'sf-4',
    authorUserId: 'mock-ocean-user-4',
    author: '졸업생 민서',
    content:
      '논술 준비하다가 원서 전략을 완전히 갈아엎었어요. 부모님께 말씀드리기 무서웠지만, 솔직히 말하니 오히려 응원해 주셨습니다.',
    tag: 'passion',
    cheers: { '⛵': 70, '✨': 65, '🌊': 66 },
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: 'sf-5',
    authorUserId: 'mock-ocean-user-5',
    author: '동급생 B',
    content:
      '체육대회 준비하다 학급 의견이 갈렸어요. 투표로 정했는데 진 쪽이 서운해해서, 따로 다과 타임 가지며 풀었습니다.',
    tag: 'direction',
    cheers: { '🫂': 30, '🔥': 24 },
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: 'sf-6',
    authorUserId: 'mock-ocean-user-6',
    author: '1학년 후배',
    content:
      '새 동아리 들어갔는데 선배들 말투가 차가워 보여서 겁먹었어요. 나중에 알고 보니 그냥 바쁘셨던 거였고, 지금은 편하게 인사해요.',
    tag: 'passion',
    cheers: {},
    inspiredCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
  },
]

type SortMode = 'recent' | 'popular'

type FeedScope = 'all' | 'lighthouses'

type CheerDeltas = Record<string, Record<string, number>>

function sumCheers(c: Record<string, number>): number {
  return Object.values(c).reduce((a, b) => a + b, 0)
}

function mergeCheers(
  base: Record<string, number>,
  deltasForPost: Record<string, number> | undefined,
): Record<string, number> {
  if (!deltasForPost || Object.keys(deltasForPost).length === 0) {
    return { ...base }
  }
  const out = { ...base }
  for (const [emoji, n] of Object.entries(deltasForPost)) {
    out[emoji] = (out[emoji] ?? 0) + n
  }
  return out
}

function sortedEmojiEntries(cheers: Record<string, number>): [string, number][] {
  return Object.entries(cheers).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
}

function voyageDiariesAsFeedItems(): SharedFeedItem[] {
  const uid = getOrCreateUserId()
  const author =
    loadProfileApplicantName().trim() || '나'
  return loadVoyageEntries().map((e) => ({
    id: e.id,
    authorUserId: uid,
    author,
    content: e.body,
    tag: e.tag,
    cheers: {},
    inspiredCount: e.inspiredCount,
    createdAt: e.createdAt,
  }))
}

type CheerPickerProps = {
  postId: string
  open: boolean
  onToggle: () => void
  onPick: (emoji: string) => void
}

function CheerPicker({ postId, open, onToggle, onPick }: CheerPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open, onToggle])

  return (
    <div className="relative flex flex-col items-end" ref={wrapRef}>
      {open && (
        <div
          id={`cheer-picker-${postId}`}
          role="menu"
          className="animate-cheer-bubble-in absolute bottom-full right-0 z-20 mb-2 flex items-center gap-0.5 rounded-[1.25rem] border border-sky-200/90 bg-white/95 px-2.5 py-2 shadow-[0_8px_30px_rgba(14,116,144,0.18)] backdrop-blur-md"
        >
          <span
            className="pointer-events-none absolute -bottom-1.5 right-3.5 h-3 w-3 rotate-45 rounded-[2px] border-b border-r border-sky-200/90 bg-white"
            aria-hidden
          />
          <p className="sr-only">응원 이모지 고르기</p>
          {DEFAULT_CHEER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl transition hover:scale-110 hover:bg-sky-50 active:scale-95"
              onClick={() => onPick(emoji)}
            >
              <span className="leading-none">{emoji}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={`cheer-picker-${postId}`}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-dashed border-sky-300 bg-sky-50/80 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 active:scale-95"
        title="응원 이모지 추가"
      >
        +
      </button>
    </div>
  )
}

export default function SharedOceanPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isAdmin } = useAuth()
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [feedScope, setFeedScope] = useState<FeedScope>('all')
  const [lighthouseTick, setLighthouseTick] = useState(0)
  const [cheerDeltas, setCheerDeltas] = useState<CheerDeltas>(() =>
    loadCheerReactions(),
  )
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() =>
    loadHiddenSharedPostIds(),
  )
  const [feedRefreshTick, setFeedRefreshTick] = useState(0)

  const [batonOpen, setBatonOpen] = useState(false)
  const [batonSource, setBatonSource] = useState<SharedFeedItem | null>(null)
  const [batonGoal, setBatonGoal] = useState('')
  const [inspiredDeltas, setInspiredDeltas] = useState(loadSharedInspiredDeltas)

  useEffect(() => {
    const bump = () => setLighthouseTick((t) => t + 1)
    window.addEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    return () => window.removeEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
  }, [])

  useEffect(() => {
    for (const row of MOCK_SHARED_FEED) {
      rememberDisplayLabel(row.authorUserId, row.author)
    }
  }, [])

  const myUserId = useMemo(() => getOrCreateUserId(), [])

  const sortedFeed = useMemo(() => {
    const mine = voyageDiariesAsFeedItems()
    const baseList =
      feedScope === 'lighthouses'
        ? [...mine, ...MOCK_SHARED_FEED].filter((item) =>
            loadLighthouses().includes(item.authorUserId),
          )
        : [...mine, ...MOCK_SHARED_FEED]
    const list = baseList.filter((item) => !hiddenIds.has(item.id))
    if (sortMode === 'recent') {
      return list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }
    return list.sort((a, b) => {
      const ta = sumCheers(mergeCheers(a.cheers, cheerDeltas[a.id]))
      const tb = sumCheers(mergeCheers(b.cheers, cheerDeltas[b.id]))
      return tb - ta
    })
    // feedRefreshTick: 본인 일지 삭제 후 voyageDiariesAsFeedItems 재계산용
  }, [
    sortMode,
    cheerDeltas,
    feedScope,
    lighthouseTick,
    pathname,
    hiddenIds,
    feedRefreshTick,
  ])

  function handleDeletePost(item: SharedFeedItem) {
    const isOwn = item.authorUserId === myUserId
    if (!isOwn && !isAdmin) return
    if (!window.confirm('정말 이 게시글을 삭제하시겠습니까?')) return

    const isMyVoyageDiary =
      isOwn && loadVoyageEntries().some((e) => e.id === item.id)
    if (isMyVoyageDiary) {
      const ok = deleteVoyageEntry(item.id)
      if (!ok) {
        window.alert('삭제 처리 중 오류가 발생했습니다.')
        return
      }
      setFeedRefreshTick((t) => t + 1)
      return
    }

    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.add(item.id)
      saveHiddenSharedPostIds(next)
      return next
    })
  }

  function addCheer(postId: string, emoji: string) {
    setCheerDeltas((prev) => {
      const next: CheerDeltas = {
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          [emoji]: ((prev[postId] ?? {})[emoji] ?? 0) + 1,
        },
      }
      saveCheerReactions(next)
      return next
    })
    maybeAppendCheerForMyDiary(postId)
  }

  function handleBadgeClick(postId: string, emoji: string) {
    addCheer(postId, emoji)
  }

  function handlePickFromMenu(postId: string, emoji: string) {
    addCheer(postId, emoji)
    setPickerOpenFor(null)
  }

  useEffect(() => {
    if (!batonOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [batonOpen])

  function openBatonModal(item: SharedFeedItem) {
    setBatonSource(item)
    setBatonGoal('')
    setBatonOpen(true)
  }

  function closeBatonModal() {
    setBatonOpen(false)
    setBatonSource(null)
    setBatonGoal('')
  }

  function handleDepart() {
    const goal = batonGoal.trim()
    if (!goal || !batonSource) return
    setInspiredDeltas(incrementSharedFeedInspiredDelta(batonSource.id))
    bumpUserLogInspiredCountIfExists(batonSource.id)
    const fromMyDiary = loadVoyageEntries().some((e) => e.id === batonSource.id)
    if (fromMyDiary) {
      const starter = loadProfileApplicantName().trim() || '한 선원'
      appendBatonInspiredOwnerNotification(starter)
    }
    const prev = loadMyVoyage()
    saveMyVoyage({
      ...prev,
      goalName: goal,
      inspiredBy: batonSource.author,
    })
    closeBatonModal()
    navigate('/', { replace: false })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-sky-50 to-blue-50 pb-28 pt-8">
      <main className="mx-auto max-w-lg px-4 sm:px-6">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            공동의 바다
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            메인 피드 · 떠내려온 항해 일지
          </p>
        </header>

        <div
          className="mb-4 flex rounded-2xl border border-indigo-200/70 bg-white/70 p-1 shadow-sm backdrop-blur-sm"
          role="tablist"
          aria-label="피드 범위"
        >
          <button
            type="button"
            role="tab"
            aria-selected={feedScope === 'all'}
            onClick={() => setFeedScope('all')}
            className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
              feedScope === 'all'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-indigo-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            전체 항해
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedScope === 'lighthouses'}
            onClick={() => setFeedScope('lighthouses')}
            className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
              feedScope === 'lighthouses'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-amber-300/90'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            나의 등대
          </button>
        </div>

        <div
          className="mb-6 flex rounded-2xl border border-sky-200/80 bg-white/60 p-1 shadow-sm backdrop-blur-sm"
          role="tablist"
          aria-label="피드 정렬"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sortMode === 'recent'}
            onClick={() => setSortMode('recent')}
            className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
              sortMode === 'recent'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-sky-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            방금 친 파도
            <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
              최신순
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sortMode === 'popular'}
            onClick={() => setSortMode('popular')}
            className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
              sortMode === 'popular'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-sky-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            깊은 울림
            <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
              인기순 · 응원 합산
            </span>
          </button>
        </div>

        {feedScope === 'lighthouses' && sortedFeed.length === 0 ? (
          <p className="mb-6 rounded-2xl border border-dashed border-amber-200/90 bg-amber-50/50 px-4 py-10 text-center text-sm text-slate-600">
            등대로 등록한 선원의 일지가 아직 없어요. 피드 카드나 명예의 기록실에서 🏮 등대
            등록을 눌러 보세요.
          </p>
        ) : null}

        <ul className="space-y-4">
          {sortedFeed.map((item) => {
            const merged = mergeCheers(item.cheers, cheerDeltas[item.id])
            const entries = sortedEmojiEntries(merged)
            const total = sumCheers(merged)
            const pickerOpen = pickerOpenFor === item.id

            const inspiredTotal =
              item.inspiredCount + (inspiredDeltas[item.id] ?? 0)

            return (
              <li key={item.id}>
                <article className="relative rounded-2xl border border-sky-100/90 bg-white/80 p-4 pt-5 shadow-md shadow-sky-100/40 backdrop-blur-sm">
                  {inspiredTotal >= 1 && (
                    <div className="absolute right-3 top-3 max-w-[min(100%,14rem)] rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold leading-tight text-amber-700 shadow-sm sm:text-xs">
                      ✨ {inspiredTotal}명의 새로운 항해를 이끌어냄
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pr-1 sm:pr-36">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {item.authorUserId !== myUserId ? (
                        <Link
                          to={`/mate/${encodeURIComponent(item.authorUserId)}`}
                          className="truncate text-sm font-semibold text-sky-900 underline decoration-sky-300/80 underline-offset-2 hover:text-sky-950"
                        >
                          {item.author}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-slate-800">
                          {item.author}
                        </span>
                      )}
                      <span className="rounded-full bg-sky-100/90 px-2.5 py-0.5 text-xs font-medium text-sky-900">
                        {TAG_LABEL[item.tag]}
                      </span>
                      {item.authorUserId !== myUserId && (
                        <LighthouseToggleButton
                          targetUserId={item.authorUserId}
                          targetDisplayName={item.author}
                          className="!py-1 !text-xs"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <time
                        className="text-xs text-slate-400"
                        dateTime={item.createdAt}
                      >
                        {formatShortDate(item.createdAt)}
                      </time>
                      {(item.authorUserId === myUserId || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50/80 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98]"
                          aria-label="이 게시글 삭제"
                          title={
                            item.authorUserId === myUserId
                              ? '내 게시글 삭제'
                              : '관리자 권한으로 삭제'
                          }
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {item.content}
                  </p>
                  <div
                    className="mt-4 border-t border-sky-100/80 pt-3"
                    aria-label="응원 리액션"
                  >
                    <p className="mb-2 text-xs font-medium text-slate-500">
                      응원 총{' '}
                      <BumpingCount
                        value={total}
                        className="font-semibold text-slate-800"
                      />
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {entries.map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-sky-200/90 bg-sky-50/90 px-2.5 py-1 text-sm text-slate-800 transition hover:bg-sky-100 active:scale-[0.98]"
                          title={`${emoji} 응원 보내기`}
                          onClick={() => handleBadgeClick(item.id, emoji)}
                        >
                          <span aria-hidden>{emoji}</span>
                          <BumpingCount
                            value={count}
                            className="min-w-[1ch] font-semibold"
                          />
                        </button>
                      ))}
                      <CheerPicker
                        postId={item.id}
                        open={pickerOpen}
                        onToggle={() =>
                          setPickerOpenFor((id) =>
                            id === item.id ? null : item.id,
                          )
                        }
                        onPick={(emoji) => handlePickFromMenu(item.id, emoji)}
                      />
                      <button
                        type="button"
                        onClick={() => openBatonModal(item)}
                        className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50/95 px-3 py-1.5 text-xs font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 active:scale-[0.98]"
                      >
                        <span aria-hidden>✨</span>
                        영감받고 항해 시작하기
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </main>

      {batonOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
            aria-label="모달 닫기"
            onClick={closeBatonModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="baton-modal-title"
            className="animate-cheer-bubble-in relative w-full max-w-md rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xl shadow-sky-200/50"
          >
            <h2
              id="baton-modal-title"
              className="text-center text-base font-semibold leading-snug text-slate-900"
            >
              이 기록에서 영감을 받아 새로운 항해를 시작하시겠습니까?
            </h2>
            <p className="mt-3 text-center text-xs text-slate-500">
              {batonSource && (
                <>
                  <span className="font-medium text-slate-700">
                    {batonSource.author}
                  </span>
                  님의 일지를 바탕으로 돛을 올립니다.
                </>
              )}
            </p>
            <label
              htmlFor="baton-goal"
              className="mt-5 block text-sm font-medium text-slate-800"
            >
              어떤 목표를 향해 돛을 올릴까요?
            </label>
            <input
              id="baton-goal"
              type="text"
              value={batonGoal}
              onChange={(e) => setBatonGoal(e.target.value)}
              placeholder="예: 졸업 연출 완성, 모의고사 목표 달성…"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              autoComplete="off"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeBatonModal}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!batonGoal.trim()}
                onClick={handleDepart}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                출항하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
