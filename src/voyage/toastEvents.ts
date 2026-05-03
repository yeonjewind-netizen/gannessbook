/** ToastProvider와 알림 저장소가 공유하는 페이로드 (순환 참조 방지용 분리 모듈) */

export const TOAST_EVENT = 'ganness-book:toast-prompt' as const

export type ToastPayload =
  | { kind: 'cheer'; name: string }
  | { kind: 'record_approved' }
  | { kind: 'baton' }
  /** 등대(선배)에서 가져온 루틴 오늘 완료 */
  | { kind: 'mentor_routine' }
  /** 성장 은하계 · 태풍 별 고래 이스터 에그 */
  | { kind: 'whale_tribute' }
  /** 항해 완료 후 기록실(완료 아카이브)로 이관됨 */
  | { kind: 'voyage_archived' }
  /** Firestore 동기화 실패 등 */
  | { kind: 'sync_error'; message: string }

export function emitToastPrompt(payload: ToastPayload): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }))
}
