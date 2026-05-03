const SHARED_INSPIRED_DELTAS_KEY = 'ganness-book:shared-feed-inspired-deltas'

export function loadSharedInspiredDeltas(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SHARED_INSPIRED_DELTAS_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number' && v > 0 && Number.isFinite(v)) out[k] = Math.floor(v)
    }
    return out
  } catch {
    return {}
  }
}

export function persistSharedInspiredDeltas(deltas: Record<string, number>): void {
  localStorage.setItem(SHARED_INSPIRED_DELTAS_KEY, JSON.stringify(deltas))
}

/** 바통 터치 1회당 원본 공유 글 id에 대한 추가 영감 횟수 +1 */
export function incrementSharedFeedInspiredDelta(postId: string): Record<string, number> {
  const cur = loadSharedInspiredDeltas()
  const next = { ...cur, [postId]: (cur[postId] ?? 0) + 1 }
  persistSharedInspiredDeltas(next)
  return next
}
