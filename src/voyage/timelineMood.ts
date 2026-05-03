import type { MoodTag } from './types'

/** UX 감정 축: 순풍 / 일상 파도 / 태풍(가장 힘든 순간) */
export type TimelineEmotion = 'fairWind' | 'wave' | 'typhoon'

export type OceanSurfaceVariant = 'surface' | 'deep' | 'abyss'

export function moodTagToEmotion(tag: MoodTag): TimelineEmotion {
  if (tag === 'tailwind' || tag === 'passion') return 'fairWind'
  if (tag === 'direction') return 'typhoon'
  return 'wave'
}

export function oceanSurfaceVariant(
  deepWater: boolean,
  abyss: boolean,
): OceanSurfaceVariant {
  if (abyss) return 'abyss'
  if (deepWater) return 'deep'
  return 'surface'
}

export function timelineRailGradient(surface: OceanSurfaceVariant): string {
  switch (surface) {
    case 'abyss':
      return 'bg-gradient-to-b from-emerald-400/35 via-sky-500/25 to-transparent'
    case 'deep':
      return 'bg-gradient-to-b from-sky-300/55 via-sky-400/35 to-transparent'
    default:
      return 'bg-gradient-to-b from-sky-400/80 via-sky-300/50 to-slate-200/40'
  }
}

const ARTICLE_SHELL: Record<
  TimelineEmotion,
  Record<OceanSurfaceVariant, string>
> = {
  fairWind: {
    surface:
      'border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-cyan-50/45 shadow-sm shadow-emerald-100/40',
    deep:
      'border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 via-teal-900/25 to-cyan-950/30 shadow-md shadow-emerald-950/30',
    abyss:
      'border-emerald-400/25 bg-gradient-to-br from-emerald-950/45 via-slate-950/40 to-cyan-950/35 shadow-lg shadow-black/40',
  },
  wave: {
    surface:
      'border-slate-200/85 bg-white/95 text-slate-800 shadow-sm shadow-slate-100/50',
    deep:
      'border-slate-600/40 bg-slate-900/45 text-slate-100 shadow-md shadow-slate-950/40',
    abyss:
      'border-slate-500/35 bg-slate-950/55 text-slate-50 shadow-lg shadow-black/45',
  },
  typhoon: {
    surface:
      'border-orange-200/90 bg-gradient-to-br from-rose-50/95 via-orange-50/70 to-amber-50/55 shadow-sm shadow-orange-100/50',
    deep:
      'border-orange-500/40 bg-gradient-to-br from-rose-950/40 via-orange-950/35 to-amber-950/30 shadow-md shadow-orange-950/35',
    abyss:
      'border-orange-400/35 bg-gradient-to-br from-rose-950/50 via-orange-950/45 to-amber-950/40 shadow-lg shadow-black/50',
  },
}

export function timelineEntryArticleClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  return ARTICLE_SHELL[e][surface]
}

const DOT: Record<TimelineEmotion, Record<OceanSurfaceVariant, string>> = {
  fairWind: {
    surface:
      'border-white bg-gradient-to-br from-emerald-400 to-teal-500 ring-2 ring-emerald-200/90',
    deep:
      'border-emerald-200/80 bg-emerald-400 ring-2 ring-emerald-700/50',
    abyss:
      'border-emerald-100/90 bg-emerald-300 ring-2 ring-emerald-400/60',
  },
  wave: {
    surface: 'border-white bg-sky-400 ring-2 ring-sky-200/90',
    deep: 'border-sky-200/80 bg-sky-400 ring-2 ring-sky-700/45',
    abyss: 'border-sky-100/90 bg-sky-300 ring-2 ring-sky-500/50',
  },
  typhoon: {
    surface:
      'border-white bg-gradient-to-br from-orange-400 to-rose-500 ring-2 ring-orange-200/90',
    deep:
      'border-orange-200/80 bg-orange-500 ring-2 ring-orange-800/45',
    abyss:
      'border-orange-100/90 bg-orange-400 ring-2 ring-amber-500/55',
  },
}

export function timelineDotClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  return DOT[e][surface]
}

/** 폼·관리자 등 단일 밝은 배경용 */
export function timelineEntryArticleClassFlat(tag: MoodTag | undefined): string {
  return timelineEntryArticleClass(tag, 'surface')
}

export function emotionDisplayLabel(e: TimelineEmotion): string {
  switch (e) {
    case 'fairWind':
      return '순풍'
    case 'typhoon':
      return '태풍'
    default:
      return '파도'
  }
}

export function timelineMetaTextClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  if (surface === 'surface') {
    if (e === 'fairWind') return 'text-emerald-800'
    if (e === 'typhoon') return 'text-orange-900'
    return 'text-slate-600'
  }
  if (e === 'fairWind') return 'text-emerald-200'
  if (e === 'typhoon') return 'text-orange-200'
  return 'text-slate-200'
}

export function timelineBodyTextClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  if (surface === 'surface') return 'text-slate-800'
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  if (e === 'typhoon') return 'text-orange-50'
  return 'text-slate-100'
}

export function timelineIconAccentClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  const dark = surface !== 'surface'
  if (e === 'fairWind') return dark ? 'text-emerald-300' : 'text-emerald-600'
  if (e === 'typhoon') return dark ? 'text-orange-300' : 'text-orange-600'
  return dark ? 'text-sky-300' : 'text-sky-600'
}

export function timelineTagPillClass(
  tag: MoodTag | undefined,
  surface: OceanSurfaceVariant,
): string {
  const e = tag ? moodTagToEmotion(tag) : 'wave'
  if (surface === 'surface') {
    if (e === 'fairWind')
      return 'bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-300/45'
    if (e === 'typhoon')
      return 'bg-orange-500/15 text-orange-950 ring-1 ring-orange-300/45'
    return 'bg-slate-500/10 text-slate-800 ring-1 ring-slate-300/35'
  }
  if (e === 'fairWind')
    return 'bg-emerald-500/25 text-emerald-50 ring-1 ring-emerald-400/35'
  if (e === 'typhoon')
    return 'bg-orange-500/25 text-orange-50 ring-1 ring-orange-400/35'
  return 'bg-white/10 text-slate-100 ring-1 ring-white/15'
}
