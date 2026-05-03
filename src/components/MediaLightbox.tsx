import { useEffect } from 'react'
import { X } from 'lucide-react'

export type LightboxMedia = {
  type: 'image' | 'video'
  src: string
}

type MediaLightboxProps = {
  open: boolean
  media: LightboxMedia | null
  onClose: () => void
}

export default function MediaLightbox({
  open,
  media,
  onClose,
}: MediaLightboxProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !media?.src) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="미디어 전체 보기"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92vh,920px)] max-w-[min(96vw,1200px)] flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-12 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-0 sm:top-0 sm:bg-white/90 sm:text-slate-700"
          aria-label="닫기"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
          {media.type === 'video' ? (
            <video
              src={media.src}
              className="max-h-[min(88vh,900px)] max-w-full"
              controls
              playsInline
              autoPlay
            />
          ) : (
            <img
              src={media.src}
              alt=""
              className="max-h-[min(88vh,900px)] max-w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  )
}
