/**
 * 공동의 바다 등에서 글(postId)별로 누적된 응원 이모지 — 일지 id와 같으면 나의 바다 일지와 연동
 */

export const CHEER_REACTIONS_BY_POST_KEY = 'ganness-book:cheer-reactions-by-post'

/** 피커·집계에 쓰는 기본 응원 이모지 5종 */
export const DEFAULT_CHEER_EMOJIS = ['❤️', '🤣', '🫡', '😥', '😝'] as const

export type DefaultCheerEmoji = (typeof DEFAULT_CHEER_EMOJIS)[number]

export type CheerByPost = Record<string, Record<string, number>>

export function loadCheerReactions(): CheerByPost {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CHEER_REACTIONS_BY_POST_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const out: CheerByPost = {}
    for (const [postId, emojis] of Object.entries(data)) {
      if (!postId || typeof emojis !== 'object' || !emojis) continue
      const row: Record<string, number> = {}
      for (const [e, n] of Object.entries(emojis)) {
        if (typeof n === 'number' && n > 0 && Number.isFinite(n))
          row[e] = Math.floor(n)
      }
      if (Object.keys(row).length > 0) out[postId] = row
    }
    return out
  } catch {
    return {}
  }
}

export function saveCheerReactions(map: CheerByPost): void {
  try {
    localStorage.setItem(CHEER_REACTIONS_BY_POST_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** 여러 일지 id에 달린 기본 5종 응원만 합산 */
export function aggregateDefaultCheersForDiaryIds(
  entryIds: string[],
  map: CheerByPost = loadCheerReactions(),
): {
  total: number
  byEmoji: Record<string, number>
  ranked: { emoji: string; count: number }[]
  bestEmoji: string | null
} {
  const byEmoji: Record<string, number> = {}
  let total = 0
  const idSet = new Set(entryIds)

  for (const id of idSet) {
    const row = map[id]
    if (!row) continue
    for (const emoji of DEFAULT_CHEER_EMOJIS) {
      const n = row[emoji]
      if (typeof n === 'number' && n > 0) {
        const add = Math.floor(n)
        byEmoji[emoji] = (byEmoji[emoji] ?? 0) + add
        total += add
      }
    }
  }

  const ranked = Object.entries(byEmoji)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))

  const bestEmoji = ranked.length > 0 ? ranked[0].emoji : null

  return { total, byEmoji, ranked, bestEmoji }
}
