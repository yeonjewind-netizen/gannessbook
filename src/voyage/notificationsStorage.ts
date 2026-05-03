/**
 * 단일 기기 알림 센터 — localStorage + 커스텀 이벤트로 탭 간 갱신
 */

import { loadProfileApplicantName } from './profileApplicantStorage'
import { emitToastPrompt } from './toastEvents'
import { loadVoyageEntries } from './voyageEntries'

export const NOTIFICATIONS_STORAGE_KEY = 'ganness-book:notifications'
export const NOTIFICATIONS_EVENT = 'ganness-book:notifications-updated'

const MAX_ITEMS = 80

export type NotificationType =
  | 'cheer'
  | 'record_approved'
  | 'baton_inspire'
  | 'routine_achievement'

export type NotificationItem = {
  id: string
  type: NotificationType
  message: string
  createdAt: string
  isRead: boolean
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT))
}

function safeParse(raw: string | null): NotificationItem[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: NotificationItem[] = []
    for (const row of data) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      const type = o.type
      const message = typeof o.message === 'string' ? o.message : ''
      const createdAt = typeof o.createdAt === 'string' ? o.createdAt : ''
      const isRead = Boolean(o.isRead)
      if (
        !id ||
        !message ||
        !createdAt ||
        (type !== 'cheer' &&
          type !== 'record_approved' &&
          type !== 'baton_inspire' &&
          type !== 'routine_achievement')
      )
        continue
      out.push({
        id,
        type,
        message,
        createdAt,
        isRead,
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return []
  return safeParse(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY))
}

export function saveNotifications(items: NotificationItem[]): void {
  try {
    const trimmed = [...items]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, MAX_ITEMS)
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(trimmed),
    )
    notifyNotificationsChanged()
  } catch {
    /* ignore */
  }
}

export function appendNotification(
  partial: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'> & {
    createdAt?: string
  },
): void {
  const list = loadNotifications()
  const item: NotificationItem = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: partial.type,
    message: partial.message,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    isRead: false,
  }
  saveNotifications([item, ...list])
}

export function markAllNotificationsRead(): void {
  const list = loadNotifications().map((n) => ({ ...n, isRead: true }))
  saveNotifications(list)
}

export function countUnreadNotifications(): number {
  return loadNotifications().filter((n) => !n.isRead).length
}

/** 응원 시: 내 일지인 경우에만 알림 */
export function maybeAppendCheerForMyDiary(postId: string): void {
  const mine = loadVoyageEntries().some((e) => e.id === postId)
  if (!mine) return
  const sender = loadProfileApplicantName().trim() || '동료 선원'
  appendNotification({
    type: 'cheer',
    message: `✨ **${sender}**님이 선원님의 일지에 응원을 보냈습니다!`,
  })
  emitToastPrompt({ kind: 'cheer', name: sender })
}

/** 바통 출항 시: 내 일지에서 영감을 받은 경우에만 알림 */
export function appendBatonInspiredOwnerNotification(starterName: string): void {
  const name = starterName.trim() || '한 선원'
  appendNotification({
    type: 'baton_inspire',
    message: `🚩 **${name}**님이 선원님의 기록에서 영감을 받아 새로운 항해를 시작했습니다!`,
  })
  emitToastPrompt({ kind: 'baton' })
}

/** 기록 승인 시 */
export function appendRecordApprovedNotification(categoryTitle: string): void {
  const t = categoryTitle.trim() || '기록'
  appendNotification({
    type: 'record_approved',
    message: `🏆 축하합니다! 신청하신 **${t}**이 학생회 승인을 거쳐 명예의 전당에 등재되었습니다.`,
  })
  emitToastPrompt({ kind: 'record_approved' })
}
