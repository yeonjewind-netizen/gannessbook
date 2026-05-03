import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Trophy, X } from 'lucide-react'
import {
  GANNESS_RECORD_CATEGORIES,
  coerceRecordMedia,
  getCurrentHolder,
  getHistoryChronological,
  type GannessRecordCategory,
  type RecordGeneration,
  type RecordMedia,
} from '../data/gannessRecords'
import { getMergedJourneyLog } from '../data/gannessPersistence'
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
  return { routines, methodology }
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
              return (
                <>
                  <div className="relative shrink-0 overflow-hidden bg-black">
                    <DetailHeroMedia media={current?.media} />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
                    <h2
                      id="record-detail-title"
                      className="pr-10 text-lg font-bold leading-snug text-slate-900"
                    >
                      {cat?.title ?? '—'}
                    </h2>
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
                                <button
                                  type="button"
                                  onClick={() => setJourneyOpen(row)}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                                >
                                  <BookOpen
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden
                                  />
                                  이 선원의 항해 일지 보기
                                </button>
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
                          const { routines, methodology } =
                            mergedLogbookForHolder(current)
                          const has =
                            routines.length > 0 || methodology.trim().length > 0
                          if (!has) {
                            return (
                              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                아직 공개된 비망록이 없어요. 기록 신청 시 데일리 루틴과
                                태풍 극복 방법을 적으면 여기에 표시됩니다.
                              </p>
                            )
                          }
                          return (
                            <>
                              {routines.length > 0 && (
                                <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                                  <div className="border-b border-sky-100 bg-sky-100/50 px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                                      데일리 루틴
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-sky-800/90">
                                      목표를 위해 매일 지켜 온 습관
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
                                      태풍을 넘기며
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-rose-900/85">
                                      위기 속 나만의 극복 방법
                                    </p>
                                  </div>
                                  <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-slate-800">
                                    {methodology}
                                  </p>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
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
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {log?.body ??
                      '이 선원의 상세 항해 일지는 준비 중입니다. 곧 기록실에 채워집니다.'}
                  </p>
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
                                          dataUrl: m.dataUrl,
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
