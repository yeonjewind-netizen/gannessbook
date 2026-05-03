const USER_ID_KEY = 'ganness-book:user-id'

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 기기(브라우저)별로 한 번 발급되는 선원 userId */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const existing = localStorage.getItem(USER_ID_KEY)
    if (typeof existing === 'string' && existing.trim()) return existing.trim()
    const id = randomId()
    localStorage.setItem(USER_ID_KEY, id)
    return id
  } catch {
    return randomId()
  }
}
