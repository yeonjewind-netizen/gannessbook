import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  forceCollide,
  forceManyBody,
  forceRadial,
  forceSimulation,
} from 'd3-force'
import { X } from 'lucide-react'
import type { CompletedVoyageArchiveEntry } from '../voyage/completedVoyagesArchive'
import type { LogEntry } from '../voyage/types'
import {
  getRecordCategoryTitle,
  type RecordApplication,
} from '../data/gannessPersistence'
import { formatShortDate } from '../voyage/dateFormat'
import {
  firstIncompleteMilestone,
  loadMyVoyage,
} from '../voyage/myVoyageStorage'
import { loadVoyageEntries } from '../voyage/voyageEntries'
import { useToast } from './ToastProvider'

/** 나의 바다 기간과 맞춘 입학·기준일 (MyOcean periodStart) */
const ENROLL_MS = new Date('2026-03-02T00:00:00+09:00').getTime()

/** 태풍 별 이스터 에그: 고래가 화면을 가로지르는 시간(ms) */
const WHALE_DURATION_MS = 12_000
/** 화면 중앙 통과 시점 근처에 하단 메시지 표시 */
const WHALE_TOAST_AT_MS = 5200

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export type GalaxyNode = {
  id: string
  voyageId: string
  goalName: string
  /** 정렬·타임라인용 (진행 중은 현재 시각 ISO) */
  completedAt: string
  sortTime: number
  categoryKey: string
  categoryLabel: string
  targetR: number
  targetAngle: number
  collideR: number
  /** typhoon-dominant visual */
  moodTyphoon: boolean
  /** fair-wind-dominant visual */
  moodFair: boolean
  isGolden: boolean
  /** 완료 항해의 마지막 회고 */
  retrospective: string | null
  /** 진행 중 목표의 소목표 등 보조 문구 */
  progressNote: string | null
  isCurrent: boolean
  x: number
  y: number
  vx?: number
  vy?: number
  index?: number
}

function isRedTyphoonStar(n: GalaxyNode): boolean {
  return n.moodTyphoon && !n.isGolden
}

/** 태풍(direction) vs 순풍(passion·tailwind) 비율로 별 색 — wall(파도)은 비교에서 제외 */
function diaryMoodFlagsFromEntries(entries: LogEntry[]) {
  const n = entries.length
  if (n === 0)
    return { typhoon: 0, fair: 0, moodTyphoon: false, moodFair: false }
  let ty = 0
  let fa = 0
  for (const e of entries) {
    if (e.tag === 'direction') ty++
    else if (e.tag === 'passion' || e.tag === 'tailwind') fa++
  }
  const typhoonR = ty / n
  const fairR = fa / n
  return {
    typhoon: typhoonR,
    fair: fairR,
    moodTyphoon: typhoonR >= 0.26 && typhoonR >= fairR,
    moodFair: fairR >= 0.26 && fairR > typhoonR,
  }
}

function radialT(ms: number): number {
  const now = Date.now()
  const span = Math.max(1, now - ENROLL_MS)
  return Math.max(0, Math.min(1, (ms - ENROLL_MS) / span))
}

/** 입학(중앙) → 현재(바깥). 진행 중 목표는 항상 최신 시각으로 외곽. */
function targetRadiusForTime(sortTimeMs: number): number {
  const t = radialT(sortTimeMs)
  return 55 + Math.pow(t, 0.85) * 280
}

