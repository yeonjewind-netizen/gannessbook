import type { LightboxMedia } from './MediaLightbox'

export type DiaryPreviewItem = {
  type: 'image' | 'video'
  /** data URL 또는 Firebase Storage HTTPS URL */
  src: string
}

type Layout = 'timeline' | 'compact' | 'admin'

type DiaryMediaPreviewGridProps = {
  items: DiaryPreviewItem[]
  layout?: Layout
  rowKeyPrefix: string
  onOpen: (media: LightboxMedia) => void
}

export function DiaryMediaPreviewGrid({
  items,
  layout = 'timeline',
  rowKeyPrefix,
  onOpen,
}: DiaryMediaPreviewGridProps) {
  if (!items.length) return null

  const gridClass =
    layout === 'timeline'
      ? 'grid grid-cols-3 gap-2 sm:grid-cols-4'
      : layout === 'compact'
        ? 'flex flex-wrap gap-1.5'
        : 'grid grid-cols-2 gap-2 sm:grid-cols-3'

  const cellClass =
    layout === 'compact'
      ? 'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-black/5'
      : layout === 'admin'
        ? 'relative aspect-video overflow-hidden rounded-lg border border-black/10 bg-black/5'
        : 'relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/5'

  return (
    <div className={gridClass}>
      {items.map((a, i) => (
        <button
          key={`${rowKeyPrefix}-${i}`}
          type="button"
          className={`group ${cellClass} cursor-zoom-in text-left transition hover:ring-2 hover:ring-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500`}
          onClick={() =>
            onOpen({ type: a.type, src: a.src })
          }
        >
          {a.type === 'video' ? (
            <video
              src={a.src}
              className="pointer-events-none h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={a.src}
              alt=""
              className="pointer-events-none h-full w-full object-cover"
            />
          )}
          <span className="sr-only">크게 보기</span>
        </button>
      ))}
    </div>
  )
}
