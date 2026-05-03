export const MY_VOYAGE_STORAGE_KEY = 'ganness-book:my-voyage'

/** 레거시 기본값 — 마이그레이션 시 참고만 함 */
export const DEFAULT_MY_VOYAGE_GOAL =
  '2026 · 공연 연출 · 함께하는 졸업 무대'

export type VoyageMilestone = {
  id: string
  label: string
  completed: boolean
}

export type MyVoyageProfile = {
  goalName: string
  /** 공동의 바다 기록 작성자 닉네임 등 */
  inspiredBy: string | null
  /**
   * 첫 미완료 세부 단계 라벨 — milestones에서 자동 동기화(레거시·기록 아카이브용)
   */
  subGoal: string
  /** 0–100, milestones 완료 비율로 자동 계산해 동기화 */
  progressPercent: number
  /** 명예의 전당 카테고리 연동 id */
  linkedCategoryId: string | null
  /** 목표가 바뀔 때마다 갱신 — 일지가 어떤 항해에 속하는지 구분 */
  voyageLegId: string
  /** 세부 단계(마일스톤) — 달성률의 유일한 소스 */
  milestones: VoyageMilestone[]
}

const EMPTY_PROFILE: MyVoyageProfile = {
  goalName: '',
  inspiredBy: null,
  subGoal: '',
  progressPercent: 0,
  linkedCategoryId: null,
  voyageLegId: '',
  milestones: [],
}

export function getEmptyVoyageProfile(): MyVoyageProfile {
  return { ...EMPTY_PROFILE }
}

/** localStorage의 활성 항해 프로필만 비움 */
export function clearMyVoyageInStorage(): void {
  saveMyVoyage({ ...EMPTY_PROFILE })
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function milestoneProgressPercent(milestones: VoyageMilestone[]): number {
  const total = milestones.length
  if (total === 0) return 0
  const done = milestones.filter((m) => m.completed).length
  return clampPct(Math.round((100 * done) / total))
}

export function firstIncompleteMilestone(
  milestones: VoyageMilestone[],
): VoyageMilestone | null {
  return milestones.find((m) => !m.completed) ?? null
}

/** 다음 단계 문구(미완료 첫 단계). 없으면 빈 문자열 */
export function nextStepLabel(milestones: VoyageMilestone[]): string {
  return firstIncompleteMilestone(milestones)?.label?.trim() ?? ''
}

export function withSyncedVoyageDerived(
  p: MyVoyageProfile,
): MyVoyageProfile {
  const milestones = p.milestones ?? []
  return {
    ...p,
    milestones,
    progressPercent: milestoneProgressPercent(milestones),
    subGoal: nextStepLabel(milestones),
  }
}

function parseMilestones(raw: unknown): VoyageMilestone[] {
  if (!Array.isArray(raw)) return []
  const out: VoyageMilestone[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    if (!id || !label) continue
    const completed = o.completed === true
    out.push({ id, label, completed })
  }
  return out
}

/**
 * 아카이브 등에 저장된 JSON에서 프로필 복원 (레거시 마이그레이션 없음)
 */
export function profileFromSnapshotJson(raw: unknown): MyVoyageProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const goalName = typeof p.goalName === 'string' ? p.goalName.trim() : ''
  const inspiredByRaw = p.inspiredBy
  const inspiredBy =
    typeof inspiredByRaw === 'string' && inspiredByRaw.trim()
      ? inspiredByRaw.trim()
      : null
  const linkedRaw = p.linkedCategoryId
  const linkedCategoryId =
    typeof linkedRaw === 'string' && linkedRaw.trim()
      ? linkedRaw.trim()
      : null
  const voyageLegIdRaw = p.voyageLegId
  const voyageLegId =
    typeof voyageLegIdRaw === 'string' && voyageLegIdRaw.trim()
      ? voyageLegIdRaw.trim()
      : ''
  const milestones = parseMilestones(p.milestones)
  return withSyncedVoyageDerived({
    goalName,
    inspiredBy,
    subGoal: '',
    progressPercent: 0,
    linkedCategoryId,
    voyageLegId,
    milestones,
  })
}

export function loadMyVoyage(): MyVoyageProfile {
  if (typeof window === 'undefined') {
    return { ...EMPTY_PROFILE }
  }
  try {
    const raw = localStorage.getItem(MY_VOYAGE_STORAGE_KEY)
    if (!raw) {
      return { ...EMPTY_PROFILE }
    }
    const p = JSON.parse(raw) as Record<string, unknown>
    const goalName =
      typeof p.goalName === 'string' ? p.goalName.trim() : ''
    const inspiredByRaw = p.inspiredBy
    const inspiredBy =
      typeof inspiredByRaw === 'string' && inspiredByRaw.trim()
        ? inspiredByRaw.trim()
        : null
    const subGoal =
      typeof p.subGoal === 'string' ? p.subGoal.trim() : ''
    const progressPercent =
      typeof p.progressPercent === 'number'
        ? clampPct(p.progressPercent)
        : 0
    const linkedRaw = p.linkedCategoryId
    const linkedCategoryId =
      typeof linkedRaw === 'string' && linkedRaw.trim()
        ? linkedRaw.trim()
        : null
    const voyageLegIdRaw = p.voyageLegId
    const voyageLegId =
      typeof voyageLegIdRaw === 'string' && voyageLegIdRaw.trim()
        ? voyageLegIdRaw.trim()
        : ''

    let milestones = parseMilestones(p.milestones)
    if (milestones.length === 0 && goalName.trim() && subGoal.trim()) {
      milestones = [
        {
          id: `legacy-${Date.now()}`,
          label: subGoal,
          completed: progressPercent >= 100,
        },
      ]
    }

    return withSyncedVoyageDerived({
      goalName,
      inspiredBy,
      subGoal: '',
      progressPercent: 0,
      linkedCategoryId,
      voyageLegId,
      milestones,
    })
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

export function saveMyVoyage(profile: MyVoyageProfile): void {
  try {
    const synced = withSyncedVoyageDerived(profile)
    localStorage.setItem(MY_VOYAGE_STORAGE_KEY, JSON.stringify(synced))
  } catch {
    /* ignore */
  }
}