function buildGalaxyNodes(
  voyages: CompletedVoyageArchiveEntry[],
  applications: RecordApplication[],
  profile: ReturnType<typeof loadMyVoyage>,
  allEntries: LogEntry[],
): GalaxyNode[] {
  const approvedCats = new Set(
    applications
      .filter((a) => a.status === 'approved' && a.categoryId?.trim())
      .map((a) => a.categoryId),
  )

  const catKeySet = new Set<string>()
  voyages.forEach((v) => catKeySet.add(v.linkedCategoryId ?? '__none__'))
  const leg = profile.voyageLegId?.trim()
  const hasCurrent = Boolean(leg && profile.goalName.trim())
  if (hasCurrent) {
    catKeySet.add(profile.linkedCategoryId ?? '__none__')
  }
  const catKeys = [...catKeySet].sort()
  const sector = (2 * Math.PI) / Math.max(1, catKeys.length)
  const sectorOf = new Map(catKeys.map((c, i) => [c, i * sector]))

  const out: GalaxyNode[] = []
  let idx = 0

  voyages.forEach((v) => {
    const ck = v.linkedCategoryId ?? '__none__'
    const base = sectorOf.get(ck) ?? 0
    const jitter = ((hashStr(v.id) % 1000) / 1000) * sector * 0.82
    const theta = base + jitter + (hashStr(v.id + 'θ') % 100) * 0.002
    const sortTime = new Date(v.completedAt).getTime()
    const targetR = targetRadiusForTime(sortTime)
    const nDiary = v.diaryEntries.length
    const collideR = 10 + Math.min(18, nDiary * 1.2)
    const { moodTyphoon, moodFair } = diaryMoodFlagsFromEntries(v.diaryEntries)
    const isGolden = Boolean(
      v.linkedCategoryId && approvedCats.has(v.linkedCategoryId),
    )
    const x = targetR * Math.cos(theta)
    const y = targetR * Math.sin(theta)
    out.push({
      id: `g-${v.id}`,
      voyageId: v.id,
      goalName: v.goalName,
      completedAt: v.completedAt,
      sortTime,
      categoryKey: ck,
      categoryLabel:
        v.linkedCategoryId != null
          ? getRecordCategoryTitle(v.linkedCategoryId)
          : '카테고리 없음',
      targetR,
      targetAngle: theta,
      collideR,
      moodTyphoon,
      moodFair,
      isGolden,
      retrospective: v.finalRetrospective?.trim() ?? null,
      progressNote: null,
      isCurrent: false,
      x,
      y,
      index: idx++,
    })
  })

  if (hasCurrent && leg) {
    const ck = profile.linkedCategoryId ?? '__none__'
    const base = sectorOf.get(ck) ?? 0
    const jitter = ((hashStr(`cur-${leg}`) % 1000) / 1000) * sector * 0.82
    const theta =
      base + jitter + (hashStr(`${leg}θ`) % 100) * 0.002
    const nowMs = Date.now()
    const targetR = targetRadiusForTime(nowMs)
    const curEntries = allEntries.filter((e) => e.voyageLegId === leg)
    const nDiary = curEntries.length
    const collideR = 10 + Math.min(18, Math.max(1, nDiary) * 1.15)
    const { moodTyphoon, moodFair } = diaryMoodFlagsFromEntries(curEntries)
    const isGolden = Boolean(
      profile.linkedCategoryId &&
        approvedCats.has(profile.linkedCategoryId),
    )
    const x = targetR * Math.cos(theta)
    const y = targetR * Math.sin(theta)
    const nextM = firstIncompleteMilestone(profile.milestones ?? [])
    const sub =
      nextM?.label?.trim() || profile.subGoal?.trim() || ''
    out.push({
      id: `g-current-${leg}`,
      voyageId: `current-${leg}`,
      goalName: profile.goalName.trim() || '진행 중 목표',
      completedAt: new Date(nowMs).toISOString(),
      sortTime: nowMs,
      categoryKey: ck,
      categoryLabel:
        profile.linkedCategoryId != null
          ? getRecordCategoryTitle(profile.linkedCategoryId)
          : '카테고리 없음',
      targetR,
      targetAngle: theta,
      collideR,
      moodTyphoon,
      moodFair,
      isGolden,
      retrospective: null,
      progressNote: sub
        ? `소목표: ${sub}`
        : `진행 중 · 일지 ${nDiary}장`,
      isCurrent: true,
      x,
      y,
      index: idx++,
    })
  }

  return out
}

function clusterSameCategory(nodes: GalaxyNode[]) {
  return function force(alpha: number) {
    const by = new Map<string, GalaxyNode[]>()
    for (const n of nodes) {
      const k = n.categoryKey
      const arr = by.get(k) ?? []
      arr.push(n)
      by.set(k, arr)
    }
    const s = alpha * 0.14
    for (const [, group] of by) {
      if (group.length < 2) continue
      let cx = 0
      let cy = 0
      for (const n of group) {
        cx += n.x
        cy += n.y
      }
      cx /= group.length
      cy /= group.length
      for (const n of group) {
        n.vx = (n.vx ?? 0) + (cx - n.x) * s
        n.vy = (n.vy ?? 0) + (cy - n.y) * s
      }
    }
  }
}

