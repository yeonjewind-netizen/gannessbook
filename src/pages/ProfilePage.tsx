import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Archive,
  Hourglass,
  Settings,
  Ship,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { loadVoyageEntries } from '../voyage/voyageEntries'
import { loadMyVoyage } from '../voyage/myVoyageStorage'
import { BumpingCount } from '../components/BumpingCount'
import { useAdminMode } from '../hooks/useGannessStorage'
import {
  GANNESS_STORAGE_EVENT,
  getRecordCategoryTitle,
  loadApplications,
  type RecordApplication,
} from '../data/gannessPersistence'
import type { CompletedVoyageArchiveEntry } from '../voyage/completedVoyagesArchive'
import { loadCompletedVoyagesArchive } from '../voyage/completedVoyagesArchive'
import {
  PROFILE_UPDATES_EVENT,
  loadProfileApplicantName,
  saveProfileApplicantName,
} from '../voyage/profileApplicantStorage'
import { TAG_LABEL } from '../voyage/constants'
import { formatShortDate } from '../voyage/dateFormat'
import { logAttachmentSrc } from '../voyage/types'
import ConstellationMap from '../components/ConstellationMap'
import GrowthGalaxy from '../components/GrowthGalaxy'
import {
  getFollowersOf,
  LIGHTHOUSE_UPDATES_EVENT,
  loadLighthouses,
  resolveDisplayName,
} from '../voyage/lighthouseStorage'
import { getOrCreateUserId } from '../voyage/userIdentity'

function splitApplicationsForViewer(nameTrimmed: string, apps: RecordApplication[]) {
  if (!nameTrimmed) {
    return {
      pending: [] as RecordApplication[],
      approved: [] as RecordApplication[],
      rejected: [] as RecordApplication[],
      hasFilter: false,
    }
  }
  const n = nameTrimmed.toLowerCase()
  const mine = apps.filter(
    (a) => a.applicantName.trim().toLowerCase() === n,
  )
  return {
    pending: mine.filter((a) => a.status === 'pending'),
    approved: mine.filter((a) => a.status === 'approved'),
    rejected: mine.filter((a) => a.status === 'rejected'),
    hasFilter: true,
  }
}

