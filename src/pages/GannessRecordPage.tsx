import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Trash2, Trophy, X } from 'lucide-react'
import {
  GANNESS_RECORD_CATEGORIES,
  coerceRecordMedia,
  getCurrentHolder,
  getHistoryChronological,
  type GannessRecordCategory,
  type RecordGeneration,
  type RecordMedia,
} from '../data/gannessRecords'
import {
  getMergedJourneyLog,
  purgeRecordCategoryLocally,
  removeTimelineRowLocally,
  storedMediaSrc,
  type VoyageDiarySnapshotItem,
} from '../data/gannessPersistence'
import { useMergedRecordCategories } from '../hooks/useGannessStorage'
import RecordSubmissionForm, {
  type VoyageRecordPrefill,
} from '../components/RecordSubmissionForm'
import MediaLightbox, {
  type LightboxMedia,
} from '../components/MediaLightbox'
import { DiaryMediaPreviewGrid } from '../components/DiaryMediaPreviewGrid'
import { TimelineMoodRibbon } from '../components/TimelineMoodRibbon'
import {
  timelineBodyTextClass,
  timelineDotClass,
  timelineEntryArticleClassFlat,
  timelineMetaTextClass,
  timelineRailGradient,
} from '../voyage/timelineMood'
import LighthouseToggleButton from '../components/LighthouseToggleButton'
import { getOrCreateUserId } from '../voyage/userIdentity'
import { getVoyageMemo } from '../voyage/voyageMemoStorage'
import { addMyRoutine } from '../voyage/myRoutinesStorage'
import { useAuth } from '../context/AuthContext'
import {
  deleteRecordApplication,
  deleteRecordDoc,
  listPendingApplicationsByCategoryId,
  removeTimelineRowFromRecord,
  type FirestoreRecordApplication,
} from '../lib/firestoreUtils'
import type { MoodTag } from '../voyage/types'
import { TAG_LABEL } from '../voyage/constants'

/** 명예 기록 선배/동료를 등대로 등록할 때 쓰는 안정적인 userId */
function lighthouseTargetFromHolder(
  holder: RecordGeneration | null | undefined,
): { userId: string; label: string } | null {
  if (!holder?.journeyId?.trim()) return null
  const j = holder.journeyId.trim()
  const name = (holder.name ?? '').trim() || '선원'
  if (name.includes('나') && name.includes('현재')) {
    return { userId: getOrCreateUserId(), label: name }
  }
  return { userId: `jg:${j}`, label: name }
}

function mergedLogbookForHolder(holder: RecordGeneration) {
  const fromStore = getVoyageMemo(holder.journeyId)
  const routines =
    holder.dailyRoutines && holder.dailyRoutines.length > 0
      ? holder.dailyRoutines.filter((s) => s.trim())
      : (fromStore?.dailyRoutines ?? [])
  const methodology =
    holder.crisisMethodology?.trim() ||
    fromStore?.crisisMethodology?.trim() ||
    ''
  const journeyNote = holder.journeyNote?.trim() || ''
  return { routines, methodology, journeyNote }
}

/** 비망록 — moodTag로 분류한 일지 묶음 */
type ClassifiedSnapshots = {
  tailwinds: VoyageDiarySnapshotItem[]
  waves: VoyageDiarySnapshotItem[]
  all: VoyageDiarySnapshotItem[]
}

function classifySnapshots(
  snaps: VoyageDiarySnapshotItem[] | undefined,
): ClassifiedSnapshots {
  const all = snaps ?? []
  const tailwinds: VoyageDiarySnapshotItem[] = []
  const waves: VoyageDiarySnapshotItem[] = []
  for (const s of all) {
    const m: MoodTag | undefined = s.moodTag
    if (m === 'passion' || m === 'tailwind') tailwinds.push(s)
    else if (m === 'wall' || m === 'direction') waves.push(s)
  }
  return { tailwinds, waves, all }
}

function asCategoryArray(v: unknown): GannessRecordCategory[] {
  return Array.isArray(v) ? (v as GannessRecordCategory[]) : []
}

function asHistoryArray(v: unknown): RecordGeneration[] {
  return Array.isArray(v) ? (v as RecordGeneration[]) : []
}

