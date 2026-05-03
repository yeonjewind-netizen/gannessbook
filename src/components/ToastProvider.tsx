import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { TOAST_EVENT, type ToastPayload } from '../voyage/toastEvents'
import { playToastChime } from '../voyage/playToastChime'

type ToastItem = { id: string; payload: ToastPayload }

type ToastContextValue = {
  /** 수동으로 토스트 추가 (알림 저장소와 동일 UX) */
  showToast: (payload: ToastPayload) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function toastLabel(payload: ToastPayload): { icon: string; text: string } {
  switch (payload.kind) {
    case 'cheer':
      return {
        icon: '❤️',
        text: `${payload.name}님이 응원을 보냈습니다!`,
      }
    case 'record_approved':
      return {
        icon: '🏆',
        text: '기록이 명예의 전당에 등재되었습니다!',
      }
    case 'baton':
      return {
        icon: '✨',
        text: '누군가 선원님의 기록에서 영감을 얻었습니다!',
      }
    case 'mentor_routine':
      return {
        icon: '🌊',
        text: '선배의 파도를 함께 넘었습니다!',
      }
    case 'whale_tribute':
      return {
        icon: '🐋',
        text: '거친 파도를 견뎌낸 선원님, 당신의 용기가 이 별을 가장 붉게 빛나게 했습니다.',
      }
    case 'voyage_archived':
      return {
        icon: '📦',
        text: '항해가 성공적으로 기록실에 보관되었습니다.',
      }
    case 'sync_error':
      return {
        icon: '☁️',
        text: payload.message,
      }
  }
}

function ToastViewport({
  items,
}: {
  items: ToastItem[]
}) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-4 z-[110] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-3 sm:top-5"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((row) => {
        const { icon, text } = toastLabel(row.payload)
        return (
          <div
            key={row.id}
            className="animate-toast-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/40 bg-gradient-to-br from-white/35 via-white/20 to-sky-50/25 px-4 py-3 text-left shadow-[0_12px_40px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-2xl transition-[opacity,transform] dark:from-slate-900/45 dark:via-slate-900/30 dark:to-slate-800/25 dark:border-white/15 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            role="status"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/30 text-xl shadow-inner shadow-white/20 backdrop-blur-sm dark:bg-white/10"
              aria-hidden
            >
              {icon}
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
              {text}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    (payload: ToastPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      playToastChime()
      setItems((prev) => {
        const next = [...prev, { id, payload }]
        return next.slice(-5)
      })
      window.setTimeout(() => remove(id), 3000)
    },
    [remove],
  )

  useEffect(() => {
    function onPrompt(e: Event) {
      const ce = e as CustomEvent<ToastPayload>
      if (ce.detail) showToast(ce.detail)
    }
    window.addEventListener(TOAST_EVENT, onPrompt)
    return () => window.removeEventListener(TOAST_EVENT, onPrompt)
  }, [showToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast는 ToastProvider 안에서만 사용할 수 있습니다.')
  }
  return ctx
}

export type { ToastPayload } from '../voyage/toastEvents'
