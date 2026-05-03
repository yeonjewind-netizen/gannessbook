/**
 * 나의 바다 — 오늘의 항해 체크리스트 (localStorage)
 */

export const MY_ROUTINES_KEY = 'ganness-book:my-routines'
export const MY_ROUTINES_EVENT = 'ganness-book:my-routines-updated'

export type MyRoutineEntry = {
  id: string
  label: string
  /** null이면 사용자가 직접 추가한 루틴 */
  originUserId: string | null
  /** 비망록에서 가져올 때 등대 표시명 */
  originDisplayName?: string
  addedAt: string
  /** 로컬 날짜(YYYY-MM-DD) — 해당 날짜에 완료 체크됨. 자정 이후에는 자동으로 미완료로 보임 */
  lastCompletedDay: string | null
}

function notify() {
  window.dispatchEvent(new Event(MY_ROUTINES_EVENT))
}

/** 로컬 타임존 기준 오늘 키 */
export function getLocalDayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isCompletedToday(r: MyRoutineEntry): boolean {
  return r.lastCompletedDay === getLocalDayKey()
}

function safeParse(raw: string | null): MyRoutineEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: MyRoutineEntry[] = []
    for (const row of data) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
      const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : ''
      if (!id || !label) continue
      const originRaw = o.originUserId
      const originUserId =
        originRaw === null
          ? null
          : typeof originRaw === 'string' && originRaw.trim()
            ? originRaw.trim()
            : null
      const originDisplayName =
        typeof o.originDisplayName === 'string' && o.originDisplayName.trim()
          ? o.originDisplayName.trim()
          : undefined
      const addedAt =
        typeof o.addedAt === 'string' && o.addedAt ? o.addedAt : new Date().toISOString()
      const lcd = o.lastCompletedDay
      const lastCompletedDay =
        lcd === null
          ? null
          : typeof lcd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lcd)
            ? lcd
            : null
      out.push({
        id,
        label,
        originUserId,
        ...(originDisplayName ? { originDisplayName } : {}),
        addedAt,
        lastCompletedDay,
      })
    }
    return out
  } catch {
    return []
  }
}

export function loadMyRoutines(): MyRoutineEntry[] {
  if (typeof window === 'undefined') return []
  return safeParse(localStorage.getItem(MY_ROUTINES_KEY))
}

export function saveMyRoutines(list: MyRoutineEntry[]): void {
  try {
    localStorage.setItem(MY_ROUTINES_KEY, JSON.stringify(list))
    notify()
  } catch {
    /* ignore */
  }
}

export function addMyRoutine(input: {
  label: string
  originUserId: string | null
  originDisplayName?: string
}): { ok: boolean; reason?: 'duplicate' } {
  const label = input.label.trim()
  if (!label) return { ok: false }

  const list = loadMyRoutines()
  const dup = list.some(
    (r) =>
      r.label === label &&
      (r.originUserId ?? '') === (input.originUserId ?? ''),
  )
  if (dup) return { ok: false, reason: 'duplicate' }

  const entry: MyRoutineEntry = {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label,
    originUserId: input.originUserId,
    ...(input.originDisplayName?.trim()
      ? { originDisplayName: input.originDisplayName.trim() }
      : {}),
    addedAt: new Date().toISOString(),
    lastCompletedDay: null,
  }
  saveMyRoutines([...list, entry])
  return { ok: true }
}

export function removeMyRoutine(id: string): void {
  const list = loadMyRoutines().filter((r) => r.id !== id)
  saveMyRoutines(list)
}

export function toggleRoutineCompleted(id: string): MyRoutineEntry | null {
  const list = loadMyRoutines()
  const idx = list.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const r = list[idx]
  const today = getLocalDayKey()
  const nowDone = r.lastCompletedDay === today
  const next: MyRoutineEntry = {
    ...r,
    lastCompletedDay: nowDone ? null : today,
  }
  const copy = [...list]
  copy[idx] = next
  saveMyRoutines(copy)
  return next
}

/** 오늘 체크한 항목을 모두 초기화(미완료로) */
export function resetAllRoutineCompletionsToday(): void {
  const list = loadMyRoutines().map((r) => ({
    ...r,
    lastCompletedDay: null,
  }))
  saveMyRoutines(list)
}
