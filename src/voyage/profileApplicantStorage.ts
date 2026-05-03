export const PROFILE_APPLICANT_KEY = 'ganness-book:profile-applicant-name'
export const PROFILE_UPDATES_EVENT = 'ganness-book-profile-updates'

export function notifyProfileUpdates() {
  window.dispatchEvent(new Event(PROFILE_UPDATES_EVENT))
}

export function loadProfileApplicantName(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(PROFILE_APPLICANT_KEY)
    return typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return ''
  }
}

export function saveProfileApplicantName(name: string): void {
  try {
    localStorage.setItem(PROFILE_APPLICANT_KEY, name.trim())
    notifyProfileUpdates()
  } catch {
    /* ignore */
  }
}