function runLayout(nodes: GalaxyNode[]): GalaxyNode[] {
  if (nodes.length === 0) return []
  const copy = nodes.map((n) => ({
    ...n,
    x: n.x,
    y: n.y,
    vx: 0,
    vy: 0,
  }))
  const sim = forceSimulation<GalaxyNode>(copy)
    .force(
      'radial',
      forceRadial<GalaxyNode>((d: GalaxyNode) => d.targetR, 0, 0).strength(
        0.42,
      ),
    )
    .force('charge', forceManyBody<GalaxyNode>().strength(-38))
    .force(
      'collide',
      forceCollide<GalaxyNode>()
        .radius((d: GalaxyNode) => d.collideR + 5)
        .iterations(3),
    )
    .force('cluster', clusterSameCategory(copy))
    .alphaDecay(0.018)
    .stop()

  let guard = 0
  while (sim.alpha() > 0.009 && guard++ < 500) {
    sim.tick()
  }
  return copy
}

type GrowthGalaxyProps = {
  open: boolean
  onClose: () => void
  voyages: CompletedVoyageArchiveEntry[]
  applications: RecordApplication[]
  /** 프로필 등에서 아카이브·신청 갱신 시 레이아웃 재계산 */
  layoutRevision?: number
}

export default function GrowthGalaxy({
  open,
  onClose,
  voyages,
  applications,
  layoutRevision = 0,
}: GrowthGalaxyProps) {
  const uid = useId().replace(/:/g, '')
  const { showToast } = useToast()
  const [nodes, setNodes] = useState<GalaxyNode[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const [whalePlaying, setWhalePlaying] = useState(false)
  const [whaleAnimKey, setWhaleAnimKey] = useState(0)
  const whaleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const rawNodes = useMemo(() => {
    if (!open) return []
    const profile = loadMyVoyage()
    const entries = loadVoyageEntries()
    return buildGalaxyNodes(voyages, applications, profile, entries)
  }, [open, layoutRevision, voyages, applications])

  useEffect(() => {
    if (!open || rawNodes.length === 0) {
      setNodes([])
      return
    }
    setNodes(runLayout(rawNodes))
  }, [open, rawNodes])

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  )

  const chronoIds = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.sortTime - b.sortTime)
    return sorted.map((n) => n.id)
  }, [nodes])

  const hovered = hoverId ? nodeById.get(hoverId) : undefined
  const highlightCat = hovered?.categoryKey

  const clearWhaleTimers = useCallback(() => {
    whaleTimersRef.current.forEach(clearTimeout)
    whaleTimersRef.current = []
  }, [])

  const startWhaleEasterEgg = useCallback(() => {
    clearWhaleTimers()
    setHoverId(null)
    setTip(null)
    setWhaleAnimKey((k) => k + 1)
    setWhalePlaying(true)
    const t1 = window.setTimeout(() => {
      showToast({ kind: 'whale_tribute' })
    }, WHALE_TOAST_AT_MS)
    const t3 = window.setTimeout(() => {
      setWhalePlaying(false)
    }, WHALE_DURATION_MS)
    whaleTimersRef.current = [t1, t3]
  }, [clearWhaleTimers, showToast])

  useEffect(() => () => clearWhaleTimers(), [clearWhaleTimers])

  useEffect(() => {
    if (!open) {
      clearWhaleTimers()
      setWhalePlaying(false)
    }
  }, [open, clearWhaleTimers])

  useEffect(() => {
    if (!open) {
      setHoverId(null)
      setTip(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const trajectoryPts = useMemo(() => {
    return chronoIds
      .map((id) => nodeById.get(id))
      .filter((n): n is GalaxyNode => n != null)
      .map((n) => ({ x: n.x, y: n.y }))
  }, [chronoIds, nodeById])

  const handlePointer = useCallback(
    (n: GalaxyNode, e: ReactPointerEvent) => {
      if (whalePlaying) return
      setHoverId(n.id)
      setTip({ x: e.clientX, y: e.clientY })
    },
    [whalePlaying],
  )

  const handleTyphoonStarClick = useCallback(
    (n: GalaxyNode, e: ReactMouseEvent) => {
      if (!isRedTyphoonStar(n)) return
      e.preventDefault()
      e.stopPropagation()
      if (whalePlaying) return
      startWhaleEasterEgg()
    },
    [whalePlaying, startWhaleEasterEgg],
  )

  if (!open) return null

  const vb = 420

  return (
    <div
      className="fixed inset-0 z-[125] flex flex-col bg-slate-950 animate-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="growth-galaxy-title"
    >
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-md">
        <div>
          <h2
            id="growth-galaxy-title"
            className="text-base font-bold text-violet-100 sm:text-lg"
          >
            나의 6년 성장 은하계
          </h2>
          <p className="text-xs text-slate-500">
            중앙은 입학(시작), 바깥은 졸업·지금 · 카테고리마다 은하 팔처럼
            모입니다
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
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(49,46,129,0.35) 0%, transparent 55%), radial-gradient(ellipse at 30% 20%, rgba(14,165,233,0.12) 0%, transparent 40%)',
          }}
          aria-hidden
        />

        {rawNodes.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            완료된 항해와 진행 중 목표가 없어 은하계를 그릴 수 없어요.
          </p>
        ) : (
          <div className="relative h-full w-full p-2">
            <svg
              className="relative z-0 h-full w-full touch-none"
              viewBox={`${-vb} ${-vb} ${vb * 2} ${vb * 2}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient id={`gold-core-${uid}`} cx="35%" cy="35%" r="55%">
                  <stop offset="0%" stopColor="#fffbeb" stopOpacity="1" />
                  <stop offset="45%" stopColor="#fcd34d" stopOpacity="1" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
                </radialGradient>
                <radialGradient id={`fair-core-${uid}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity="1" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
                </radialGradient>
                <radialGradient id={`typhoon-core-${uid}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fecaca" stopOpacity="1" />
                  <stop offset="70%" stopColor="#ef4444" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.5" />
                </radialGradient>
                <filter id={`fair-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={`typhoon-glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 0.3 0 0 0  0 0 0.3 0 0  0 0 0 0.9 0"
                    result="glow"
                  />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={`gold-glow-${uid}`} x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={`path-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="pb" />
                  <feMerge>
                    <feMergeNode in="pb" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* faint orbit rings */}
              {[0.35, 0.55, 0.75, 1].map((k) => (
                <circle
                  key={k}
                  r={Math.max(120, maxRadius(nodes)) * k}
                  cx={0}
                  cy={0}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
              ))}

              {/* 성장 경로: 입학(중앙) → 호버한 별 */}
              {hovered && (
                <g filter={`url(#path-glow-${uid})`}>
                  <line
                    x1={0}
                    y1={0}
                    x2={hovered.x}
                    y2={hovered.y}
                    stroke="rgba(192,132,252,0.45)"
                    strokeWidth={14}
                    strokeLinecap="round"
                  />
                  <line
                    x1={0}
                    y1={0}
                    x2={hovered.x}
                    y2={hovered.y}
                    stroke="rgba(233,213,255,0.98)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    className="galaxy-path-core"
                  />
                </g>
              )}

              {/* growth trajectory (subtle) */}
              {trajectoryPts.length > 1 && (
                <polyline
                  fill="none"
                  stroke={
                    hoverId
                      ? 'rgba(167,139,250,0.22)'
                      : 'rgba(148,163,184,0.12)'
                  }
                  strokeWidth={hoverId ? 1.4 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trajectoryPts.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              )}

              {/* same-category edges */}
              {edgesByCategory(nodes).map(({ a, b }, i) => (
                <line
                  key={`e-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={
                    highlightCat && a.categoryKey === highlightCat
                      ? 'rgba(253,224,71,0.4)'
                      : 'rgba(125, 211, 252, 0.12)'
                  }
                  strokeWidth={
                    highlightCat && a.categoryKey === highlightCat ? 1.8 : 0.8
                  }
                />
              ))}

              {nodes.map((n) => {
                const dim =
                  hoverId &&
                  n.categoryKey !== highlightCat &&
                  n.id !== hoverId
                const bright =
                  hoverId &&
                  (n.id === hoverId || n.categoryKey === highlightCat)
                const restOpacity = n.isGolden ? 0.98 : 0.55
                const r = n.collideR * (bright ? 1.15 : 1)
                const fillGrad = n.isGolden
                  ? `url(#gold-core-${uid})`
                  : n.moodTyphoon
                    ? `url(#typhoon-core-${uid})`
                    : n.moodFair
                      ? `url(#fair-core-${uid})`
                      : 'rgba(148,163,184,0.85)'
                const filter = n.isGolden
                  ? `url(#gold-glow-${uid})`
                  : n.moodTyphoon
                    ? `url(#typhoon-glow-${uid})`
                    : n.moodFair
                      ? `url(#fair-glow-${uid})`
                      : undefined
                return (
                  <g
                    key={n.id}
                    opacity={dim ? 0.22 : bright ? 1 : restOpacity}
                    style={{ transition: 'opacity 0.2s ease' }}
                  >
                    {n.moodTyphoon && !n.isGolden && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r + 10}
                        fill="none"
                        stroke="rgba(248,113,113,0.35)"
                        strokeWidth={2}
                        className="galaxy-typhoon-ring"
                      />
                    )}
                    {n.moodFair && !n.moodTyphoon && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r + 6}
                        fill="none"
                        stroke="rgba(56,189,248,0.4)"
                        strokeWidth={1.2}
                        className="galaxy-fair-ring"
                      />
                    )}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill={fillGrad}
                      stroke={
                        n.isGolden
                          ? '#fbbf24'
                          : bright
                            ? 'rgba(255,255,255,0.55)'
                            : 'rgba(255,255,255,0.15)'
                      }
                      strokeWidth={n.isGolden ? 3.2 : bright ? 2 : 1}
                      filter={filter}
                      className={
                        n.isGolden
                          ? 'galaxy-gold-twinkle'
                          : n.moodFair
                            ? 'galaxy-fair-twinkle'
                            : undefined
                      }
                      onPointerEnter={(e) => handlePointer(n, e)}
                      onPointerMove={(e) => handlePointer(n, e)}
                      onPointerLeave={() => {
                        if (!whalePlaying) {
                          setHoverId(null)
                          setTip(null)
                        }
                      }}
                      onClick={(e) => handleTyphoonStarClick(n, e)}
                      style={{
                        cursor: whalePlaying ? 'wait' : 'pointer',
                        pointerEvents: whalePlaying ? 'none' : 'auto',
                      }}
                    />
                  </g>
                )
              })}
            </svg>

            {whalePlaying && (
              <>
                <div
                  className="absolute inset-0 z-[21] cursor-wait bg-transparent"
                  aria-hidden
                  onPointerDown={(e) => e.preventDefault()}
                />
                <div className="pointer-events-none absolute inset-0 z-[22] overflow-hidden">
                  <div
                    key={`stardust-${whaleAnimKey}`}
                    className="absolute inset-0"
                  >
                    {Array.from({ length: 46 }).map((_, i) => {
                      const leftPct = -8 + i * 2.45
                      const topPct = 44 + Math.sin(i * 0.55 + 1.2) * 5
                      return (
                        <span
                          key={i}
                          className="galaxy-stardust-particle absolute rounded-full bg-sky-200"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: 3 + (i % 4),
                            height: 3 + (i % 3),
                            opacity: 0.65,
                            boxShadow:
                              '0 0 8px rgba(186, 230, 253, 0.95), 0 0 16px rgba(56, 189, 248, 0.35)',
                            animation: `galaxy-stardust-fade 2.7s ease-out forwards`,
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      )
                    })}
                  </div>
                  <div
                    key={`whale-${whaleAnimKey}`}
                    className="pointer-events-none absolute left-0 top-[38%] w-[min(58vw,560px)]"
                  >
                    <div className="galaxy-whale-sprite will-change-transform">
                      <svg
                        viewBox="0 0 420 140"
                        className="h-auto w-full drop-shadow-[0_0_48px_rgba(56,189,248,0.45)]"
                        aria-hidden
                      >
                        <path
                          fill="rgba(56, 189, 248, 0.42)"
                          d="M14 68 C14 38 52 20 118 28 C188 36 232 42 298 36 C340 30 376 24 400 20 C410 30 408 52 384 62 C352 112 268 116 196 104 C126 116 62 104 26 82 C16 74 14 70 14 68 Z M384 62 C396 52 412 48 414 58 C412 70 396 72 384 62 Z M298 36 C318 6 358 2 388 20 C374 34 338 42 298 36 Z"
                        />
                        <ellipse
                          cx="138"
                          cy="56"
                          rx="18"
                          ry="12"
                          fill="rgba(125, 211, 252, 0.28)"
                        />
                        <path
                          fill="rgba(14, 165, 233, 0.18)"
                          d="M120 72 Q200 95 280 78 Q310 72 330 68 L338 82 Q260 98 180 92 Q140 88 120 72 Z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            {hovered && tip && !whalePlaying && (
              <div
                className="pointer-events-none fixed z-[130] max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-2xl border border-white/20 bg-slate-900/95 px-4 py-3 text-center shadow-2xl backdrop-blur-md"
                style={{ left: tip.x, top: tip.y }}
                role="tooltip"
              >
                <p className="text-sm font-bold text-white">{hovered.goalName}</p>
                <p className="mt-1 text-xs text-violet-200/90">
                  {hovered.isCurrent
                    ? `진행 중 · ${hovered.categoryLabel}`
                    : `${formatShortDate(hovered.completedAt)} 완료 · ${hovered.categoryLabel}`}
                </p>
                {hovered.retrospective && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-left text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {hovered.retrospective}
                  </p>
                )}
                {!hovered.retrospective && hovered.progressNote && (
                  <p className="mt-2 border-t border-white/10 pt-2 text-left text-xs leading-relaxed text-sky-200/95 whitespace-pre-wrap">
                    {hovered.progressNote}
                  </p>
                )}
                {hovered.isGolden && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-300">
                    명예의 전당 등재
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes galaxy-typhoon-pulse {
          0%, 100% { opacity: 0.28; }
          50% { opacity: 0.82; }
        }
        .galaxy-typhoon-ring {
          animation: galaxy-typhoon-pulse 2.2s ease-in-out infinite;
        }
        @keyframes galaxy-fair-shimmer {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.95; }
        }
        .galaxy-fair-ring {
          animation: galaxy-fair-shimmer 2.5s ease-in-out infinite;
        }
        @keyframes galaxy-twinkle {
          0%, 100% { opacity: 0.85; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.25); }
        }
        .galaxy-fair-twinkle {
          animation: galaxy-twinkle 2s ease-in-out infinite;
        }
        @keyframes galaxy-gold-twinkle {
          0%, 100% { opacity: 1; filter: brightness(1.15); }
          50% { opacity: 1; filter: brightness(1.45); }
        }
        .galaxy-gold-twinkle {
          animation: galaxy-gold-twinkle 2.2s ease-in-out infinite;
        }
        .galaxy-path-core {
          animation: galaxy-path-pulse 1.8s ease-in-out infinite;
        }
        @keyframes galaxy-path-pulse {
          0%, 100% { opacity: 0.82; }
          50% { opacity: 1; }
        }
        @keyframes galaxy-whale-cross {
          0% {
            transform: translate3d(calc(-100% - 18vw), -50%, 0) rotate(-1.2deg);
            opacity: 0;
          }
          7% {
            opacity: 0.92;
          }
          93% {
            opacity: 0.92;
          }
          100% {
            transform: translate3d(calc(100vw + 22%), -50%, 0) rotate(1deg);
            opacity: 0;
          }
        }
        .galaxy-whale-sprite {
          animation: galaxy-whale-cross ${WHALE_DURATION_MS}ms cubic-bezier(0.42, 0.05, 0.58, 1) forwards;
        }
        @keyframes galaxy-stardust-fade {
          0% {
            opacity: 0;
            transform: scale(0.35);
          }
          22% {
            opacity: 0.92;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.25);
          }
        }
      `}</style>
    </div>
  )
}

function maxRadius(ns: GalaxyNode[]): number {
  if (ns.length === 0) return 300
  return Math.max(...ns.map((n) => Math.hypot(n.x, n.y))) + 40
}

function edgesByCategory(nodes: GalaxyNode[]): {
  a: GalaxyNode
  b: GalaxyNode
}[] {
  const by = new Map<string, GalaxyNode[]>()
  for (const n of nodes) {
    const k = n.categoryKey
    const arr = by.get(k) ?? []
    arr.push(n)
    by.set(k, arr)
  }
  const out: { a: GalaxyNode; b: GalaxyNode }[] = []
  for (const [, group] of by) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x),
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      out.push({ a: sorted[i], b: sorted[i + 1] })
    }
  }
  return out
}
