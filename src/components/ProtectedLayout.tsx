import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdminMode } from '../hooks/useGannessStorage'
import { flushRoutineAchievementInboxForCurrentUser } from '../voyage/routineAchievementInbox'
import { BottomNav } from './BottomNav'
import { NotificationBell } from './NotificationBell'

function RoutineInboxBoot() {
  useEffect(() => {
    flushRoutineAchievementInboxForCurrentUser()
  }, [])
  return null
}

function AdminEntryChip() {
  const { enabled } = useAdminMode()
  const location = useLocation()
  if (!enabled || location.pathname === '/admin') return null
  return (
    <Link
      to="/admin"
      className="fixed bottom-[4.75rem] right-3 z-[55] max-w-[calc(100vw-1.5rem)] truncate rounded-full border border-indigo-200/90 bg-white/95 px-3 py-2 text-center text-[11px] font-bold text-indigo-800 shadow-lg shadow-indigo-200/50 backdrop-blur-sm transition hover:bg-indigo-50 sm:text-xs"
    >
      ⚙️ 학생회 기록 심사소 (Admin)
    </Link>
  )
}

/**
 * 로그인한 사용자만 하위 라우트·하단 내비·알림을 볼 수 있습니다.
 */
export function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-sky-50">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
            aria-hidden
          />
          <p className="text-sm font-medium">세션 확인 중…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <div className="relative min-h-svh">
      <RoutineInboxBoot />
      <Outlet />
      <AdminEntryChip />
      <NotificationBell />
      <BottomNav />
    </div>
  )
}
