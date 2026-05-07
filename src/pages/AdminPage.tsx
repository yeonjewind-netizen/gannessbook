import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
  X,
} from 'lucide-react'
import {
  getRecordCategoryTitle,
  ingestAndApproveRemoteApplication,
  purgeApplicationLocally,
  storedMediaSrc,
} from '../data/gannessPersistence'
import {
  approveApplicationToRecord,
  deleteRecordApplication,
  listRecordApplicationsByStatus,
  listUsersForAdminPanel,
  patchRecordApplicationStatus,
  setUserAdminFlag,
  type AdminUserRow,
  type FirestoreRecordApplication,
} from '../lib/firestoreUtils'
import { useAuth } from '../context/AuthContext'
import MediaLightbox, { type LightboxMedia } from '../components/MediaLightbox'
import { DiaryMediaPreviewGrid } from '../components/DiaryMediaPreviewGrid'

type QueueActionTarget = FirestoreRecordApplication | null

function resolveCategoryTitle(app: FirestoreRecordApplication): string {
  const stored = app.categoryTitle?.trim()
  if (stored) return stored
  const local = getRecordCategoryTitle(app.categoryId).trim()
  if (local && local !== app.categoryId) return local
  return app.categoryId || '—'
}

function QueueMediaPreview({ app }: { app: FirestoreRecordApplication }) {
  const first = app.mediaItems[0]
  const src = first ? storedMediaSrc(first) : ''
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
        첨부 없음
      </div>
    )
  }
  if (first.type === 'video') {
    return (
      <video
        src={src}
        className="max-h-52 w-full rounded-lg object-contain"
        controls
        playsInline
        preload="metadata"
      />
    )
  }
  return <img src={src} alt="" className="max-h-52 w-full rounded-lg object-contain" />
}

