import type { LogAttachment, LogEntry, MoodTag } from './types'

export function isMoodTag(v: unknown): v is MoodTag {
  return (
    v === 'passion' ||
    v === 'wall' ||
    v === 'direction' ||
    v === 'tailwind'
  )
}

export const VOYAGE_ENTRIES_STORAGE_KEY = 'ganness-book:voyage-entries'

export function parseStoredVoyageEntries(raw: string | null): LogEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .filter((item): item is Record<string, unknown> => {
        if (!item || typeof item !== 'object') return false
        const e = item as Record<string, unknown>
        return (
          typeof e.id === 'string' &&
          isMoodTag(e.tag) &&
          typeof e.body === 'string' &&
          typeof e.createdAt === 'string'
        )
      })
      .map((e) => {
        const inspiredCount =
          typeof e.inspiredCount === 'number' && e.inspiredCount >= 0
            ? Math.floor(e.inspiredCount)
            : 0
        const voyageLegIdRaw = e.voyageLegId
        const voyageLegId =
          typeof voyageLegIdRaw === 'string' && voyageLegIdRaw.trim()
            ? voyageLegIdRaw.trim()
            : undefined
        const attachmentsRaw = e.attachments
        let attachments: LogAttachment[] | undefined
        if (Array.isArray(attachmentsRaw)) {
          const atts: LogAttachment[] = []
          for (const a of attachmentsRaw) {
            if (!a || typeof a !== 'object') continue
            const o = a as Record<string, unknown>
            const aid = typeof o.id === 'string' ? o.id.trim() : ''
            const t = o.type === 'video' ? 'video' : o.type === 'image' ? 'image' : ''
            const mediaUrl =
              typeof o.mediaUrl === 'string' &&
              /^https?:\/\//i.test(o.mediaUrl.trim())
                ? o.mediaUrl.trim()
                : ''
            const dataUrl =
              typeof o.dataUrl === 'string' && o.dataUrl.startsWith('data:')
                ? o.dataUrl
                : ''
            if (!aid || !t || (!mediaUrl && !dataUrl)) continue
            atts.push({
              id: aid,
              type: t,
              ...(mediaUrl ? { mediaUrl } : {}),
              ...(dataUrl ? { dataUrl } : {}),
            })
          }
          if (atts.length > 0) attachments = atts
        }
        return {
          id: e.id as string,
          tag: e.tag as MoodTag,
          body: e.body as string,
          createdAt: e.createdAt as string,
          inspiredCount,
          ...(voyageLegId ? { voyageLegId } : {}),
          ...(attachments ? { attachments } : {}),
        }
      })
  } catch {
    return []
  }
}

export function loadVoyageEntries(): LogEntry[] {
  if (typeof window === 'undefined') return []
  return parseStoredVoyageEntries(
    localStorage.getItem(VOYAGE_ENTRIES_STORAGE_KEY),
  )
}

export function clearVoyageEntriesStorage(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VOYAGE_ENTRIES_STORAGE_KEY, JSON.stringify([]))
  } catch {
    /* ignore */
  }
}

/** 기존 일지에 leg 정보가 없을 때, 첫 항차 id로 한 번에 묶어 줌 */
export function migrateOrphanVoyageEntriesToLeg(legId: string): void {
  if (typeof window === 'undefined' || !legId.trim()) return
  const entries = loadVoyageEntries()
  let changed = false
  const next = entries.map((e) => {
    if (!e.voyageLegId) {
      changed = true
      return { ...e, voyageLegId: legId }
    }
    return e
  })
  if (changed) {
    try {
      localStorage.setItem(
        VOYAGE_ENTRIES_STORAGE_KEY,
        JSON.stringify(next),
      )
    } catch {
      /* ignore */
    }
  }
}
