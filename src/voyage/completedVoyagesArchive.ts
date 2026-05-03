import type { MyVoyageProfile } from './myVoyageStorage'
import { profileFromSnapshotJson } from './myVoyageStorage'
import type { LogEntry } from './types'
import { parseStoredVoyageEntries } from './voyageEntries'
import { notifyProfileUpdates } from './profileApplicantStorage'

export const COMPLETED_VOYAGES_STORAGE_KEY = 'ganness-book:completed-voyages-archive'

export type CompletedVoyageArchiveEntry = {
  id: string
  goalName: string
  completedAt: string
  voyageLegId: string
  linkedCategoryId: string | null
  progressPercent: number
  subGoal: string
  finalRetrospective: string | null
  diaryEntries: LogEntry[]
  /**
   * 완료 시점의 활성 목표 전체(마일스톤 포함). 구 아카이브 항목에는 없을 수 있음.
   */
  activeGoalSnapshot?: MyVoyageProfile | null
}

function normalizeDiaryEntries(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return []
  return parseStoredVoyageEntries(JSON.stringify(raw))
}

function safeParseArchive(raw: string | null): CompletedVoyageArchiveEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: CompletedVoyageArchiveEntry[] = []
    for (const row of data) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id.trim() : ''
      const goalName = typeof r.goalName === 'string' ? r.goalName : ''
      const completedAt = typeof r.completedAt === 'string' ? r.completedAt : ''
      const voyageLegId = typeof r.voyageLegId === 'string' ? r.voyageLegId : ''
      if (!id || !completedAt) continue
      const linkedRaw = r.linkedCategoryId
      const linkedCategoryId =
        typeof linkedRaw === 'string' && linkedRaw.trim()
          ? linkedRaw.trim()
          : null
      const progressPercent =
        typeof r.progressPercent === 'number' && Number.isFinite(r.progressPercent)
          ? Math.max(0, Math.min(100, Math.round(r.progressPercent)))
          : 0
      const subGoal = typeof r.subGoal === 'string' ? r.subGoal : ''
      const retroRaw = r.finalRetrospective
      const finalRetrospective =
        typeof retroRaw === 'string' && retroRaw.trim() ? retroRaw.trim() : null
      const snapParsed =
        r.activeGoalSnapshot !== undefined && r.activeGoalSnapshot !== null
          ? profileFromSnapshotJson(r.activeGoalSnapshot)
          : null
      out.push({
        id,
        goalName: goalName.trim() || '나의 항해',
        completedAt,
        voyageLegId,
        linkedCategoryId,
        progressPercent,
        subGoal,
        finalRetrospective,
        diaryEntries: normalizeDiaryEntries(r.diaryEntries),
        ...(snapParsed ? { activeGoalSnapshot: snapParsed } : {}),
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadCompletedVoyagesArchive(): CompletedVoyageArchiveEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const list = safeParseArchive(
      localStorage.getItem(COMPLETED_VOYAGES_STORAGE_KEY),
    )
    return [...list].sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
  } catch {
    return []
  }
}

function saveCompletedVoyagesArchive(list: CompletedVoyageArchiveEntry[]) {
  try {
    localStorage.setItem(COMPLETED_VOYAGES_STORAGE_KEY, JSON.stringify(list))
    notifyProfileUpdates()
  } catch {
    /* ignore */
  }
}

export function appendCompletedVoyageArchive(payload: {
  completedAt: string
  goalName: string
  voyageLegId: string
  linkedCategoryId: string | null
  progressPercent: number
  subGoal: string
  diaryEntries: LogEntry[]
  /** 완료 직전 활성 목표·마일스톤 스냅샷 */
  activeGoalSnapshot: MyVoyageProfile
}): string {
  const id = crypto.randomUUID()
  const list = loadCompletedVoyagesArchive()
  list.push({
    id,
    goalName: payload.goalName.trim() || '나의 항해',
    completedAt: payload.completedAt,
    voyageLegId: payload.voyageLegId.trim(),
    linkedCategoryId: payload.linkedCategoryId,
    progressPercent: payload.progressPercent,
    subGoal: payload.subGoal,
    finalRetrospective: null,
    diaryEntries: payload.diaryEntries,
    activeGoalSnapshot: payload.activeGoalSnapshot,
  })
  saveCompletedVoyagesArchive(
    [...list].sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    ),
  )
  return id
}

/** Achievement 페이지에서 회고 저장 시, 같은 completedAt 항목에 반영 */
export function patchCompletedVoyageRetrospective(
  completedAt: string,
  text: string,
): void {
  const at = completedAt.trim()
  if (!at) return
  const list = safeParseArchive(
    localStorage.getItem(COMPLETED_VOYAGES_STORAGE_KEY),
  )
  const idx = list.findIndex((e) => e.completedAt === at)
  if (idx < 0) return
  list[idx] = {
    ...list[idx],
    finalRetrospective: text.trim() || null,
  }
  saveCompletedVoyagesArchive(list)
}
