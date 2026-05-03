import {
  useEffect,
  useId,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { X } from 'lucide-react'
import type { CompletedVoyageArchiveEntry } from '../voyage/completedVoyagesArchive'
import { formatShortDate } from '../voyage/dateFormat'
import { getRecordCategoryTitle } from '../data/gannessPersistence'

const VIEW_W = 1000
const VIEW_H = 620

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function moodColorForDiaries(
  entries: CompletedVoyageArchiveEntry['diaryEntries'],
): string {
  let fair = 0
  let typhoon = 0
  let wave = 0
  for (const e of entries) {
    if (e.tag === 'tailwind') fair++
    else if (e.tag === 'direction') typhoon++
    else wave++
  }
  if (fair === 0 && typhoon === 0) {
    const w = Math.min(1, wave / Math.max(6, wave + 1))
    const r = Math.round(125 + w * 40)
    const g = Math.round(211 + w * 20)
    const b = Math.round(252 - w * 30)
    return `rgb(${r},${g},${b})`
  }
  const denom = fair + typhoon
  const t = typhoon / Math.max(0.001, denom)
  const r = Math.round(52 + t * (251 - 52))
  const g = Math.round(211 + t * (146 - 211))
  const b = Math.round(153 + t * (60 - 153))
  return `rgb(${r},${g},${b})`
}

export type ConstellationStar = {
  id: string
  cx: number
  cy: number
  r: number
  fill: string
  goalName: string
  completedAt: string
  categoryLabel: string
  categoryKey: string
}

function buildStars(voyages: CompletedVoyageArchiveEntry[]): ConstellationStar[] {
  if (voyages.length === 0) return []
  const sorted = [...voyages].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  )
  const maxDiary = Math.max(
    1,
    ...sorted.map((v) => Math.max(1, v.diaryEntries.length)),
  )
  return sorted.map((v, i) => {
    const n = sorted.length
    const cx =
      n <= 1 ? VIEW_W / 2 : 70 + (i / (n - 1)) * (VIEW_W - 140)
    const catKey = v.linkedCategoryId ?? '__none__'
    const band = hashStr(catKey) % 5
    const jitter = (hashStr(v.id + catKey) % 180) - 90
    const cy =
      90 +
      band * 85 +
      (hashStr(v.id) % 70) +
      jitter * 0.35 +
      ((hashStr(v.id + 'y') % 120) / 120) * 60
    const clampedCy = Math.min(VIEW_H - 70, Math.max(55, cy))
    const diaryCount = v.diaryEntries.length
    const r = 5 + Math.min(10, (diaryCount / maxDiary) * 10)
    const fill = moodColorForDiaries(v.diaryEntries)
    const categoryLabel =
      v.linkedCategoryId != null
        ? getRecordCategoryTitle(v.linkedCategoryId)
        : '카테고리 없음'
    return {
      id: v.id,
      cx,
      cy: clampedCy,
      r,
      fill,
      goalName: v.goalName,
      completedAt: v.completedAt,
      categoryLabel,
      categoryKey: catKey,
    }
  })
}

function categoryChains(stars: ConstellationStar[]): [string, string][] {
  const groups = new Map<string, ConstellationStar[]>()
  for (const s of stars) {
    const list = groups.get(s.categoryKey) ?? []
    list.push(s)
    groups.set(s.categoryKey, list)
  }
  const edges: [string, string][] = []
  for (const [, list] of groups) {
    if (list.length < 2) continue
    const chain = [...list].sort((a, b) => a.cx - b.cx)
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push([chain[i].id, chain[i + 1].id])
    }
  }
  return edges
}

type ConstellationMapProps = {
  open: boolean
  onClose: () => void
  voyages: CompletedVoyageArchiveEntry[]
}

