import { loadMyVoyage } from './myVoyageStorage'
import { loadVoyageEntries } from './voyageEntries'
import type { LogEntry } from './types'

/** 현재 목표(항차)에 묶인 나의 바다 일지만 반환 */
export function getVoyageEntriesForCurrentGoal(): LogEntry[] {
  const p = loadMyVoyage()
  const leg = p.voyageLegId?.trim()
  if (!p.goalName.trim() || !leg) return []
  return loadVoyageEntries().filter((e) => e.voyageLegId === leg)
}
