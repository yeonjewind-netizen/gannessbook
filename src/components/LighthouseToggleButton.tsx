import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isFollowingLighthouse,
  LIGHTHOUSE_UPDATES_EVENT,
  toggleLighthouse,
} from '../voyage/lighthouseStorage'
import { getOrCreateUserId } from '../voyage/userIdentity'

type LighthouseToggleButtonProps = {
  targetUserId: string
  targetDisplayName: string
  className?: string
  /** 내 프로필과 같으면 버튼 숨김 */
  hideIfSelf?: boolean
}

export default function LighthouseToggleButton({
  targetUserId,
  targetDisplayName,
  className = '',
  hideIfSelf = true,
}: LighthouseToggleButtonProps) {
  const [rev, setRev] = useState(0)
  const myId = getOrCreateUserId()
  const tid = targetUserId.trim()

  useEffect(() => {
    const bump = () => setRev((r) => r + 1)
    window.addEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    return () => window.removeEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
  }, [])

  const active = useMemo(
    () => (tid ? isFollowingLighthouse(tid) : false),
    [tid, rev],
  )

  const onClick = useCallback(() => {
    if (!tid || tid === myId) return
    toggleLighthouse(tid, targetDisplayName.trim() || '선원')
    setRev((r) => r + 1)
  }, [tid, myId, targetDisplayName])

  if (!tid) return null
  if (hideIfSelf && tid === myId) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold shadow-sm transition active:scale-[0.98] ${
        active
          ? 'border-amber-300/90 bg-amber-50 text-amber-950 hover:bg-amber-100'
          : 'border-sky-300/90 bg-sky-50 text-sky-950 hover:bg-sky-100'
      } ${className}`}
    >
      <span aria-hidden>🏮</span>
      {active ? '등대 해제' : '등대 등록'}
    </button>
  )
}
