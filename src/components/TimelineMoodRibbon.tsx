import { CloudLightning, Sailboat, Waves } from 'lucide-react'
import type { MoodTag } from '../voyage/types'
import {
  emotionDisplayLabel,
  moodTagToEmotion,
  timelineIconAccentClass,
  timelineTagPillClass,
  type OceanSurfaceVariant,
  type TimelineEmotion,
} from '../voyage/timelineMood'

function EmotionIcon({ emotion }: { emotion: TimelineEmotion }) {
  const cn = 'h-4 w-4 shrink-0'
  switch (emotion) {
    case 'fairWind':
      return <Sailboat className={cn} aria-hidden />
    case 'typhoon':
      return <CloudLightning className={cn} aria-hidden />
    default:
      return <Waves className={cn} aria-hidden />
  }
}

type TimelineMoodRibbonProps = {
  moodTag: MoodTag | undefined
  surface: OceanSurfaceVariant
  tagLabel: string
  className?: string
}

export function TimelineMoodRibbon({
  moodTag,
  surface,
  tagLabel,
  className = '',
}: TimelineMoodRibbonProps) {
  const emotion = moodTag ? moodTagToEmotion(moodTag) : 'wave'
  const label = emotionDisplayLabel(emotion)

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      title={`${label} · ${tagLabel}`}
    >
      <span className={timelineIconAccentClass(moodTag, surface)}>
        <EmotionIcon emotion={emotion} />
      </span>
      <span className="sr-only">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${timelineTagPillClass(
          moodTag,
          surface,
        )}`}
      >
        {tagLabel}
      </span>
    </div>
  )
}
