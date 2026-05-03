import { getOrCreateUserId } from './userIdentity'
import { loadProfileApplicantName } from './profileApplicantStorage'

/** 내가 등대로 삼은 선원 userId 목록 (요구 사항) */
export const LIGHTHOUSES_KEY = 'ganness-book:lighthouses'

/** UI용 — userId → 마지막으로 본 표시 이름 */
const DISPLAY_LABELS_KEY = 'ganness-book:lighthouse-display-labels'

/** 나를 등대로 삼은 관계 추적 (동일 기기·localStorage 내 시뮬레이션) */
const FOLLOW_EDGES_KEY = 'ganness-book:lighthouse-follow-edges'

export const LIGHTHOUSE_UPDATES_EVENT = 'ganness-book:lighthouse-updates'

export type LighthouseFollowEdge = {
  lighthouseId: string
  followerId: string
  followerDisplayName: string
}

function notify() {
  window.dispatchEvent(new Event(LIGHTHOUSE_UPDATES_EVENT))
}

function parseIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch {
    return []
  }
}

function parseLabels(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === 'string' && val.trim()) out[k] = val.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

function parseEdges(raw: string | null): LighthouseFollowEdge[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    const out: LighthouseFollowEdge[] = []
    for (const row of v) {
      if (!row || typeof row !== 'object') continue
      const r = row as Partial<LighthouseFollowEdge>
      if (
        typeof r.lighthouseId === 'string' &&
        r.lighthouseId.trim() &&
        typeof r.followerId === 'string' &&
        r.followerId.trim() &&
        typeof r.followerDisplayName === 'string'
      ) {
        out.push({
          lighthouseId: r.lighthouseId.trim(),
          followerId: r.followerId.trim(),
          followerDisplayName: r.followerDisplayName.trim() || '선원',
        })
      }
    }
    return out
  } catch {
    return []
  }
}

export function loadLighthouses(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return parseIds(localStorage.getItem(LIGHTHOUSES_KEY))
  } catch {
    return []
  }
}

export function loadDisplayLabels(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return parseLabels(localStorage.getItem(DISPLAY_LABELS_KEY))
  } catch {
    return {}
  }
}

function saveDisplayLabels(labels: Record<string, string>) {
  try {
    localStorage.setItem(DISPLAY_LABELS_KEY, JSON.stringify(labels))
  } catch {
    /* ignore */
  }
}

export function loadFollowEdges(): LighthouseFollowEdge[] {
  if (typeof window === 'undefined') return []
  try {
    return parseEdges(localStorage.getItem(FOLLOW_EDGES_KEY))
  } catch {
    return []
  }
}

function saveFollowEdges(edges: LighthouseFollowEdge[]) {
  try {
    localStorage.setItem(FOLLOW_EDGES_KEY, JSON.stringify(edges))
  } catch {
    /* ignore */
  }
}

function saveLighthouseIds(ids: string[]) {
  try {
    localStorage.setItem(LIGHTHOUSES_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function rememberDisplayLabel(userId: string, displayName: string) {
  const t = userId.trim()
  const n = displayName.trim()
  if (!t || !n) return
  const labels = loadDisplayLabels()
  labels[t] = n
  saveDisplayLabels(labels)
}

/** 내가 userId를 등대로 등록했는지 */
export function isFollowingLighthouse(targetUserId: string): boolean {
  const id = targetUserId.trim()
  if (!id) return false
  return loadLighthouses().includes(id)
}

/**
 * 등대 등록/해제. targetDisplayName은 라벨 캐시에 저장됩니다.
 */
export function toggleLighthouse(
  targetUserId: string,
  targetDisplayName: string,
): boolean {
  const target = targetUserId.trim()
  if (!target) return false

  const myId = getOrCreateUserId()
  if (target === myId) return false

  rememberDisplayLabel(target, targetDisplayName)

  let ids = [...loadLighthouses()]
  const edges = loadFollowEdges()
  const myName = loadProfileApplicantName().trim() || '선원'

  const idx = ids.indexOf(target)
  if (idx >= 0) {
    ids.splice(idx, 1)
    const nextEdges = edges.filter(
      (e) =>
        !(
          e.lighthouseId === target &&
          e.followerId === myId
        ),
    )
    saveFollowEdges(nextEdges)
    saveLighthouseIds(ids)
    notify()
    return false
  }

  ids.push(target)
  const filtered = edges.filter(
    (e) =>
      !(
        e.lighthouseId === target &&
        e.followerId === myId
      ),
  )
  filtered.push({
    lighthouseId: target,
    followerId: myId,
    followerDisplayName: myName,
  })
  saveFollowEdges(filtered)
  saveLighthouseIds(ids)
  notify()
  return true
}

/** 나를 등대로 삼은 선원 (동일 브라우저에서 등록된 역방향 관계만 집계) */
export function getFollowersOf(userId: string): LighthouseFollowEdge[] {
  const id = userId.trim()
  if (!id) return []
  return loadFollowEdges().filter((e) => e.lighthouseId === id)
}

export function resolveDisplayName(userId: string): string {
  const labels = loadDisplayLabels()
  if (labels[userId]?.trim()) return labels[userId].trim()
  return `선원 ${userId.slice(0, 8)}`
}
