import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LighthouseToggleButton from '../components/LighthouseToggleButton'
import {
  LIGHTHOUSE_UPDATES_EVENT,
  resolveDisplayName,
} from '../voyage/lighthouseStorage'

export default function ShipmateProfilePage() {
  const { userId: rawId } = useParams<{ userId: string }>()
  const userId = rawId ? decodeURIComponent(rawId) : ''
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    return () => window.removeEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
  }, [])

  const displayName = useMemo(() => {
    void tick
    return resolveDisplayName(userId)
  }, [userId, tick])

  if (!userId.trim()) {
    return (
      <div className="min-h-screen bg-slate-50 pb-28 pt-10">
        <main className="mx-auto max-w-lg px-4 text-center text-slate-600">
          <p>선원 정보를 찾을 수 없어요.</p>
          <Link to="/shared" className="mt-4 inline-block text-sky-700 underline">
            공동의 바다로
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-indigo-50/40 pb-28 pt-8">
      <main className="mx-auto max-w-lg px-4 sm:px-6">
        <Link
          to="/shared"
          className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          공동의 바다
        </Link>

        <div className="rounded-3xl border border-sky-200/90 bg-white/90 p-6 shadow-lg shadow-sky-100/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
            선원 카드
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{displayName}</h1>
          <p className="mt-2 text-xs text-slate-500">
            역할 모델로 삼고 함께 자라고 싶은 동료예요. 등대로 등록하면 피드에서 모아볼 수
            있어요.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <LighthouseToggleButton
              targetUserId={userId}
              targetDisplayName={displayName}
              className="min-h-[44px] flex-1 sm:flex-none"
            />
          </div>
        </div>
      </main>
    </div>
  )
}
