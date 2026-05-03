/**
 * 등대(원작자)에게 전달할 「루틴 달성」 알림 대기열 — 같은 기기에서 targetUserId 인박스로 시뮬레이션
 */
import { appendNotification } from './notificationsStorage'
import { getOrCreateUserId } from './userIdentity'

const INBOX_KEY = 'ganness-book:routine-achievement-inbox'

type QueuedAchievement = {
  id: string
  fromUserId: string
  fromDisplayName: string
  routineLabel: string
  createdAt: string
}

type InboxMap = Record<string, QueuedAchievement[]>

function loadInbox(): InboxMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(INBOX_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (p == null || typeof p !== 'object' || Array.isArray(p)) return {}
    return p as InboxMap
  } catch {
    return {}
  }
}

function saveInbox(m: InboxMap): void {
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/**
 * 루틴 완료 시 원작자(originUserId) 쪽 알림 큐에 적재.
 * 본인 루틴(origin 없음)이면 noop.
 */
export function enqueueRoutineAchievementForOrigin(
  originUserId: string | null | undefined,
  routineLabel: string,
  fromDisplayName: string,
): void {
  const target = originUserId?.trim()
  if (!target) return
  const myId = getOrCreateUserId()
  if (target === myId) return

  const item: QueuedAchievement = {
    id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fromUserId: myId,
    fromDisplayName: fromDisplayName.trim() || '한 선원',
    routineLabel: routineLabel.trim() || '루틴',
    createdAt: new Date().toISOString(),
  }
  const all = loadInbox()
  all[target] = [...(all[target] ?? []), item]
  saveInbox(all)
}

/**
 * 현재 사용자가 로그인한 userId에 해당하는 대기 알림을 일반 알림함으로 흘려보냄(isRead=false).
 * 앱 진입 시·알림 새로고침 전에 호출.
 */
export function flushRoutineAchievementInboxForCurrentUser(): number {
  const myId = getOrCreateUserId()
  const all = loadInbox()
  const queue = all[myId]
  if (!queue?.length) return 0

  let n = 0
  for (const q of queue) {
    appendNotification({
      type: 'routine_achievement',
      message: `🏮 **${q.fromDisplayName}**님이 선원님이 남긴 루틴 「${q.routineLabel}」을 오늘 달성했습니다!`,
    })
    n++
  }
  delete all[myId]
  saveInbox(all)
  return n
}
