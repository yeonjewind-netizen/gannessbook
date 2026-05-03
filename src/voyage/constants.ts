import type { MoodTag } from './types'

export type WaveMoodTag = Exclude<MoodTag, 'tailwind'>

/** 오늘의 파도 — 시행착오·난항 태그 */
export const TAG_OPTIONS: { id: WaveMoodTag; label: string }[] = [
  { id: 'passion', label: '⛵ 순풍에 돛 단 듯' },
  { id: 'wall', label: '🌊 거친 파도' },
  { id: 'direction', label: '🌪️ 갑작스런 태풍' },
]

export const TAG_LABEL: Record<MoodTag, string> = {
  passion: '⛵ 순풍에 돛 단 듯',
  wall: '🌊 거친 파도',
  direction: '🌪️ 갑작스런 태풍',
  tailwind: '✨ 오늘의 순풍',
}