/** 그리드: 정사각형 안에서 크롭 (통일감) */
function GridCoverMedia({
  media,
}: {
  media: RecordMedia | null | undefined
}) {
  const safe = coerceRecordMedia(media)
  if (safe.type === 'image') {
    return (
      <img
        src={safe.url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <video
      src={safe.url}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      aria-hidden
    />
  )
}

/** 상세 모달: 원본 비율 유지, 주어진 박스 안에서 최대 크기 */
function DetailHeroMedia({
  media,
}: {
  media: RecordMedia | null | undefined
}) {
  const safe = coerceRecordMedia(media)
  const box =
    'max-h-[min(52vh,520px)] w-full max-w-full object-contain'
  if (safe.type === 'image') {
    return (
      <div className="flex w-full min-w-0 items-center justify-center bg-black">
        <img
          src={safe.url}
          alt=""
          className={box}
          loading="eager"
          decoding="async"
        />
      </div>
    )
  }
  return (
    <div className="flex w-full min-w-0 items-center justify-center bg-black">
      <video
        src={safe.url}
        className={box}
        autoPlay
        muted
        loop
        playsInline
        controls
        controlsList="nodownload"
        preload="metadata"
      />
    </div>
  )
}

export default function GannessRecordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const recordCategories = useMergedRecordCategories()
  const safeRecordCategories = useMemo(
    () => asCategoryArray(recordCategories),
    [recordCategories],
  )
  const [detailCategory, setDetailCategory] =
    useState<GannessRecordCategory | null>(null)
  const [journeyOpen, setJourneyOpen] = useState<RecordGeneration | null>(null)
  const [journeyLightbox, setJourneyLightbox] =
    useState<LightboxMedia | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeCategoryId, setChallengeCategoryId] = useState(
    GANNESS_RECORD_CATEGORIES[0]?.id ?? '',
  )
  const [voyagePrefill, setVoyagePrefill] = useState<VoyageRecordPrefill | null>(
    null,
  )
  const [detailModalTab, setDetailModalTab] = useState<'overview' | 'logbook'>(
    'overview',
  )
  const [pendingFallback, setPendingFallback] = useState<
    FirestoreRecordApplication | null
  >(null)
  const [pendingFallbackLoading, setPendingFallbackLoading] = useState(false)
  const [detailLightbox, setDetailLightbox] = useState<LightboxMedia | null>(
    null,
  )
  const [adminBusy, setAdminBusy] = useState(false)

  const copyRoutineToMyChecklist = useCallback(
    (line: string, holder: RecordGeneration) => {
      const lh = lighthouseTargetFromHolder(holder)
      const res = addMyRoutine({
        label: line,
        originUserId: lh?.userId ?? null,
        originDisplayName:
          (holder.name ?? '').trim() || lh?.label || undefined,
      })
      if (!res.ok && res.reason === 'duplicate') {
        window.alert('이미 「오늘의 항해 체크리스트」에 있는 루틴이에요.')
        return
      }
      if (!res.ok) return
      window.alert(
        '나의 바다 「오늘의 항해 체크리스트」에 담았습니다. 홈에서 확인해 보세요.',
      )
    },
    [],
  )

  const closeChallenge = useCallback(() => {
    setChallengeOpen(false)
    setChallengeCategoryId(GANNESS_RECORD_CATEGORIES[0]?.id ?? '')
    setVoyagePrefill(null)
  }, [])

  useEffect(() => {
    const st = location.state as {
      openRecordSubmission?: boolean
      voyageRecordPrefill?: VoyageRecordPrefill
    } | null
    if (!st?.openRecordSubmission || !st.voyageRecordPrefill) return

    setVoyagePrefill(st.voyageRecordPrefill)
    setChallengeOpen(true)
    const cat = st.voyageRecordPrefill.initialCategoryId
    if (
      typeof cat === 'string' &&
      cat.trim() &&
      safeRecordCategories.some((c) => c.id === cat)
    ) {
      setChallengeCategoryId(cat)
    }
    navigate('.', { replace: true, state: {} })
  }, [location.state, navigate, safeRecordCategories])

  useEffect(() => {
    if (!voyagePrefill?.initialCategoryId?.trim()) return
    const cat = voyagePrefill.initialCategoryId.trim()
    if (safeRecordCategories.some((c) => c.id === cat)) {
      setChallengeCategoryId(cat)
    }
  }, [voyagePrefill, safeRecordCategories])

  const resolvedDetail = detailCategory
    ? safeRecordCategories.find((c) => c?.id === detailCategory.id) ??
      detailCategory
    : null

  useEffect(() => {
    if (detailCategory) setDetailModalTab('overview')
  }, [detailCategory?.id])

  useEffect(() => {
    setPendingFallback(null)
    if (!resolvedDetail) return
    const hist = asHistoryArray(resolvedDetail.history)
    if (resolvedDetail.status !== 'pending' || hist.length > 0) return
    let alive = true
    setPendingFallbackLoading(true)
    void (async () => {
      try {
        const apps = await listPendingApplicationsByCategoryId(
          resolvedDetail.id,
        )
        if (!alive) return
        setPendingFallback(apps[0] ?? null)
      } catch (error) {
        if (!alive) return
        console.warn('심사 중 신청 정보 로드 실패:', error)
        setPendingFallback(null)
      } finally {
        if (alive) setPendingFallbackLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [resolvedDetail?.id, resolvedDetail?.status, resolvedDetail?.history])

  const handleAdminDelete = useCallback(
    async (cat: GannessRecordCategory) => {
      if (
        !window.confirm(
          '정말 이 기록을 영구적으로 삭제하시겠습니까?\n\n복구할 수 없으며, 명예의 전당과 심사 대기열에서 모두 사라집니다.',
        )
      )
        return
      setAdminBusy(true)
      try {
        try {
          await deleteRecordDoc(cat.id)
        } catch (err) {
          console.warn('records 문서 삭제 실패(무시):', err)
        }
        try {
          const pendings = await listPendingApplicationsByCategoryId(cat.id)
          await Promise.allSettled(
            pendings.map((p) => deleteRecordApplication(p.id)),
          )
        } catch (err) {
          console.warn('심사 대기 신청 삭제 실패(무시):', err)
        }
        try {
          purgeRecordCategoryLocally(cat.id)
        } catch (err) {
          console.warn('localStorage 정리 실패(무시):', err)
        }
        setDetailCategory(null)
      } catch (error) {
        console.error('기록 영구 삭제 실패:', error)
        window.alert('삭제 처리 중 오류가 발생했습니다.')
      } finally {
        setAdminBusy(false)
      }
    },
    [],
  )

  const handleAdminDeleteRow = useCallback(
    async (categoryId: string, generation: number, name: string) => {
      if (
        !window.confirm(
          `정말 이 회차 기록을 영구적으로 삭제하시겠습니까?\n\n${generation}대 · ${name}`,
        )
      )
        return
      setAdminBusy(true)
      try {
        try {
          await removeTimelineRowFromRecord(categoryId, generation)
        } catch (err) {
          console.warn('Firestore 타임라인 삭제 실패(무시):', err)
        }
        try {
          removeTimelineRowLocally(categoryId, generation)
        } catch (err) {
          console.warn('localStorage 타임라인 정리 실패(무시):', err)
        }
      } catch (error) {
        console.error('회차 기록 삭제 실패:', error)
        window.alert('회차 삭제 처리 중 오류가 발생했습니다.')
      } finally {
        setAdminBusy(false)
      }
    },
    [],
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50/40 to-slate-100 pb-36 pt-8">
      <main className="mx-auto max-w-lg px-4 sm:px-6">
        <header className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-900 shadow-sm">
            <Trophy className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ganness Book
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            명예의 기록실
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            깨진 기록도 사라지지 않습니다. 1대, 2대… 선원들의 항해가 이어집니다.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {safeRecordCategories.map((cat, idx) => {
            const history = asHistoryArray(cat?.history)
            const current = getCurrentHolder(history)
            const status = cat?.status ?? 'approved'
            return (
              <button
                key={cat?.id ?? `record-cat-${idx}`}
                type="button"
                onClick={() => cat && setDetailCategory(cat)}
                className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-white/40 bg-slate-200 text-left shadow-lg shadow-indigo-200/40 ring-1 ring-indigo-100/60 transition hover:ring-2 hover:ring-indigo-300/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <GridCoverMedia media={current?.media} />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 p-3 pt-12">
                  <span
                    className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      status === 'approved'
                        ? 'bg-emerald-400/90 text-emerald-950'
                        : status === 'pending'
                          ? 'bg-amber-300/90 text-amber-950'
                          : 'bg-slate-400/90 text-white'
                    }`}
                  >
                    {status === 'approved'
                      ? '등재'
                      : status === 'pending'
                        ? '심사 중'
                        : '등재 제외'}
                  </span>
                  <p className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow-sm sm:text-[13px]">
                    {cat?.title ?? '—'}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-white/90">
                    최고 기록 · {current?.name ?? '—'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-5 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-600">
            새로운 기네스에 도전하고 싶다면 아래에서 신청할 수 있어요.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => setChallengeOpen(true)}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] sm:w-auto sm:min-w-[200px] sm:px-8"
            >
              나도 기록 도전 신청하기
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/', {
                  state: {
                    presetCategoryId:
                      challengeCategoryId ||
                      GANNESS_RECORD_CATEGORIES[0]?.id ||
                      '',
                  },
                })
              }
              className="w-full rounded-xl border-2 border-sky-400/80 bg-sky-50 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 active:scale-[0.99] sm:w-auto sm:min-w-[200px] sm:px-6"
            >
              기록 도전 · 나의 바다로
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            「나의 바다로」는 나의 항해 출항 화면으로 이동하며, 선택한 카테고리가 목표
            성격(카테고리) 필드에 미리 채워집니다. 목표 문구를 적은 뒤 출항하기를 눌러
            항해를 시작해요.
          </p>
        </div>
      </main>

      {resolvedDetail && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
          role="presentation"
        >
          <MediaLightbox
            open={detailLightbox != null}
            media={detailLightbox}
            onClose={() => setDetailLightbox(null)}
          />
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] transition-opacity"
            aria-label="닫기"
            onClick={() => setDetailCategory(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-detail-title"
            className="animate-record-detail-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-indigo-100/90 bg-white shadow-2xl sm:mx-4 sm:max-h-[88vh] sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={() => setDetailCategory(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/55"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
            {(() => {
              const cat = resolvedDetail
              const hist = asHistoryArray(cat?.history)
              const current = getCurrentHolder(hist)
              const timelineRaw = getHistoryChronological(hist)
              const timeline = Array.isArray(timelineRaw) ? timelineRaw : []
              const isPendingPreview =
                cat?.status === 'pending' && timeline.length === 0
              const pendingMedia = pendingFallback?.mediaItems[0]
              const pendingMediaUrl = pendingMedia
                ? storedMediaSrc(pendingMedia)
                : ''
              const pendingHero: RecordMedia | null = pendingMediaUrl
                ? {
                    type:
                      pendingMedia?.type === 'video' ? 'video' : 'image',
                    url: pendingMediaUrl,
                  }
                : null
              return (
                <>
                  <div className="relative shrink-0 overflow-hidden bg-black">
                    <DetailHeroMedia
                      media={
                        isPendingPreview && pendingHero
                          ? pendingHero
                          : current?.media
                      }
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
                    <div className="flex items-start justify-between gap-2 pr-10">
                      <h2
                        id="record-detail-title"
                        className="text-lg font-bold leading-snug text-slate-900"
                      >
                        {cat?.title ?? '—'}
                      </h2>
                      {isAdmin && cat?.id && (
                        <button
                          type="button"
                          onClick={() => void handleAdminDelete(cat)}
                          disabled={adminBusy}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-60"
                          aria-label="이 기록 영구 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          삭제
                        </button>
                      )}
                    </div>
                    {isPendingPreview ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                            심사 중
                          </span>
                          {pendingFallbackLoading && (
                            <span className="text-xs text-slate-500">
                              로딩 중...
                            </span>
                          )}
                        </div>
                        {pendingFallback ? (
                          <>
                            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-sm">
                              <p className="font-semibold text-slate-900">
                                {pendingFallback.applicantName}
                              </p>
                              <p className="mt-1 text-indigo-800">
                                제출 기록 ·{' '}
                                <span className="font-bold">
                                  {pendingFallback.recordValue}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                접수 ·{' '}
                                {new Date(
                                  pendingFallback.createdAt,
                                ).toLocaleString('ko-KR', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </p>
                            </div>
                            {pendingFallback.dailyRoutines &&
                              pendingFallback.dailyRoutines.filter((s) =>
                                s.trim(),
                              ).length > 0 && (
                                <div className="overflow-hidden rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                                  <div className="border-b border-sky-100 bg-sky-100/50 px-3 py-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                                      나의 루틴 & 습관
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-sky-900/85">
                                      기록 달성을 위해 반복한 행동들
                                    </p>
                                  </div>
                                  <ul className="divide-y divide-sky-100/80">
                                    {pendingFallback.dailyRoutines.filter((s) =>
                                      s.trim(),
                                    ).map((line, i) => (
                                      <li
                                        key={`pf-r-${i}`}
                                        className="px-3 py-2 text-sm leading-relaxed text-slate-800"
                                      >
                                        <span className="mr-2 font-bold text-sky-700">
                                          {i + 1}.
                                        </span>
                                        {line.trim()}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            {pendingFallback.crisisMethodology?.trim() && (
                              <div className="overflow-hidden rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50/90 to-white shadow-sm">
                                <div className="border-b border-rose-100 bg-rose-50/80 px-3 py-2">
                                  <p className="text-xs font-bold uppercase tracking-wider text-rose-900">
                                    파도를 넘는 법
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-rose-900/85">
                                    실패했을 때 다시 일어났던 구체적인 경험과 방법
                                  </p>
                                </div>
                                <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-slate-800">
                                  {pendingFallback.crisisMethodology.trim()}
                                </p>
                              </div>
                            )}
                            {pendingFallback.journeyNote?.trim() && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  항해사 소감
                                </p>
                                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">
                                  {pendingFallback.journeyNote}
                                </p>
                              </div>
                            )}
                            {pendingFallback.mediaItems.length > 0 && (
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                  증명 자료
                                </p>
                                <DiaryMediaPreviewGrid
                                  items={pendingFallback.mediaItems.map(
                                    (m) => ({
                                      type: m.type,
                                      src: storedMediaSrc(m),
                                    }),
                                  )}
                                  layout="compact"
                                  rowKeyPrefix={pendingFallback.id}
                                  onOpen={setDetailLightbox}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          !pendingFallbackLoading && (
                            <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-6 text-center text-sm text-amber-900">
                              아직 등재되지 않은 기록입니다. 학생회의 심사가 끝나면
                              1대 기록자가 등재됩니다.
                            </p>
                          )
                        )}
                      </div>
                    ) : (
                      <>
                    <p className="mt-1 text-sm text-slate-600">
                      현재 {current?.generation ?? '—'}대 ·{' '}
                      <span className="font-semibold text-indigo-700">
                        {current?.recordValue ?? '—'}
                      </span>{' '}
                      · {current?.name ?? '—'}
                    </p>

                    <div
                      className="mt-4 flex rounded-xl border border-slate-200 bg-slate-50/80 p-1"
                      role="tablist"
                      aria-label="기록 상세 보기"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailModalTab === 'overview'}
                        onClick={() => setDetailModalTab('overview')}
                        className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                          detailModalTab === 'overview'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        요약
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailModalTab === 'logbook'}
                        onClick={() => setDetailModalTab('logbook')}
                        className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                          detailModalTab === 'logbook'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-amber-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        비망록
                      </button>
                    </div>

                    {detailModalTab === 'overview' ? (
                      <>
                    {(() => {
                      const lb = mergedLogbookForHolder(current)
                      const log = getMergedJourneyLog(current?.journeyId)
                      const headline = log?.headline?.trim() ?? ''
                      const body = log?.body?.trim() ?? ''
                      const reflectionOnly =
                        !body && lb.journeyNote.trim().length > 0
                      if (
                        !headline &&
                        !body &&
                        !reflectionOnly
                      )
                        return null
                      return (
                        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm">
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                            현재 기록자의 항해
                          </p>
                          {headline && (
                            <p className="mt-1.5 text-sm font-semibold text-slate-900">
                              {headline}
                            </p>
                          )}
                          {body && (
                            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">
                              {body}
                            </p>
                          )}
                          {reflectionOnly && (
                            <>
                              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-indigo-700">
                                항해사 소감
                              </p>
                              <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-700">
                                {lb.journeyNote}
                              </p>
                            </>
                          )}
                        </div>
                      )
                    })()}

                    <button
                      type="button"
                      onClick={() => {
                        if (!cat?.id) return
                        navigate('/', {
                          state: { presetCategoryId: cat.id },
                        })
                        setDetailCategory(null)
                      }}
                      className="mt-4 w-full rounded-xl border-2 border-sky-300 bg-sky-50 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
                    >
                      나의 바다에 목표로 세우기
                    </button>

                    {(() => {
                      const lh = lighthouseTargetFromHolder(current)
                      if (!lh) return null
                      return (
                        <div className="mt-3">
                          <LighthouseToggleButton
                            targetUserId={lh.userId}
                            targetDisplayName={lh.label}
                            className="w-full justify-center py-2.5"
                          />
                        </div>
                      )
                    })()}

                    <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">
                      역대 기록 타임라인
                    </h3>
                    <ol
                      className="relative mt-3 space-y-0 border-l-2 border-indigo-200 pl-5"
                      aria-label="역대 기록"
                    >
                      {timeline.map((row, tIdx) => {
                        const thumb = coerceRecordMedia(row?.media)
                        const rk = `${cat?.id ?? 'cat'}-${row?.generation ?? tIdx}-${row?.journeyId ?? tIdx}`
                        const rowGen =
                          typeof row?.generation === 'number' &&
                          Number.isFinite(row.generation)
                            ? row.generation
                            : null
                        return (
                        <li
                          key={rk}
                          className="relative pb-6 last:pb-0"
                        >
                          <span
                            className="absolute -left-[21px] top-1 flex h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-200"
                            aria-hidden
                          />
                          <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 shadow-sm">
                            <div className="flex h-20 gap-0 sm:h-24">
                              <div className="relative w-24 shrink-0 overflow-hidden sm:w-28">
                                {thumb.type === 'image' ? (
                                  <img
                                    src={thumb.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <video
                                    src={thumb.url}
                                    className="h-full w-full object-cover"
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                    preload="metadata"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">
                                    {row?.generation ?? '—'}대
                                  </span>
                                  <span className="truncate font-semibold text-slate-900">
                                    {row?.name ?? '—'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-indigo-700">
                                  {row?.recordValue ?? '—'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setJourneyOpen(row)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                                  >
                                    <BookOpen
                                      className="h-3.5 w-3.5 shrink-0"
                                      aria-hidden
                                    />
                                    이 선원의 항해 일지 보기
                                  </button>
                                  {isAdmin && cat?.id && rowGen != null && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleAdminDeleteRow(
                                          cat.id,
                                          rowGen,
                                          row?.name ?? '',
                                        )
                                      }
                                      disabled={adminBusy}
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:opacity-60"
                                      aria-label="이 회차 기록 삭제"
                                    >
                                      <Trash2
                                        className="h-3.5 w-3.5 shrink-0"
                                        aria-hidden
                                      />
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                        )
                      })}
                    </ol>
                      </>
                    ) : (
                      <div className="mt-5 space-y-4">
                        {(() => {
                          const { routines, methodology, journeyNote } =
                            mergedLogbookForHolder(current)
                          const log = getMergedJourneyLog(current?.journeyId)
                          const snaps = log?.voyageDiarySnapshots
                          const { tailwinds, waves, all } =
                            classifySnapshots(snaps)
                          const has =
                            routines.length > 0 ||
                            methodology.trim().length > 0 ||
                            journeyNote.trim().length > 0 ||
                            all.length > 0
                          if (!has) {
                            return (
                              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                아직 공개된 비망록이 없어요. 기록 신청 시 나의 루틴·습관,
                                파도를 넘는 법, 소감을 적으면 여기에 표시됩니다.
                              </p>
                            )
                          }
                          return (
                            <>
                              {routines.length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                                  <div className="border-b border-sky-100 bg-sky-100/50 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                                      나의 루틴 & 습관
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-sky-800/90">
                                      기록 달성을 위해 반복한 행동들
                                    </p>
                                  </div>
                                  <ul className="divide-y divide-sky-100/80">
                                    {routines.map((line, i) => (
                                      <li key={`${line}-${i}`}>
                                        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-200/90 text-xs font-bold text-sky-950">
                                            {i + 1}
                                          </span>
                                          <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800">
                                            {line}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              copyRoutineToMyChecklist(
                                                line,
                                                current,
                                              )
                                            }
                                            className="shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-center text-xs font-bold text-indigo-800 shadow-sm transition hover:bg-indigo-50 active:scale-[0.99]"
                                          >
                                            ⚓ 내 바다로 가져오기
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {methodology.trim().length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/90 to-white shadow-sm">
                                  <div className="border-b border-rose-100 bg-rose-50/80 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-rose-900">
                                      파도를 넘는 법
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-rose-900/85">
                                      실패했을 때 다시 일어났던 구체적인 경험과 방법
                                    </p>
                                  </div>
                                  <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-slate-800">
                                    {methodology}
                                  </p>
                                </div>
                              )}
                              {journeyNote.trim().length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">
                                  <div className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                                      항해사 소감
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-indigo-900/85">
                                      기록 전체에 대한 소감
                                    </p>
                                  </div>
                                  <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-slate-800">
                                    {journeyNote}
                                  </p>
                                </div>
                              )}
                              {tailwinds.length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
                                  <div className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                                      ⛵ 우리가 만난 순풍
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-emerald-800/90">
                                      목표에 한 발 더 가까워진 순간
                                    </p>
                                  </div>
                                  <ul className="divide-y divide-emerald-100/70">
                                    {tailwinds.map((s) => (
                                      <li key={s.id} className="px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-900/80">
                                          <time dateTime={s.createdAt}>
                                            {new Date(s.createdAt).toLocaleString(
                                              'ko-KR',
                                              {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                              },
                                            )}
                                          </time>
                                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold">
                                            {s.moodTag
                                              ? TAG_LABEL[s.moodTag]
                                              : s.tag}
                                          </span>
                                        </div>
                                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                          {s.body}
                                        </p>
                                        {s.mediaItems &&
                                          s.mediaItems.length > 0 && (
                                            <div className="mt-2">
                                              <DiaryMediaPreviewGrid
                                                items={s.mediaItems.map(
                                                  (m) => ({
                                                    type: m.type,
                                                    src: storedMediaSrc(m),
                                                  }),
                                                )}
                                                layout="compact"
                                                rowKeyPrefix={`tw-${s.id}`}
                                                onOpen={setDetailLightbox}
                                              />
                                            </div>
                                          )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {waves.length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-white shadow-sm">
                                  <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                                      🌊 우리가 만난 파도와 태풍
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-amber-800/90">
                                      흔들리고 다시 일어선 시간
                                    </p>
                                  </div>
                                  <ul className="divide-y divide-amber-100/70">
                                    {waves.map((s) => (
                                      <li key={s.id} className="px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-900/80">
                                          <time dateTime={s.createdAt}>
                                            {new Date(s.createdAt).toLocaleString(
                                              'ko-KR',
                                              {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                              },
                                            )}
                                          </time>
                                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">
                                            {s.moodTag
                                              ? TAG_LABEL[s.moodTag]
                                              : s.tag}
                                          </span>
                                        </div>
                                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                          {s.body}
                                        </p>
                                        {s.mediaItems &&
                                          s.mediaItems.length > 0 && (
                                            <div className="mt-2">
                                              <DiaryMediaPreviewGrid
                                                items={s.mediaItems.map(
                                                  (m) => ({
                                                    type: m.type,
                                                    src: storedMediaSrc(m),
                                                  }),
                                                )}
                                                layout="compact"
                                                rowKeyPrefix={`wv-${s.id}`}
                                                onOpen={setDetailLightbox}
                                              />
                                            </div>
                                          )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {all.length > 0 && (
                                <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                  <summary className="cursor-pointer list-none border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                                    📓 전체 항해 일지 보기 · {all.length}편
                                  </summary>
                                  <ol className="divide-y divide-slate-100">
                                    {all.map((s) => (
                                      <li key={`all-${s.id}`} className="px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                          <time dateTime={s.createdAt}>
                                            {new Date(s.createdAt).toLocaleString(
                                              'ko-KR',
                                              {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                              },
                                            )}
                                          </time>
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                            {s.moodTag
                                              ? TAG_LABEL[s.moodTag]
                                              : s.tag}
                                          </span>
                                        </div>
                                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                          {s.body}
                                        </p>
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                      </>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      <RecordSubmissionForm
        open={challengeOpen}
        onClose={closeChallenge}
        categories={safeRecordCategories}
        initialCategoryId={challengeCategoryId}
        voyagePrefill={voyagePrefill}
      />

      {journeyOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <MediaLightbox
            open={journeyLightbox != null}
            media={journeyLightbox}
            onClose={() => setJourneyLightbox(null)}
          />
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="닫기"
            onClick={() => {
              setJourneyLightbox(null)
              setJourneyOpen(null)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="journey-dialog-title"
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-sky-200 bg-white p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setJourneyLightbox(null)
                setJourneyOpen(null)
              }}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
            {(() => {
              const log = getMergedJourneyLog(journeyOpen?.journeyId)
              const snaps = log?.voyageDiarySnapshots ?? []
              const lb = journeyOpen
                ? mergedLogbookForHolder(journeyOpen)
                : { routines: [] as string[], methodology: '', journeyNote: '' }
              const hasStructured =
                lb.routines.length > 0 ||
                lb.methodology.trim().length > 0 ||
                lb.journeyNote.trim().length > 0
              const showCompositeBody = Boolean(log?.body?.trim()) && !hasStructured
              const showEmptyHint =
                !hasStructured &&
                !showCompositeBody &&
                snaps.length === 0

              return (
                <>
                  <p
                    id="journey-dialog-title"
                    className="pr-10 text-lg font-bold text-slate-900"
                  >
                    {log?.headline ?? `${journeyOpen?.name ?? '선원'}의 항해`}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    항해 일지 ID · {journeyOpen?.journeyId ?? '—'}
                  </p>

                  {lb.routines.length > 0 && (
                    <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                        나의 루틴 & 습관
                      </p>
                      <p className="mt-1 text-[11px] text-sky-900/80">
                        기록 달성을 위해 반복한 행동들
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800">
                        {lb.routines.map((line, i) => (
                          <li key={`jd-r-${i}`}>
                            <span className="mr-2 font-bold text-sky-800">
                              {i + 1}.
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {lb.methodology.trim().length > 0 && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-rose-900">
                        파도를 넘는 법
                      </p>
                      <p className="mt-1 text-[11px] text-rose-900/85">
                        실패했을 때 다시 일어났던 구체적인 경험과 방법
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {lb.methodology}
                      </p>
                    </div>
                  )}

                  {lb.journeyNote.trim().length > 0 && (
                    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                        항해사 소감
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {lb.journeyNote}
                      </p>
                    </div>
                  )}

                  {showCompositeBody && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {log?.body}
                    </p>
                  )}

                  {showEmptyHint && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      이 선원의 상세 항해 일지는 준비 중입니다. 곧 기록실에 채워집니다.
                    </p>
                  )}

                  {snaps.length > 0 && (
                    <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        공개된 나의 바다 일지 · 타임라인
                      </p>
                      <div className="relative">
                        <span
                          className={`pointer-events-none absolute bottom-0 left-[13px] top-2 w-px ${timelineRailGradient(
                            'surface',
                          )}`}
                          aria-hidden
                        />
                        <ol className="relative space-y-4">
                          {snaps.map((row) => (
                            <li
                              key={row.id}
                              className="relative flex gap-3 pl-7"
                            >
                              <span
                                className={`absolute left-[9px] top-4 z-[1] flex h-3.5 w-3.5 shrink-0 rounded-full border-2 shadow-md ${timelineDotClass(
                                  row.moodTag,
                                  'surface',
                                )}`}
                                aria-hidden
                              />
                              <article
                                className={`min-w-0 flex-1 rounded-2xl border p-3 text-sm ${timelineEntryArticleClassFlat(
                                  row.moodTag,
                                )}`}
                              >
                                <div
                                  className={`flex flex-wrap items-center gap-2 text-[11px] ${timelineMetaTextClass(
                                    row.moodTag,
                                    'surface',
                                  )}`}
                                >
                                  <time dateTime={row.createdAt}>
                                    {new Date(row.createdAt).toLocaleString(
                                      'ko-KR',
                                      {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      },
                                    )}
                                  </time>
                                  <TimelineMoodRibbon
                                    moodTag={row.moodTag}
                                    surface="surface"
                                    tagLabel={row.tag}
                                  />
                                </div>
                                <p
                                  className={`mt-2 whitespace-pre-wrap ${timelineBodyTextClass(
                                    row.moodTag,
                                    'surface',
                                  )}`}
                                >
                                  {row.body}
                                </p>
                                {row.mediaItems &&
                                  row.mediaItems.length > 0 && (
                                    <div className="mt-2">
                                      <DiaryMediaPreviewGrid
                                        items={row.mediaItems.map((m) => ({
                                          type: m.type,
                                          src: storedMediaSrc(m),
                                        }))}
                                        layout="admin"
                                        rowKeyPrefix={row.id}
                                        onOpen={setJourneyLightbox}
                                      />
                                    </div>
                                  )}
                              </article>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
