export type MoodTag = 'passion' | 'wall' | 'direction' | 'tailwind'

/** 일지에 붙인 사진·영상 — Firebase Storage URL 또는 로컬 data URL */
export type LogAttachment = {
  id: string
  type: 'image' | 'video'
  /** Firebase Storage 등 HTTPS 다운로드 주소 (저장 시 우선) */
  mediaUrl?: string
  /** 로컬 data URL — 미로그인·레거시 */
  dataUrl?: string
}

/** 미리보기·재생에 사용할 단일 문자열 주소 */
export function logAttachmentSrc(a: LogAttachment): string {
  const https = a.mediaUrl?.trim()
  if (https) return https
  return a.dataUrl?.trim() ?? ''
}

export type LogEntry = {
  id: string
  tag: MoodTag
  body: string
  createdAt: string
  /** 이 일지가 다른 이의 새 항해에 영감을 준 횟수 */
  inspiredCount: number
  /** 현재 목표 항차(leg)와 매칭 — 나의 바다 일지 연동용 */
  voyageLegId?: string
  attachments?: LogAttachment[]
}

export type VoyageMeta = {
  isCompleted: boolean
  finalRetrospective: string | null
  completedAt?: string
}
