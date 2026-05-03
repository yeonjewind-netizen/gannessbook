import { Anchor, Ship, Sparkles } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, loading, firebaseReady, signInWithGoogle } = useAuth()
  const location = useLocation()
  const rawFrom = (
    location.state as { from?: { pathname: string } } | null
  )?.from?.pathname
  const from =
    rawFrom && rawFrom !== '/login' ? rawFrom : '/'

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-sky-200 via-cyan-100 to-indigo-200">
        <div className="flex flex-col items-center gap-3 text-sky-900/80">
          <div
            className="h-10 w-10 animate-pulse rounded-full border-2 border-sky-400/60 border-t-transparent"
            aria-hidden
          />
          <p className="text-sm font-medium">항구에 정박하는 중…</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-b from-sky-300 via-cyan-200 to-indigo-300">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-1/3 h-64 w-[150%] rounded-[100%] bg-sky-400/30 blur-3xl" />
        <div className="absolute -right-1/4 bottom-1/4 h-72 w-[140%] rounded-[100%] bg-indigo-400/25 blur-3xl" />
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-sky-600/20 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-8 left-[8%] text-6xl opacity-25 drop-shadow-lg sm:bottom-12 sm:text-8xl"
        aria-hidden
      >
        🐋
      </div>
      <div
        className="pointer-events-none absolute bottom-16 right-[12%] text-4xl opacity-20 sm:text-6xl"
        aria-hidden
      >
        🌊
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-16">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-white/50 bg-white/25 px-4 py-2 text-sm font-semibold text-sky-950 shadow-md backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-amber-500" strokeWidth={2.5} />
          연대의 항해 · 간네스북
        </div>

        <Ship
          className="mb-4 h-14 w-14 text-sky-900/85 drop-shadow-md sm:h-16 sm:w-16"
          strokeWidth={1.25}
          aria-hidden
        />

        <h1 className="text-center text-3xl font-bold tracking-tight text-sky-950 drop-shadow-sm sm:text-4xl">
          승선을 환영합니다
        </h1>
        <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-sky-900/80 sm:text-base">
          구글 계정으로 로그인하면 나의 바다와 공동의 바다로 출항할 수 있어요.
          오늘의 파도를 함께 기록해 보세요.
        </p>

        {!firebaseReady && (
          <p className="mt-6 max-w-md rounded-2xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-center text-xs font-medium leading-relaxed text-amber-950 shadow-sm">
            Firebase 환경 변수가 비어 있어요.{' '}
            <code className="rounded bg-amber-100/80 px-1">.env.local</code>에{' '}
            <code className="rounded bg-amber-100/80 px-1">VITE_FIREBASE_*</code>{' '}
            값을 채운 뒤 개발 서버를 다시 시작해 주세요.
          </p>
        )}

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={!firebaseReady}
          className="mt-10 flex min-h-[3.25rem] w-full max-w-sm items-center justify-center gap-2.5 rounded-2xl border-2 border-sky-700/20 bg-white/90 px-6 py-4 text-base font-bold text-sky-900 shadow-xl shadow-sky-900/10 backdrop-blur-sm transition hover:border-sky-600/40 hover:bg-white hover:shadow-2xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Anchor className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          ⚓ 구글 계정으로 간네스북 승선하기
        </button>

        <p className="mt-8 text-center text-xs text-sky-900/55">
          로그인 시 이용 약관 및 개인정보 처리에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  )
}
