import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import {
  approveApplication,
  getRecordCategoryTitle,
  rejectApplication,
  type RecordApplication,
} from '../data/gannessPersistence'
import { usePendingApplications } from '../hooks/useGannessStorage'
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

function MediaPreview({ app }: { app: RecordApplication }) {
  const items = app?.mediaItems ?? []
  const first = items[0]
  if (!first?.dataUrl) {
    return (
      <div className="flex aspect-video w-full max-w-xs items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
        첨부 없음
      </div>
    )
  }
  if (first.type === 'video') {
    return (
      <video
        src={first.dataUrl}
        className="max-h-48 w-full max-w-xs rounded-lg object-contain"
        controls
        playsInline
        preload="metadata"
      />
    )
  }
  return (
    <img
      src={first.dataUrl}
      alt=""
      className="max-h-48 w-full max-w-xs rounded-lg object-contain"
    />
  )
}

export default function AdminPage() {
  const pending = usePendingApplications()
  const [rejectTarget, setRejectTarget] = useState<RecordApplication | null>(
    null,
  )
  const [rejectReason, setRejectReason] = useState('')
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null)

  function handleApprove(id: string) {
    if (!window.confirm('이 신청을 승인하고 명예의 전당에 등재할까요?')) return
    const ok = approveApplication(id)
    if (!ok) window.alert('승인 처리에 실패했습니다.')
  }

  function confirmReject() {
    if (!rejectTarget) return
    rejectApplication(rejectTarget.id, rejectReason)
    setRejectTarget(null)
    setRejectReason('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50/30 to-sky-50 pb-36 pt-8">
      <MediaLightbox
        open={lightboxMedia != null}
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />
      <main className="mx-auto max-w-lg px-4 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/profile"
            className="rounded-lg p-2 text-slate-600 hover:bg-white/80"
            aria-label="프로필로"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
              ⚙️ 학생회 기록 심사소
            </h1>
            <p className="text-xs text-slate-500">Admin · pending 신청만 표시</p>
          </div>
        </header>

        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 py-16 text-center text-sm text-slate-600">
            심사 대기 중인 신청이 없습니다.
          </p>
        ) : (
          <ul className="space-y-5">
            {(pending ?? []).map((app, idx) => (
              <li
                key={app?.id ?? `pending-${idx}`}
                className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-lg shadow-indigo-100/40"
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">
                    신청 ID · {app?.id ?? '—'}
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {app?.applicantName ?? '—'}
                  </p>
                  <p className="mt-0.5 text-sm text-indigo-800">
                    {getRecordCategoryTitle(app?.categoryId ?? '')}
                  </p>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-[auto,1fr]">
                  <MediaPreview app={app} />
                  <div className="min-w-0 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        기록 수치
                      </span>
                      <p className="text-lg font-bold tabular-nums text-indigo-700">
                        {app?.recordValue ?? '—'}
                      </p>
                    </div>
                    {(app?.communityCheerTotal ?? 0) > 0 && (
                      <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
                          공동체 응원
                        </span>
                        <p className="mt-0.5 text-sm font-semibold text-amber-950">
                          제출 일지에 총{' '}
                          <span className="tabular-nums">
                            {app.communityCheerTotal}
                          </span>
                          번의 따뜻한 응원이 함께 기록되었습니다.
                        </p>
                        {app.communityCheerByEmoji &&
                          Object.keys(app.communityCheerByEmoji).length > 0 && (
                            <p className="mt-1 text-xs text-amber-900/75">
                              {Object.entries(app.communityCheerByEmoji)
                                .filter(([, n]) => n > 0)
                                .map(([e, n]) => `${e}×${n}`)
                                .join(' · ')}
                            </p>
                          )}
                      </div>
                    )}
                    {(app?.voyageDiarySnapshots?.length ?? 0) > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          불러온 나의 바다 일지 · 미디어 타임라인
                        </span>
                        <div className="relative mt-2">
                          <span
                            className={`pointer-events-none absolute bottom-0 left-[13px] top-2 w-px ${timelineRailGradient(
                              'surface',
                            )}`}
                            aria-hidden
                          />
                          <ol className="relative space-y-4 text-sm">
                            {(app?.voyageDiarySnapshots ?? []).map((row) => (
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
                                  className={`min-w-0 flex-1 rounded-2xl border p-3 ${timelineEntryArticleClassFlat(
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
                                          onOpen={setLightboxMedia}
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
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        전체 소감
                      </span>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {app?.journeyNote?.trim() ? app.journeyNote : '—'}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      접수 ·{' '}
                      {app?.createdAt
                        ? new Date(app.createdAt).toLocaleString('ko-KR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>

                {(app?.mediaItems ?? []).length > 1 && (
                  <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    외 증명 파일 {(app?.mediaItems ?? []).length - 1}개
                  </p>
                )}

                <div className="flex gap-2 border-t border-slate-100 p-3">
                  <button
                    type="button"
                    onClick={() => app?.id && handleApprove(app.id)}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    ✅ 승인
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (app) {
                        setRejectTarget(app)
                        setRejectReason('')
                      }
                    }}
                    className="flex-1 rounded-xl border-2 border-rose-200 bg-rose-50 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-100"
                  >
                    ❌ 반려
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {rejectTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="닫기"
            onClick={() => {
              setRejectTarget(null)
              setRejectReason('')
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="relative w-full max-w-md rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="reject-title" className="pr-10 text-lg font-bold text-slate-900">
              신청 반려
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {rejectTarget?.applicantName ?? '신청자'}님 신청을 반려합니다. 사유는
              내부 기록용으로 저장됩니다.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-bold text-slate-500">반려 사유</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="간단히 적어 주세요."
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null)
                  setRejectReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
              >
                반려 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
