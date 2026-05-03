import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import {
  NOTIFICATIONS_EVENT,
  loadNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from '../voyage/notificationsStorage'
import { flushRoutineAchievementInboxForCurrentUser } from '../voyage/routineAchievementInbox'

function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*(.+)\*\*$/.exec(part)
        if (m) {
          return (
            <strong key={i} className="font-bold text-slate-900">
              {m[1]}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function NotificationBell() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>(() =>
    loadNotifications(),
  )
  const unread = items.filter((n) => !n.isRead).length
  const wrapRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    flushRoutineAchievementInboxForCurrentUser()
    setItems(loadNotifications())
  }, [])

  useEffect(() => {
    refresh()
    function onStorage(e: StorageEvent) {
      if (e.key === 'ganness-book:notifications') refresh()
    }
    function onCustom() {
      refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(NOTIFICATIONS_EVENT, onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(NOTIFICATIONS_EVENT, onCustom)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    markAllNotificationsRead()
    refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = wrapRef.current
      if (!el?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  if (pathname === '/achieve') return null

  return (
    <div ref={wrapRef} className="fixed right-3 top-3 z-[65] sm:right-4 sm:top-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-md shadow-slate-200/80 backdrop-blur-sm transition hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`알림 ${unread > 0 ? `${unread}건 읽지 않음` : '없음'}`}
      >
        <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="알림"
          className="absolute right-0 top-full z-[66] mt-2 w-[min(calc(100vw-1.5rem),20rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-300/40"
        >
          <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2">
            <p className="text-xs font-bold text-slate-800">알림</p>
            <p className="text-[10px] text-slate-500">
              열면 모두 읽음 처리됩니다
            </p>
          </div>
          <ul className="max-h-[min(70vh,22rem)] overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-slate-500">
                새 알림이 없습니다.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-700 last:border-b-0 ${
                    !n.isRead ? 'bg-sky-50/50' : ''
                  }`}
                >
                  <p>
                    <FormattedMessage text={n.message} />
                  </p>
                  <time
                    className="mt-1 block text-[10px] text-slate-400"
                    dateTime={n.createdAt}
                  >
                    {new Date(n.createdAt).toLocaleString('ko-KR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
