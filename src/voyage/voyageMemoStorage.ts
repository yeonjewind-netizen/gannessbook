/**
 * 등대/프로필에서 참조하는 「항해사의 비망록」 — 승인된 기록 신청 시 공개 저장
 */

const LS_MEMOS = 'ganness-book:lighthouse-voyage-memos'

export const VOYAGE_MEMO_UPDATES_EVENT = 'ganness-book:voyage-memo-updates'

export type VoyageMemoPublic = {
  dailyRoutines: string[]
  crisisMethodology: string
  displayName: string
  updatedAt: number
}

function notifyMemo() {
  window.dispatchEvent(new Event(VOYAGE_MEMO_UPDATES_EVENT))
}

function loadAll(): Record<string, VoyageMemoPublic> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_MEMOS)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (p == null || typeof p !== 'object' || Array.isArray(p)) return {}
    return p as Record<string, VoyageMemoPublic>
  } catch {
    return {}
  }
}

function saveAll(m: Record<string, VoyageMemoPublic>) {
  try {
    localStorage.setItem(LS_MEMOS, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/** 여러 키(journeyId, userId 등)에 동일 비망록을 매핑 — 등대 id와 동일하게 조회 가능 */
export function publishVoyageMemo(
  keys: string[],
  memo: {
    dailyRoutines: string[]
    crisisMethodology: string
    displayName: string
  },
): void {
  const trimmedKeys = [...new Set(keys.map((k) => k.trim()).filter(Boolean))]
  if (!trimmedKeys.length) return
  const routines = memo.dailyRoutines.map((s) => s.trim()).filter(Boolean)
  const methodology = memo.crisisMethodology.trim()
  const displayName = memo.displayName.trim() || '선원'
  if (!routines.length && !methodology) return

  const all = loadAll()
  const ts = Date.now()
  const entry: VoyageMemoPublic = {
    dailyRoutines: routines,
    crisisMethodology: methodology,
    displayName,
    updatedAt: ts,
  }
  for (const k of trimmedKeys) {
    all[k] = entry
  }
  saveAll(all)
  notifyMemo()
}

export function getVoyageMemo(key: string): VoyageMemoPublic | null {
  const k = key.trim()
  if (!k) return null
  const all = loadAll()
  const row = all[k]
  if (!row || typeof row !== 'object') return null
  const dailyRoutines = Array.isArray(row.dailyRoutines)
    ? row.dailyRoutines
          .filter(
            (x): x is string => typeof x === 'string' && x.trim() !== '',
          )
          .map((s) => s.trim())
    : []
  const crisisMethodology =
    typeof row.crisisMethodology === 'string' ? row.crisisMethodology : ''
  const displayName =
    typeof row.displayName === 'string' && row.displayName.trim()
      ? row.displayName.trim()
      : '선원'
  const updatedAt =
    typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
      ? row.updatedAt
      : 0
  if (!dailyRoutines.length && !crisisMethodology.trim()) return null
  return { dailyRoutines, crisisMethodology, displayName, updatedAt }
}