export default function AdminPage() {
  const { user, loading, isAdmin } = useAuth()
  const [pendingQueue, setPendingQueue] = useState<FirestoreRecordApplication[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [usersQuery, setUsersQuery] = useState('')
  const [screenLoading, setScreenLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<QueueActionTarget>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null)

  const refreshAll = useCallback(async () => {
    setScreenLoading(true)
    try {
      const [queue, allUsers] = await Promise.all([
        listRecordApplicationsByStatus('pending'),
        listUsersForAdminPanel(),
      ])
      setPendingQueue(queue)
      setUsers(allUsers)
    } catch (error) {
      console.error('관리자 데이터 로드 실패:', error)
      window.alert('관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setScreenLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void refreshAll()
  }, [isAdmin, refreshAll])

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      )
    })
  }, [users, usersQuery])

  const approve = useCallback(
    async (app: FirestoreRecordApplication) => {
      const categoryTitle = resolveCategoryTitle(app)
      if (
        !window.confirm(
          `이 신청을 승인할까요?\n\n[${categoryTitle}]\n${app.applicantName} · ${app.recordValue}`,
        )
      )
        return
      setSavingId(app.id)
      try {
        // 1) Firestore: records 컬렉션에 새 문서 생성하거나 timeline arrayUnion
        //    + 신청서 상태를 approved 로 갱신
        await approveApplicationToRecord(app, { categoryTitle })

        // 2) 관리자 본인 화면(localStorage 기반 명예의 전당)에도 즉시 반영
        try {
          ingestAndApproveRemoteApplication({
            id: app.id,
            applicantName: app.applicantName,
            categoryId: app.categoryId,
            recordValue: app.recordValue,
            journeyNote: app.journeyNote,
            ...(app.rejectedReason ? { rejectedReason: app.rejectedReason } : {}),
            mediaItems: app.mediaItems,
            createdAt: app.createdAt,
            ...(app.voyageDiarySnapshots
              ? { voyageDiarySnapshots: app.voyageDiarySnapshots }
              : {}),
            ...(app.communityCheerTotal != null
              ? { communityCheerTotal: app.communityCheerTotal }
              : {}),
            ...(app.communityCheerByEmoji
              ? { communityCheerByEmoji: app.communityCheerByEmoji }
              : {}),
            ...(app.dailyRoutines ? { dailyRoutines: app.dailyRoutines } : {}),
            ...(app.crisisMethodology
              ? { crisisMethodology: app.crisisMethodology }
              : {}),
            ...(app.submitterUserId
              ? { submitterUserId: app.submitterUserId }
              : {}),
            categoryTitle,
          })
        } catch (mirrorErr) {
          console.warn('localStorage 동기화 실패(무시):', mirrorErr)
        }

        await refreshAll()
      } catch (error) {
        console.error('신청 승인 실패:', error)
        window.alert('승인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        setSavingId(null)
      }
    },
    [refreshAll],
  )

  const confirmReject = useCallback(async () => {
    if (!rejectTarget) return
    setSavingId(rejectTarget.id)
    try {
      await patchRecordApplicationStatus(rejectTarget.id, {
        status: 'rejected',
        rejectedReason: rejectReason,
      })
      setRejectTarget(null)
      setRejectReason('')
      await refreshAll()
    } catch (error) {
      console.error('신청 반려 실패:', error)
      window.alert('반려 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSavingId(null)
    }
  }, [rejectReason, rejectTarget, refreshAll])

  const removeApplication = useCallback(
    async (app: FirestoreRecordApplication) => {
      if (
        !window.confirm(
          '정말 이 신청을 영구적으로 삭제하시겠습니까?\n\n반려와 달리 신청서 자체가 DB에서 사라지며 복구할 수 없습니다.',
        )
      )
        return
      setSavingId(app.id)
      try {
        await deleteRecordApplication(app.id)
        try {
          purgeApplicationLocally(app.id)
        } catch (mirrorErr) {
          console.warn('localStorage 동기화 실패(무시):', mirrorErr)
        }
        await refreshAll()
      } catch (error) {
        console.error('신청 삭제 실패:', error)
        window.alert('삭제 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        setSavingId(null)
      }
    },
    [refreshAll],
  )

  const toggleAdmin = useCallback(
    async (row: AdminUserRow, next: boolean) => {
      if (user?.uid === row.uid && !next) {
        window.alert('본인 관리자 권한은 이 화면에서 해제할 수 없습니다.')
        return
      }
      setSavingId(row.uid)
      try {
        await setUserAdminFlag(row.uid, next)
        await refreshAll()
      } catch (error) {
        console.error('관리자 권한 변경 실패:', error)
        window.alert('권한 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        setSavingId(null)
      }
    },
    [refreshAll, user?.uid],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        관리자 권한 확인 중...
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50/30 to-sky-50 pb-36 pt-8">
      <MediaLightbox
        open={lightboxMedia != null}
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/profile"
            className="rounded-lg p-2 text-slate-600 hover:bg-white/80"
            aria-label="프로필로"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">⚙️ 관리자 전용 페이지</h1>
            <p className="text-xs text-slate-500">심사 대기열 · 권한 관리</p>
          </div>
        </header>

        <section className="mb-7 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-indigo-900">심사 대기열</h2>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
              disabled={screenLoading}
            >
              새로고침
            </button>
          </div>

          {screenLoading ? (
            <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">로딩 중...</p>
          ) : pendingQueue.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
              심사 대기 중인 신청이 없습니다.
            </p>
          ) : (
            <ul className="space-y-4">
              {pendingQueue.map((app) => {
                const title = resolveCategoryTitle(app)
                return (
                  <li
                    key={app.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-[16rem,1fr]">
                      <QueueMediaPreview app={app} />
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">신청 ID · {app.id}</p>
                        <p className="text-base font-bold text-slate-900">
                          {app.applicantName}
                        </p>
                        <p className="text-sm text-indigo-800">{title}</p>
                        <p className="text-sm font-semibold text-slate-700">
                          기록 수치 · {app.recordValue}
                        </p>
                        <p className="text-xs text-slate-500">
                          접수 ·{' '}
                          {app.createdAt
                            ? new Date(app.createdAt).toLocaleString('ko-KR', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </p>
                        {app.journeyNote && (
                          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            {app.journeyNote}
                          </p>
                        )}
                        {app.mediaItems.length > 0 && (
                          <DiaryMediaPreviewGrid
                            items={app.mediaItems.map((m) => ({
                              type: m.type,
                              src: storedMediaSrc(m),
                            }))}
                            layout="compact"
                            rowKeyPrefix={app.id}
                            onOpen={setLightboxMedia}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void approve(app)}
                        disabled={savingId === app.id}
                        className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTarget(app)
                          setRejectReason('')
                        }}
                        disabled={savingId === app.id}
                        className="rounded-xl border-2 border-rose-200 bg-rose-50 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                      >
                        반려
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeApplication(app)}
                        disabled={savingId === app.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        삭제
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-sky-900">권한 관리</h2>
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" aria-hidden />
            <input
              type="text"
              value={usersQuery}
              onChange={(e) => setUsersQuery(e.target.value)}
              placeholder="이름/이메일/UID 검색"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>

          <ul className="space-y-2">
            {filteredUsers.map((row) => (
              <li
                key={row.uid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.displayName}</p>
                  <p className="truncate text-xs text-slate-500">{row.email || row.uid}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                      row.isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {row.isAdmin ? '관리자' : '일반'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleAdmin(row, !row.isAdmin)}
                    disabled={savingId === row.uid}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {row.isAdmin ? (
                      <>
                        <ShieldX className="h-3.5 w-3.5" aria-hidden />
                        권한 해제
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        권한 부여
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
          <p className="font-bold">보안 규칙 안내 (Firestore Security Rules)</p>
          <p className="mt-1 leading-relaxed">
            클라이언트 UI 차단만으로는 안전하지 않습니다. 서버 규칙에서{' '}
            <code>request.auth != null</code>과 관리자 여부
            (예: <code>get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true</code>)
            를 반드시 검사해서, 다음 쓰기는 관리자에게만 허용해야 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>
              <code>recordApplications/&#123;id&#125;</code> — status/rejectedReason 변경, delete
            </li>
            <li>
              <code>records/&#123;id&#125;</code> — create / update(timeline, currentHolder) /
              delete
            </li>
            <li>
              <code>users/&#123;uid&#125;</code> — <code>isAdmin</code> 필드 변경
            </li>
          </ul>
        </section>
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
            <h2 id="reject-title" className="pr-10 text-lg font-bold text-slate-900">신청 반려</h2>
            <p className="mt-1 text-sm text-slate-600">반려 사유를 입력해 주세요.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="간단히 적어 주세요."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
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
                onClick={() => void confirmReject()}
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
