import type { LogEntry, MoodTag } from './types'
import { VOYAGE_ENTRIES_STORAGE_KEY } from './voyageEntries'

function isMoodTag(v: unknown): v is MoodTag {
  return v === 'passion' || v === 'wall' || v === 'direction'
}

/**
 * 공동의 바다 글 id가 나의 항해 일지 항목 id와 같을 때(연동 시) 영감 횟수 +1.
 * Mock id(sf-*)와 일치하지 않으면 조용히 무시.
 */
export function bumpUserLogInspiredCountIfExists(postId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(VOYAGE_ENTRIES_STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return

    let changed = false
    const next = data.map((item) => {
      if (!item || typeof item !== 'object') return item
      const e = item as Record<string, unknown>
      if (e.id !== postId) return item
      if (
        typeof e.id !== 'string' ||
        !isMoodTag(e.tag) ||
        typeof e.body !== 'string' ||
        typeof e.createdAt !== 'string'
      ) {
        return item
      }
      changed = true
      const base =
        typeof e.inspiredCount === 'number' && e.inspiredCount >= 0
          ? e.inspiredCount
          : 0
      const row: LogEntry = {
        id: e.id,
        tag: e.tag,
        body: e.body,
        createdAt: e.createdAt,
        inspiredCount: base + 1,
      }
      return row
    })

    if (changed)
      localStorage.setItem(VOYAGE_ENTRIES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