export default function ProfilePage() {
  const { pathname } = useLocation()
  const { enabled: adminMode, setEnabled: setAdminMode } = useAdminMode()
  const [memoryOpen, setMemoryOpen] =
    useState<CompletedVoyageArchiveEntry | null>(null)
  const [constellationOpen, setConstellationOpen] = useState(false)
  const [growthGalaxyOpen, setGrowthGalaxyOpen] = useState(false)
  const [lighthouseListKind, setLighthouseListKind] = useState<
    'following' | 'followers' | null
  >(null)
  const [lighthouseTick, setLighthouseTick] = useState(0)
  const [archiveTick, setArchiveTick] = useState(0)
  const [applicantDraft, setApplicantDraft] = useState(() =>
    loadProfileApplicantName(),
  )

  useEffect(() => {
    const bump = () => setArchiveTick((t) => t + 1)
    window.addEventListener(GANNESS_STORAGE_EVENT, bump)
    window.addEventListener(PROFILE_UPDATES_EVENT, bump)
    return () => {
      window.removeEventListener(GANNESS_STORAGE_EVENT, bump)
      window.removeEventListener(PROFILE_UPDATES_EVENT, bump)
    }
  }, [])

  useEffect(() => {
    const bump = () => setLighthouseTick((t) => t + 1)
    window.addEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    return () => window.removeEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
  }, [])

  useEffect(() => {
    setApplicantDraft(loadProfileApplicantName())
  }, [archiveTick, pathname])

  const entries = useMemo(() => loadVoyageEntries(), [pathname, archiveTick])
  const totalInspirationGiven = useMemo(
    () => entries.reduce((s, e) => s + (e.inspiredCount ?? 0), 0),
    [entries],
  )

  const completedVoyages = useMemo(
    () => loadCompletedVoyagesArchive(),
    [archiveTick],
  )

  const hasActiveOceanGoal = useMemo(() => {
    const p = loadMyVoyage()
    return (
      p.goalName.trim().length > 0 && p.voyageLegId.trim().length > 0
    )
  }, [archiveTick])

  const allApplications = useMemo(() => loadApplications(), [archiveTick])

  const { pending, approved, rejected, hasFilter } = useMemo(
    () => splitApplicationsForViewer(applicantDraft.trim(), allApplications),
    [applicantDraft, allApplications],
  )

  const myUserId = useMemo(() => getOrCreateUserId(), [])

  const followingUserIds = useMemo(() => {
    void lighthouseTick
    void archiveTick
    return loadLighthouses()
  }, [lighthouseTick, archiveTick])

  const followerEdges = useMemo(() => {
    void lighthouseTick
    void archiveTick
    return getFollowersOf(myUserId)
  }, [lighthouseTick, archiveTick, myUserId])

  const saveApplicant = useCallback(() => {
    saveProfileApplicantName(applicantDraft)
  }, [applicantDraft])

  const sortedMemoryDiary = useCallback(
    (v: CompletedVoyageArchiveEntry) =>
      [...v.diaryEntries].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [],
  )

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-amber-50/80 via-sky-50/50 to-slate-100 pb-28 pt-10">
      <ConstellationMap
        open={constellationOpen}
        onClose={() => setConstellationOpen(false)}
        voyages={completedVoyages}
      />
      <GrowthGalaxy
        open={growthGalaxyOpen}
        onClose={() => setGrowthGalaxyOpen(false)}
        voyages={completedVoyages}
        applications={allApplications}
        layoutRevision={archiveTick}
      />
      <main className="mx-auto max-w-lg px-4 sm:px-6">
        <header className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            선원의 기록
          </h1>
          <p className="mt-1 text-sm text-slate-500">프로필 · 선한 영향력</p>
        </header>

        <section
          className="mb-8 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-sky-50/50 px-4 py-4 shadow-md shadow-amber-100/40 ring-1 ring-amber-100/70"
          aria-label="등대"
        >
          <p className="text-center text-xs font-bold uppercase tracking-wider text-amber-900/70">
            역할 모델 · 등대
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setLighthouseListKind('following')}
              className="min-w-[10rem] flex-1 rounded-2xl border border-sky-200/90 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50/90 sm:flex-none"
            >
              <span className="text-[11px] font-semibold text-slate-500">
                내가 따라가는 등대
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-sky-900">
                {followingUserIds.length}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setLighthouseListKind('followers')}
              className="min-w-[10rem] flex-1 rounded-2xl border border-violet-200/90 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:border-violet-300 hover:bg-violet-50/90 sm:flex-none"
            >
              <span className="text-[11px] font-semibold text-slate-500">
                나를 등대로 삼은 선원
              </span>
              <p className="mt-1 text-2xl font-bold tabular-nums text-violet-950">
                {followerEdges.length}
              </p>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            숫자를 누르면 목록이 열려요. 같은 기기에서 등대를 맺은 기록만 집계됩니다.
          </p>
        </section>

        {/* 완료된 항해 */}
        <section
          className="mb-8"
          aria-labelledby="completed-voyages-heading"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Ship
                className="h-5 w-5 text-amber-700"
                strokeWidth={2}
                aria-hidden
              />
              <h2
                id="completed-voyages-heading"
                className="text-base font-bold text-slate-900"
              >
                완료된 항해
              </h2>
            </div>
            {(completedVoyages.length > 0 || hasActiveOceanGoal) && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {completedVoyages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConstellationOpen(true)}
                    className="shrink-0 rounded-full border border-indigo-200/90 bg-gradient-to-r from-indigo-500/15 to-sky-500/15 px-3 py-1.5 text-xs font-bold text-indigo-900 shadow-sm ring-1 ring-indigo-100/80 transition hover:from-indigo-500/25 hover:to-sky-500/25"
                  >
                    나의 6년 별자리 보기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setGrowthGalaxyOpen(true)}
                  className="shrink-0 rounded-full border border-violet-300/90 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 px-3 py-1.5 text-xs font-bold text-violet-900 shadow-sm ring-1 ring-violet-200/80 transition hover:from-violet-500/25 hover:to-fuchsia-500/20"
                >
                  나의 6년 성장 은하계
                </button>
              </div>
            )}
          </div>
          {completedVoyages.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-amber-200/80 bg-white/60 px-4 py-8 text-center text-sm text-slate-600">
              아직 완료한 항해가 없어요. 나의 바다에서 목표를 이루고「항해
              완료」를 눌러 보세요.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {completedVoyages.map((v) => {
                const retroPreview = v.finalRetrospective?.trim()
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setMemoryOpen(v)}
                      className="group w-full rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white p-4 text-left shadow-md shadow-amber-200/20 ring-1 ring-amber-100/60 transition hover:border-amber-300 hover:shadow-lg hover:shadow-amber-200/30"
                    >
                      <p className="line-clamp-2 text-sm font-bold text-amber-950">
                        {v.goalName}
                      </p>
                      <p className="mt-1 text-xs text-amber-800/80">
                        {formatShortDate(v.completedAt)} · 일지{' '}
                        {v.diaryEntries.length}장
                      </p>
                      {retroPreview ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                          “{retroPreview}”
                        </p>
                      ) : (
                        <p className="mt-2 text-xs italic text-slate-400">
                          회고는 아직 비어 있어요
                        </p>
                      )}
                      <p className="mt-3 text-xs font-semibold text-amber-700/90 group-hover:underline">
                        추억함 열기 →
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 도전 기록 현황 */}
        <section className="mb-8" aria-labelledby="record-challenge-heading">
          <div className="mb-3 flex items-center gap-2">
            <Trophy
              className="h-5 w-5 text-indigo-600"
              strokeWidth={2}
              aria-hidden
            />
            <h2
              id="record-challenge-heading"
              className="text-base font-bold text-slate-900"
            >
              도전 기록 현황
            </h2>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              기록 신청에 적은 이름
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              제출한 적이 있으면 자동으로 채워질 수 있어요. 이 이름과 같은
              신청만 아래에 모읍니다.
            </p>
            <input
              type="text"
              value={applicantDraft}
              onChange={(e) => setApplicantDraft(e.target.value)}
              onBlur={saveApplicant}
              placeholder="예: 홍길동"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {!hasFilter ? (
            <p className="mt-3 text-sm text-slate-600">
              이름을 입력해 주시면 <strong>심사 대기</strong>와{' '}
              <strong>명예의 전당 등재</strong>를 구분해 볼 수 있어요.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-900">
                  <Hourglass className="h-4 w-4" aria-hidden />
                  학생회 심사 대기
                </div>
                {pending.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/40 px-3 py-4 text-sm text-slate-600">
                    대기 중인 내 신청이 없어요.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((app) => (
                      <li
                        key={app.id}
                        className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {getRecordCategoryTitle(app.categoryId)}
                        </p>
                        <p className="text-xs text-amber-900/80">
                          수치 · {app.recordValue}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          제출 ·{' '}
                          {app.createdAt
                            ? new Date(app.createdAt).toLocaleString('ko-KR', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-indigo-900">
                  <Trophy className="h-4 w-4" aria-hidden />
                  공식 등재(승인됨)
                </div>
                {approved.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-indigo-200/80 bg-indigo-50/40 px-3 py-4 text-sm text-slate-600">
                    등재된 내 기록이 아직 없어요. 심사가 끝나면 여기에
                    표시됩니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {approved.map((app) => (
                      <li
                        key={app.id}
                        className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-3 py-2.5"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {getRecordCategoryTitle(app.categoryId)}
                        </p>
                        <p className="text-xs text-indigo-900/80">
                          기록 · {app.recordValue}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {rejected.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-rose-700">
                    반려됨
                  </p>
                  <ul className="space-y-2">
                    {rejected.map((app) => (
                      <li
                        key={app.id}
                        className="rounded-xl border border-rose-200/80 bg-rose-50/50 px-3 py-2.5 text-sm text-rose-950"
                      >
                        <span className="font-semibold">
                          {getRecordCategoryTitle(app.categoryId)}
                        </span>
                        {app.rejectedReason ? (
                          <span className="mt-1 block text-xs text-rose-800/90">
                            사유: {app.rejectedReason}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Link
            to="/records"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"
          >
            명예의 기록실로 이동
            <span aria-hidden>→</span>
          </Link>
        </section>

        <section
          className="rounded-3xl border-2 border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-sky-100 px-6 py-12 shadow-xl shadow-amber-200/30 ring-1 ring-amber-100/80"
          aria-label="영감을 나눈 횟수"
        >
          <p className="text-center text-base font-medium leading-relaxed text-slate-700 sm:text-lg">
            <span className="text-3xl sm:text-4xl" aria-hidden>
              🌟
            </span>
          </p>
          <p className="mt-4 text-center text-lg font-semibold text-slate-800 sm:text-xl">
            내가 누군가의 시작이 된 횟수
          </p>
          <p className="mt-3 flex items-baseline justify-center gap-1 text-center">
            <BumpingCount
              value={totalInspirationGiven}
              className="text-4xl font-bold tabular-nums text-amber-700 sm:text-5xl"
            />
            <span className="text-xl font-semibold text-amber-800 sm:text-2xl">
              회
            </span>
          </p>
          <p className="mx-auto mt-6 max-w-sm text-center text-sm text-slate-500">
            공동의 바다에 남긴 이야기가 누군가의 새 항해에 닿을 때마다, 이 숫자가
            함께 자랍니다.
          </p>
        </section>

        {adminMode && (
          <div className="mt-8 rounded-2xl border border-indigo-200 bg-white/90 p-4 shadow-md">
            <Link
              to="/admin"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110"
            >
              <Settings className="h-4 w-4" aria-hidden />
              ⚙️ 학생회 기록 심사소 (Admin)
            </Link>
          </div>
        )}
      </main>

      {lighthouseListKind && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            aria-label="닫기"
            onClick={() => setLighthouseListKind(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lighthouse-list-title"
            className="animate-modal-fade-in relative w-full max-w-md rounded-2xl border border-amber-200/90 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="lighthouse-list-title"
                className="text-base font-bold text-slate-900"
              >
                {lighthouseListKind === 'following'
                  ? '내가 따라가는 등대'
                  : '나를 등대로 삼은 선원'}
              </h2>
              <button
                type="button"
                onClick={() => setLighthouseListKind(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 max-h-[min(50vh,360px)] space-y-2 overflow-y-auto">
              {lighthouseListKind === 'following' ? (
                followingUserIds.length === 0 ? (
                  <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    아직 등대로 등록한 선원이 없어요.
                  </li>
                ) : (
                  followingUserIds.map((id) => (
                    <li key={id}>
                      <Link
                        to={`/mate/${encodeURIComponent(id)}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2.5 text-sm font-semibold text-sky-950 transition hover:bg-sky-100"
                        onClick={() => setLighthouseListKind(null)}
                      >
                        {resolveDisplayName(id)}
                        <span className="shrink-0 text-xs font-normal text-sky-800">
                          카드 →
                        </span>
                      </Link>
                    </li>
                  ))
                )
              ) : followerEdges.length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                  아직 나를 등대로 등록한 선원이 없어요.
                </li>
              ) : (
                followerEdges.map((e) => (
                  <li key={`${e.followerId}-${e.lighthouseId}`}>
                    <Link
                      to={`/mate/${encodeURIComponent(e.followerId)}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-sm font-semibold text-violet-950 transition hover:bg-violet-100"
                      onClick={() => setLighthouseListKind(null)}
                    >
                      {e.followerDisplayName}
                      <span className="shrink-0 text-xs font-normal text-violet-900">
                        카드 →
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* 추억함 */}
      {memoryOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/55 backdrop-blur-[2px]"
            aria-label="닫기"
            onClick={() => setMemoryOpen(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-title"
            className="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-b from-amber-50 via-[#faf8f5] to-stone-100 shadow-2xl shadow-amber-900/10"
          >
            <div className="border-b border-amber-200/60 bg-amber-100/40 px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Archive
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-800"
                    aria-hidden
                  />
                  <div>
                    <p
                      id="memory-title"
                      className="text-lg font-bold leading-snug text-amber-950"
                    >
                      {memoryOpen.goalName}
                    </p>
                    <p className="mt-1 text-xs font-medium text-amber-900/70">
                      닻을 올린 날 ·{' '}
                      {formatShortDate(memoryOpen.completedAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMemoryOpen(null)}
                  className="rounded-lg p-1 text-amber-900/60 hover:bg-amber-200/50"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-900/75">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                이 항해의 회고와 파도·순풍 기록을 그대로 보관했어요.
              </p>
            </div>

            <div className="max-h-[min(65vh,520px)] overflow-y-auto px-5 py-4">
              <section className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900/70">
                  마지막 회고
                </h3>
                <div className="mt-2 rounded-2xl border border-amber-200/70 bg-white/70 px-4 py-3 shadow-inner shadow-amber-100/40">
                  {memoryOpen.finalRetrospective?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                      {memoryOpen.finalRetrospective}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      영감의 이정표에 남긴 회고가 없거나, 기록 신청으로 바로
                      넘어간 항해일 수 있어요.
                    </p>
                  )}
                </div>
              </section>

              {memoryOpen.subGoal.trim() ? (
                <section className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900/70">
                    그때의 소목표
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 text-sm text-slate-700">
                    {memoryOpen.subGoal}
                  </p>
                </section>
              ) : null}

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900/70">
                  여정 일지 ({memoryOpen.diaryEntries.length})
                </h3>
                {memoryOpen.diaryEntries.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    저장된 일지가 없어요.
                  </p>
                ) : (
                  <ol className="relative mt-3 space-y-4 border-l-2 border-amber-300/60 pl-4">
                    {sortedMemoryDiary(memoryOpen).map((entry) => (
                      <li key={entry.id} className="relative">
                        <span
                          className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400 shadow-sm"
                          aria-hidden
                        />
                        <div className="rounded-xl border border-amber-100/90 bg-white/80 px-3 py-2.5 shadow-sm">
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                            <time dateTime={entry.createdAt}>
                              {formatShortDate(entry.createdAt)}
                            </time>
                            <span className="rounded-full bg-amber-100/80 px-2 py-0.5 font-medium text-amber-950">
                              {TAG_LABEL[entry.tag]}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                            {entry.body}
                          </p>
                          {entry.attachments &&
                            entry.attachments.length > 0 && (
                              <div className="mt-2 grid grid-cols-3 gap-1.5">
                                {entry.attachments.map((a) => (
                                  <div
                                    key={a.id}
                                    className="relative aspect-square overflow-hidden rounded-lg bg-black/5"
                                  >
                                    {a.type === 'video' ? (
                                      <video
                                        src={logAttachmentSrc(a)}
                                        className="h-full w-full object-cover"
                                        controls
                                        playsInline
                                        preload="metadata"
                                      />
                                    ) : (
                                      <img
                                        src={logAttachmentSrc(a)}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto fixed bottom-24 right-3 z-40 flex flex-col items-end gap-1 opacity-[0.22] transition hover:opacity-100">
        <div className="flex items-center gap-2 rounded-md px-1 py-0.5 text-[10px] text-slate-500">
          <span className="select-none" id="admin-mode-label">
            관리자 모드
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={adminMode}
            aria-labelledby="admin-mode-label"
            onClick={() => setAdminMode(!adminMode)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              adminMode ? 'bg-indigo-500/80' : 'bg-slate-300/80'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                adminMode ? 'left-4' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
