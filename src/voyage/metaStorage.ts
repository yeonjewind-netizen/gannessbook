import type { VoyageMeta } from './types'

export const META_STORAGE_KEY = 'ganness-book:voyage-meta'

export function saveVoyageMeta(meta: VoyageMeta): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

export function loadVoyageMeta(): VoyageMeta {
  if (typeof window === 'undefined') {
    return { isCompleted: false, finalRetrospective: null }
  }
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY)
    if (!raw) return { isCompleted: false, finalRetrospective: null }
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      isCompleted: Boolean(p.isCompleted),
      finalRetrospective:
        typeof p.finalRetrospective === 'string'
          ? p.finalRetrospective
          : null,
      completedAt:
        typeof p.completedAt === 'string' ? p.completedAt : undefined,
    }
  } catch {
    return { isCompleted: false, finalRetrospective: null }
  }
}