export default function ConstellationMap({
  open,
  onClose,
  voyages,
}: ConstellationMapProps) {
  const filterId = useId().replace(/:/g, '')
  const glowId = `star-glow-${filterId}`
  const stars = useMemo(() => buildStars(voyages), [voyages])
  const edges = useMemo(() => categoryChains(stars), [stars])
  const starMap = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars])

  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pointerTip, setPointerTip] = useState<{ x: number; y: number } | null>(
    null,
  )
  const hoverStar = hoverId ? starMap.get(hoverId) : undefined

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setHoverId(null)
      setPointerTip(null)
    }
  }, [open])

  const dust = useMemo(() => {
    const out: { x: number; y: number; s: number; d: number }[] = []
    for (let i = 0; i < 110; i++) {
      out.push({
        x: (hashStr(`dx-${i}`) % 1000) / 10,
        y: (hashStr(`dy-${i}`) % 1000) / 16,
        s: 0.4 + (hashStr(`ds-${i}`) % 14) / 10,
        d: (hashStr(`dd-${i}`) % 2800) / 100,
      })
    }
    return out
  }, [])

  function handleStarPointer(s: ConstellationStar, e: ReactPointerEvent) {
    setHoverId(s.id)
    setPointerTip({ x: e.clientX, y: e.clientY })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950 animate-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="constellation-title"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
          <div>
            <h2
              id="constellation-title"
              className="text-base font-bold text-sky-100 sm:text-lg"
            >
              나의 별자리
            </h2>
            <p className="text-xs text-slate-500">
              완료한 항해가 별이 되어 이어집니다 · 같은 주제는 선으로 연결
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* 배경 별무리 */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            {dust.map((d, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white will-change-opacity"
                style={{
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  width: d.s,
                  height: d.s,
                  opacity: 0.15 + (hashStr(`op-${i}`) % 35) / 100,
                  animation: `twinkle ${3 + (i % 5) * 0.6}s ease-in-out ${d.d}s infinite alternate`,
                }}
              />
            ))}
          </div>

          {voyages.length === 0 ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
              아직 완료된 항해가 없어 별을 그릴 수 없어요.
            </p>
          ) : (
            <div className="relative flex h-full min-h-[50vh] w-full items-stretch justify-center p-2 sm:p-4">
              <svg
                className="h-full w-full max-h-[85vh] touch-none"
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <filter
                    id={glowId}
                    x="-60%"
                    y="-60%"
                    width="220%"
                    height="220%"
                  >
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect width={VIEW_W} height={VIEW_H} fill="transparent" />

                <g>
                  {edges.map(([a, b], i) => {
                    const sa = starMap.get(a)
                    const sb = starMap.get(b)
                    if (!sa || !sb) return null
                    return (
                      <line
                        key={`${a}-${b}-${i}`}
                        x1={sa.cx}
                        y1={sa.cy}
                        x2={sb.cx}
                        y2={sb.cy}
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth={1.5}
                      />
                    )
                  })}
                </g>

                <g filter={`url(#${glowId})`}>
                  {stars.map((s) => {
                    const active = hoverId === s.id
                    return (
                      <g key={s.id}>
                        <circle
                          cx={s.cx}
                          cy={s.cy}
                          r={s.r + (active ? 3 : 0)}
                          fill={s.fill}
                          opacity={active ? 1 : 0.92}
                          className="cursor-pointer transition-[r,opacity] duration-200"
                          onPointerEnter={(e) => handleStarPointer(s, e)}
                          onPointerMove={(e) => handleStarPointer(s, e)}
                          onPointerLeave={() => {
                            setHoverId(null)
                            setPointerTip(null)
                          }}
                          onFocus={(e) => {
                            setHoverId(s.id)
                            const r = (
                              e.currentTarget as SVGCircleElement
                            ).getBoundingClientRect()
                            setPointerTip({
                              x: r.left + r.width / 2,
                              y: r.top,
                            })
                          }}
                          onBlur={() => {
                            setHoverId(null)
                            setPointerTip(null)
                          }}
                          tabIndex={0}
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>

              {hoverStar && pointerTip && (
                <div
                  className="pointer-events-none fixed z-[130] max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-2xl border border-white/20 bg-slate-900/92 px-4 py-3 text-center shadow-xl backdrop-blur-md"
                  style={{ left: pointerTip.x, top: pointerTip.y }}
                  role="tooltip"
                >
                  <p className="text-sm font-bold text-white">
                    {hoverStar.goalName}
                  </p>
                  <p className="mt-1 text-xs text-sky-200/90">
                    달성 {formatShortDate(hoverStar.completedAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {hoverStar.categoryLabel}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          from { opacity: 0.12; }
          to { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
