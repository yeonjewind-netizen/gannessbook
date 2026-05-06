import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Anchor,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Compass,
  ImagePlus,
  ListChecks,
  Loader2,
  Plus,
  Sailboat,
  SendHorizontal,
  Ship,
  Sparkles,
  Trash2,
  Waves,
  X,
  Zap,
} from 'lucide-react'
import {
  fileToDataUrl,
  registerCustomRecordCategory,
} from '../data/gannessPersistence'
import { useMergedRecordCategories } from '../hooks/useGannessStorage'
import {
  logAttachmentSrc,
  type LogAttachment,
  type LogEntry,
  type MoodTag,
  type VoyageMeta,
} from '../voyage/types'
import {
  TAG_OPTIONS,
  TAG_LABEL,
  type WaveMoodTag,
} from '../voyage/constants'
import {
  moodTagToEmotion,
  oceanSurfaceVariant,
  type OceanSurfaceVariant,
  timelineBodyTextClass,
  timelineEntryArticleClass,
  timelineIconAccentClass,
  timelineMetaTextClass,
  timelineRailGradient,
} from '../voyage/timelineMood'
import MediaLightbox, {
  type LightboxMedia,
} from '../components/MediaLightbox'
import { DiaryMediaPreviewGrid } from '../components/DiaryMediaPreviewGrid'
import { TimelineMoodRibbon } from '../components/TimelineMoodRibbon'
import { firstIncompleteMilestone, getEmptyVoyageProfile, milestoneProgressPercent, withSyncedVoyageDerived, type MyVoyageProfile } from '../voyage/myVoyageStorage'
import { formatShortDate } from '../voyage/dateFormat'
import type { VoyageRecordPrefill } from '../components/RecordSubmissionForm'
import { VoyageMilestoneBanner } from '../voyage/VoyageMilestoneBanner'
import {
  appendArchivedVoyage,
  deleteActiveVoyage,
  deleteAllLogsForUser,
  listLogsForUser,
  loadMyOceanBundle,
  mergeUserDoc,
  migrateLogsAssignLeg,
  setActiveVoyageProfile,
  upsertLog,
} from '../lib/firestoreUtils'
import { isFirebaseConfigured } from '../lib/firebase'
import { uploadDiaryAttachment } from '../lib/logMediaStorage'
import { useAuth } from '../context/AuthContext'
import {
  aggregateDefaultCheersForDiaryIds,
  loadCheerReactions,
} from '../voyage/cheerReactionsStorage'
import {
  LIGHTHOUSE_UPDATES_EVENT,
  loadLighthouses,
  resolveDisplayName,
} from '../voyage/lighthouseStorage'
import {
  getVoyageMemo,
  VOYAGE_MEMO_UPDATES_EVENT,
} from '../voyage/voyageMemoStorage'
import {
  getLocalDayKey,
  isCompletedToday,
  type MyRoutineEntry,
} from '../voyage/myRoutinesStorage'
import { enqueueRoutineAchievementForOrigin } from '../voyage/routineAchievementInbox'
import { loadProfileApplicantName } from '../voyage/profileApplicantStorage'
import { useToast } from '../components/ToastProvider'

const MAX_LOG_ATTACHMENTS = 6

/** 출항 화면: 명예의 전당 외 새 카테고리 직접 개척 */
const DEPART_NEW_CATEGORY_VALUE = '__depart_new_category__'

function tryAddRoutineLocal(
  list: MyRoutineEntry[],
  input: {
    label: string
    originUserId: string | null
    originDisplayName?: string
  },
): { ok: boolean; reason?: 'duplicate'; next: MyRoutineEntry[] } {
  const label = input.label.trim()
  if (!label) return { ok: false, next: list }
  const dup = list.some(
    (r) =>
      r.label === label &&
      (r.originUserId ?? '') === (input.originUserId ?? ''),
  )
  if (dup) return { ok: false, reason: 'duplicate', next: list }
  const entry: MyRoutineEntry = {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label,
    originUserId: input.originUserId,
    ...(input.originDisplayName?.trim()
      ? { originDisplayName: input.originDisplayName.trim() }
      : {}),
    addedAt: new Date().toISOString(),
    lastCompletedDay: null,
  }
  return { ok: true, next: [...list, entry] }
}

function toggleRoutineInList(
  list: MyRoutineEntry[],
  id: string,
): { next: MyRoutineEntry[]; toggled: MyRoutineEntry | null } {
  const idx = list.findIndex((r) => r.id === id)
  if (idx < 0) return { next: list, toggled: null }
  const r = list[idx]
  const today = getLocalDayKey()
  const nowDone = r.lastCompletedDay === today
  const toggled: MyRoutineEntry = {
    ...r,
    lastCompletedDay: nowDone ? null : today,
  }
  const copy = [...list]
  copy[idx] = toggled
  return { next: copy, toggled }
}

type LocalPendingAttach = {
  key: string
  file: File
  previewUrl: string
}

function appendPendingAttach(
  prev: LocalPendingAttach[],
  files: FileList | null,
): LocalPendingAttach[] {
  if (!files?.length) return prev
  const next = [...prev]
  for (let i = 0; i < files.length && next.length < MAX_LOG_ATTACHMENTS; i++) {
    const file = files.item(i)
    if (
      !file ||
      (!file.type.startsWith('image/') && !file.type.startsWith('video/'))
    )
      continue
    next.push({
      key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }
  return next
}

function DiaryTimelineEmotionIcon({
  tag,
  surface,
}: {
  tag: MoodTag
  surface: OceanSurfaceVariant
}) {
  const e = moodTagToEmotion(tag)
  const accent = timelineIconAccentClass(tag, surface)
  const isLight = surface === 'surface'
  const ring =
    e === 'typhoon'
      ? isLight
        ? 'border-orange-300/90 bg-gradient-to-br from-rose-50 to-orange-50 shadow-orange-100/50'
        : 'border-orange-500/60 bg-gradient-to-br from-rose-950/90 to-orange-950/80 shadow-black/30'
      : e === 'fairWind'
        ? isLight
          ? 'border-emerald-300/90 bg-gradient-to-br from-emerald-50 to-cyan-50 shadow-emerald-100/40'
          : 'border-emerald-500/45 bg-gradient-to-br from-emerald-950/80 to-teal-950/70 shadow-emerald-950/30'
        : isLight
          ? 'border-slate-200/95 bg-white shadow-slate-100/50'
          : 'border-slate-500/50 bg-slate-900/80 shadow-slate-950/40'

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 shadow-md ${ring}`}
      aria-hidden
    >
      {e === 'typhoon' ? (
        <Zap className={`h-5 w-5 ${accent}`} />
      ) : e === 'fairWind' ? (
        <Sailboat className={`h-5 w-5 ${accent}`} />
      ) : (
        <Waves className={`h-5 w-5 ${accent}`} />
      )}
    </span>
  )
}

function depthTier(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 5) return 0
  if (count <= 12) return 1
  if (count <= 20) return 2
  if (count <= 29) return 3
  return 4
}

function depthBackgroundClass(count: number): string {
  switch (depthTier(count)) {
    case 0:
      return 'bg-sky-50'
    case 1:
      return 'bg-sky-200'
    case 2:
      return 'bg-blue-400'
    case 3:
      return 'bg-blue-800'
    default:
      return 'bg-slate-900'
  }
}

/** 현재 항차 기준: 첫 일지 날짜부터 오늘까지의 일차(1부터). 일지 없으면 1일차 */
function voyageDayNumber(
  legId: string | undefined,
  entries: LogEntry[],
): number {
  const leg = legId?.trim()
  if (!leg) return 1
  const legEntries = entries.filter((e) => e.voyageLegId === leg)
  if (legEntries.length === 0) return 1
  const earliest = Math.min(
    ...legEntries.map((e) => new Date(e.createdAt).getTime()),
  )
  const start = new Date(earliest)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff =
    Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
  return Math.max(1, diff)
}

export default function MyOceanPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { showToast } = useToast()
  const [rippleRoutineId, setRippleRoutineId] = useState<string | null>(null)
  const lastCalendarDayRef = useRef(getLocalDayKey())
  const profileSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const [oceanReady, setOceanReady] = useState(false)
  const [voyageProfile, setVoyageProfile] =
    useState<MyVoyageProfile>(getEmptyVoyageProfile)
  const [periodStart] = useState('2026. 3. 2.')
  const [periodEnd] = useState('2026. 11. 30.')

  const [selectedWaveTag, setSelectedWaveTag] =
    useState<WaveMoodTag>('passion')
  const [draft, setDraft] = useState('')
  const [tailwindDraft, setTailwindDraft] = useState('')
  const [emptyGoalDraft, setEmptyGoalDraft] = useState('')
  const [departMilestonesDraft, setDepartMilestonesDraft] = useState('')
  const [goalCategoryId, setGoalCategoryId] = useState('')
  const [departCustomCategoryDraft, setDepartCustomCategoryDraft] =
    useState('')
  const [isDepartCategoryDropdownOpen, setIsDepartCategoryDropdownOpen] =
    useState(false)
  const [newMilestoneDraft, setNewMilestoneDraft] = useState('')
  const recordCategories = useMergedRecordCategories()
  const departCategoryDropdownRef = useRef<HTMLDivElement>(null)

  const departCategoryTriggerLabel = useMemo(() => {
    if (!goalCategoryId) return '선택하지 않음 · 자유 목표'
    if (goalCategoryId === DEPART_NEW_CATEGORY_VALUE) {
      return '[+ 새로운 카테고리 직접 개척하기]'
    }
    const c = recordCategories.find((x) => x.id === goalCategoryId)
    if (!c) return '선택하지 않음 · 자유 목표'
    return `${c.title}${c.status === 'pending' ? ' (심사 중)' : ''}`
  }, [goalCategoryId, recordCategories])
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [voyageMeta, setVoyageMeta] = useState<VoyageMeta>({
    isCompleted: false,
    finalRetrospective: null,
  })
  const [routines, setRoutines] = useState<MyRoutineEntry[]>([])
  const [voyageCompletionPromptOpen, setVoyageCompletionPromptOpen] =
    useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null)
  const [memoTick, setMemoTick] = useState(0)
  const [myRoutineTick, setMyRoutineTick] = useState(0)
  const [customRoutineDraft, setCustomRoutineDraft] = useState('')

  const [wavePendingAttach, setWavePendingAttach] = useState<
    LocalPendingAttach[]
  >([])
  const [twPendingAttach, setTwPendingAttach] = useState<LocalPendingAttach[]>(
    [],
  )
  /** 일지 미디어 Storage 업로드 중 — 중복 제출 방지 */
  const [diarySubmitBusy, setDiarySubmitBusy] = useState<
    'wave' | 'tailwind' | null
  >(null)
  const waveAttachInputRef = useRef<HTMLInputElement>(null)
  const twAttachInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      wavePendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      twPendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [wavePendingAttach, twPendingAttach])

  const entryCount = entries.length
  const tier = depthTier(entryCount)
  const deepWater = tier >= 3
  const abyss = tier >= 4
  const oceanSurface = oceanSurfaceVariant(deepWater, abyss)
  const hasGoal = voyageProfile.goalName.trim().length > 0

  const voyageProgressPct = useMemo(
    () => milestoneProgressPercent(voyageProfile.milestones ?? []),
    [voyageProfile.milestones],
  )
  const nextIncompleteMilestone = useMemo(
    () => firstIncompleteMilestone(voyageProfile.milestones ?? []),
    [voyageProfile.milestones],
  )

  useEffect(() => {
    const bump = () => setMemoTick((t) => t + 1)
    window.addEventListener(VOYAGE_MEMO_UPDATES_EVENT, bump)
    window.addEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    return () => {
      window.removeEventListener(VOYAGE_MEMO_UPDATES_EVENT, bump)
      window.removeEventListener(LIGHTHOUSE_UPDATES_EVENT, bump)
    }
  }, [])

  /** 로컬 자정이 지나면 체크 UI가 날짜에 맞게 갱신되도록 */
  useEffect(() => {
    const id = window.setInterval(() => {
      const today = getLocalDayKey()
      if (today !== lastCalendarDayRef.current) {
        lastCalendarDayRef.current = today
        setMyRoutineTick((t) => t + 1)
      }
    }, 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    setOceanReady(false)
    void (async () => {
      try {
        const bundle = await loadMyOceanBundle(uid)
        if (cancelled) return
        setVoyageProfile(bundle.profile)
        setEntries(bundle.entries)
        setVoyageMeta(bundle.meta)
        setRoutines(bundle.routines)
        setOceanReady(true)
      } catch {
        if (cancelled) return
        showToast({
          kind: 'sync_error',
          message:
            '항해 기록을 불러오지 못했습니다. 네트워크를 확인한 뒤 새로고침 해 주세요.',
        })
        setOceanReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid, showToast])

  useEffect(() => {
    if (!oceanReady || !uid) return
    if (profileSaveTimerRef.current) clearTimeout(profileSaveTimerRef.current)
    profileSaveTimerRef.current = setTimeout(() => {
      profileSaveTimerRef.current = null
      void (async () => {
        try {
          if (!voyageProfile.goalName.trim()) {
            await deleteActiveVoyage(uid)
          } else {
            await setActiveVoyageProfile(uid, voyageProfile)
          }
        } catch {
          showToast({
            kind: 'sync_error',
            message: '목표 정보를 클라우드에 저장하지 못했습니다.',
          })
        }
      })()
    }, 500)
    return () => {
      if (profileSaveTimerRef.current) {
        clearTimeout(profileSaveTimerRef.current)
        profileSaveTimerRef.current = null
      }
    }
  }, [voyageProfile, uid, oceanReady, showToast])

  useEffect(() => {
    if (!oceanReady || !uid) return
    void mergeUserDoc(uid, { voyageMeta }).catch(() => {
      showToast({
        kind: 'sync_error',
        message: '항해 메타 정보 저장에 실패했습니다.',
      })
    })
  }, [voyageMeta, uid, oceanReady, showToast])

  useEffect(() => {
    if (!oceanReady || !uid) return
    void mergeUserDoc(uid, { routines }).catch(() => {
      showToast({
        kind: 'sync_error',
        message: '루틴 목록 저장에 실패했습니다.',
      })
    })
  }, [routines, uid, oceanReady, showToast])

  useEffect(() => {
    const st = location.state as { presetCategoryId?: string } | null
    const id = st?.presetCategoryId?.trim()
    if (!id) return
    setGoalCategoryId(id)
    navigate('.', { replace: true, state: {} })
  }, [location.state, navigate])

  useEffect(() => {
    if (!isDepartCategoryDropdownOpen) return
    function onDocMouseDown(ev: MouseEvent) {
      const el = departCategoryDropdownRef.current
      if (!el?.contains(ev.target as Node)) {
        setIsDepartCategoryDropdownOpen(false)
      }
    }
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setIsDepartCategoryDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isDepartCategoryDropdownOpen])

  /** 구 저장 데이터: 목표만 있고 항차 id가 없으면 부여 후 기존 무항차 일지를 묶음 */
  useEffect(() => {
    if (!oceanReady || !uid) return
    if (!voyageProfile.goalName.trim()) return
    if (voyageProfile.voyageLegId.trim()) return
    const leg = crypto.randomUUID()
    setVoyageProfile((p) => withSyncedVoyageDerived({ ...p, voyageLegId: leg }))
    void migrateLogsAssignLeg(uid, leg)
      .then(() => listLogsForUser(uid))
      .then((fresh) => setEntries(fresh))
      .catch(() => {
        showToast({
          kind: 'sync_error',
          message: '일지와 항차를 연결하지 못했습니다.',
        })
      })
  }, [
    voyageProfile.goalName,
    voyageProfile.voyageLegId,
    oceanReady,
    uid,
    showToast,
  ])

  const lighthouseMemoRefs = useMemo(() => {
    void memoTick
    return loadLighthouses().map((id) => ({
      id,
      label: resolveDisplayName(id),
      memo: getVoyageMemo(id),
    }))
  }, [memoTick])

  const myRoutineEntries = useMemo(() => {
    void myRoutineTick
    return routines
  }, [routines, myRoutineTick])

  function handleRoutineToggle(id: string) {
    const before = routines.find((r) => r.id === id)
    const wasDone = before ? isCompletedToday(before) : false
    if (!wasDone) {
      setRippleRoutineId(id)
      window.setTimeout(() => setRippleRoutineId((cur) => (cur === id ? null : cur)), 650)
    }
    const { next, toggled } = toggleRoutineInList(routines, id)
    setRoutines(next)
    if (
      toggled &&
      !wasDone &&
      isCompletedToday(toggled) &&
      toggled.originUserId
    ) {
      enqueueRoutineAchievementForOrigin(
        toggled.originUserId,
        toggled.label,
        loadProfileApplicantName().trim() || '한 선원',
      )
      showToast({ kind: 'mentor_routine' })
    }
  }

  function handleResetRoutineChecks() {
    setRoutines((prev) =>
      prev.map((r) => ({ ...r, lastCompletedDay: null })),
    )
  }

  function handleAddCustomRoutine() {
    const t = customRoutineDraft.trim()
    if (!t) return
    const res = tryAddRoutineLocal(routines, {
      label: t,
      originUserId: null,
    })
    if (!res.ok && res.reason === 'duplicate') {
      window.alert('같은 문구의 루틴이 이미 있어요.')
      return
    }
    setRoutines(res.next)
    setCustomRoutineDraft('')
  }

  function removeMyRoutine(id: string) {
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }

  const sorted = useMemo(() => {
    const leg = voyageProfile.voyageLegId?.trim()
    return [...entries]
      .filter((e) => {
        if (!leg) return true
        return e.voyageLegId === leg
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [entries, voyageProfile.voyageLegId])

  function handleAddMilestone() {
    const t = newMilestoneDraft.trim()
    if (!t) return
    setVoyageProfile((p) =>
      withSyncedVoyageDerived({
        ...p,
        milestones: [
          ...p.milestones,
          { id: crypto.randomUUID(), label: t, completed: false },
        ],
      }),
    )
    setNewMilestoneDraft('')
  }

  function toggleMilestone(id: string) {
    setVoyageProfile((p) =>
      withSyncedVoyageDerived({
        ...p,
        milestones: p.milestones.map((m) =>
          m.id === id ? { ...m, completed: !m.completed } : m,
        ),
      }),
    )
  }

  function completeMilestoneById(id: string) {
    setVoyageProfile((p) =>
      withSyncedVoyageDerived({
        ...p,
        milestones: p.milestones.map((m) =>
          m.id === id ? { ...m, completed: true } : m,
        ),
      }),
    )
  }

  function pickDepartCategory(value: string) {
    setGoalCategoryId(value)
    if (value !== DEPART_NEW_CATEGORY_VALUE) {
      setDepartCustomCategoryDraft('')
    }
    setIsDepartCategoryDropdownOpen(false)
  }

  function handleDepart(e: React.FormEvent) {
    e.preventDefault()
    const name = emptyGoalDraft.trim()
    if (!name) {
      showToast({
        kind: 'sync_error',
        message: '항해 목표를 먼저 입력해 주세요!',
      })
      return
    }

    let resolvedCategoryId: string | null = null
    if (goalCategoryId === DEPART_NEW_CATEGORY_VALUE) {
      const customTitle = departCustomCategoryDraft.trim()
      if (!customTitle) {
        window.alert('새 카테고리 이름을 한 줄 이상 입력해 주세요.')
        return
      }
      const newId = registerCustomRecordCategory(customTitle)
      if (!newId) {
        window.alert('카테고리를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      resolvedCategoryId = newId
    } else if (goalCategoryId.trim()) {
      resolvedCategoryId = goalCategoryId.trim()
    }

    const lines = departMilestonesDraft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const milestones: MyVoyageProfile['milestones'] =
      lines.length === 0
        ? []
        : lines.map((label) => ({
            id: crypto.randomUUID(),
            label,
            completed: false,
          }))
    setVoyageProfile(
      withSyncedVoyageDerived({
        goalName: name,
        inspiredBy: null,
        subGoal: '',
        progressPercent: 0,
        linkedCategoryId: resolvedCategoryId,
        voyageLegId: crypto.randomUUID(),
        milestones,
      }),
    )
    setEmptyGoalDraft('')
    setGoalCategoryId('')
    setDepartCustomCategoryDraft('')
    setDepartMilestonesDraft('')
  }

  const voyageDay = useMemo(
    () => voyageDayNumber(voyageProfile.voyageLegId, entries),
    [voyageProfile.voyageLegId, entries],
  )

  async function handleSubmitWave(e: React.FormEvent) {
    e.preventDefault()
    if (diarySubmitBusy) return
    const textTrim = draft.trim()
    if (!textTrim && wavePendingAttach.length === 0) return

    const entryId = crypto.randomUUID()

    let legId = voyageProfile.voyageLegId.trim()
    if (!legId && voyageProfile.goalName.trim()) {
      legId = crypto.randomUUID()
      setVoyageProfile((p) => ({ ...p, voyageLegId: legId }))
      if (uid) {
        void migrateLogsAssignLeg(uid, legId).catch(() => {
          showToast({
            kind: 'sync_error',
            message: '일지 항차 정보를 갱신하지 못했습니다.',
          })
        })
      }
    }

    let attachments: LogAttachment[] | undefined
    if (wavePendingAttach.length > 0) {
      const useStorage = Boolean(uid && isFirebaseConfigured())
      if (useStorage) {
        setDiarySubmitBusy('wave')
        try {
          attachments = await Promise.all(
            wavePendingAttach.map(async (p) => {
              const attId = crypto.randomUUID()
              const type: LogAttachment['type'] = p.file.type.startsWith(
                'video/',
              )
                ? 'video'
                : 'image'
              const mediaUrl = await uploadDiaryAttachment(
                uid,
                entryId,
                attId,
                p.file,
              )
              return { id: attId, type, mediaUrl }
            }),
          )
        } catch {
          showToast({
            kind: 'sync_error',
            message:
              '파일 업로드에 실패했습니다. 네트워크와 Storage 규칙을 확인해 주세요.',
          })
          setDiarySubmitBusy(null)
          return
        }
        wavePendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        setWavePendingAttach([])
        setDiarySubmitBusy(null)
      } else {
        const built = await Promise.all(
          wavePendingAttach.map(async (p) => {
            const dataUrl = await fileToDataUrl(p.file)
            const type: LogAttachment['type'] = p.file.type.startsWith(
              'video/',
            )
              ? 'video'
              : 'image'
            return {
              id: crypto.randomUUID(),
              type,
              dataUrl,
            }
          }),
        )
        attachments = built
        wavePendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        setWavePendingAttach([])
      }
    }

    const body =
      textTrim ||
      (attachments?.length ? '(미디어만 첨부한 날)' : '')
    const next: LogEntry = {
      id: entryId,
      tag: selectedWaveTag,
      body,
      createdAt: new Date().toISOString(),
      inspiredCount: 0,
      ...(legId ? { voyageLegId: legId } : {}),
      ...(attachments?.length ? { attachments } : {}),
    }
    setEntries((prev) => [next, ...prev])
    setDraft('')
    if (waveAttachInputRef.current) waveAttachInputRef.current.value = ''
    if (uid) {
      void upsertLog(uid, next).catch(() => {
        showToast({
          kind: 'sync_error',
          message: '일지를 클라우드에 저장하지 못했습니다. 네트워크를 확인해 주세요.',
        })
      })
    }
  }

  function removeWaveAttach(key: string) {
    setWavePendingAttach((prev) => {
      const t = prev.find((x) => x.key === key)
      if (t) URL.revokeObjectURL(t.previewUrl)
      return prev.filter((x) => x.key !== key)
    })
  }

  function removeTwAttach(key: string) {
    setTwPendingAttach((prev) => {
      const t = prev.find((x) => x.key === key)
      if (t) URL.revokeObjectURL(t.previewUrl)
      return prev.filter((x) => x.key !== key)
    })
  }

  async function handleSubmitTailwind(e: React.FormEvent) {
    e.preventDefault()
    if (diarySubmitBusy) return
    const textTrim = tailwindDraft.trim()
    if (!textTrim && twPendingAttach.length === 0) return

    const entryId = crypto.randomUUID()

    let legId = voyageProfile.voyageLegId.trim()
    if (!legId && voyageProfile.goalName.trim()) {
      legId = crypto.randomUUID()
      setVoyageProfile((p) => ({ ...p, voyageLegId: legId }))
      if (uid) {
        void migrateLogsAssignLeg(uid, legId).catch(() => {
          showToast({
            kind: 'sync_error',
            message: '일지 항차 정보를 갱신하지 못했습니다.',
          })
        })
      }
    }

    let attachments: LogAttachment[] | undefined
    if (twPendingAttach.length > 0) {
      const useStorage = Boolean(uid && isFirebaseConfigured())
      if (useStorage) {
        setDiarySubmitBusy('tailwind')
        try {
          attachments = await Promise.all(
            twPendingAttach.map(async (p) => {
              const attId = crypto.randomUUID()
              const type: LogAttachment['type'] = p.file.type.startsWith(
                'video/',
              )
                ? 'video'
                : 'image'
              const mediaUrl = await uploadDiaryAttachment(
                uid,
                entryId,
                attId,
                p.file,
              )
              return { id: attId, type, mediaUrl }
            }),
          )
        } catch {
          showToast({
            kind: 'sync_error',
            message:
              '파일 업로드에 실패했습니다. 네트워크와 Storage 규칙을 확인해 주세요.',
          })
          setDiarySubmitBusy(null)
          return
        }
        twPendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        setTwPendingAttach([])
        setDiarySubmitBusy(null)
      } else {
        const built = await Promise.all(
          twPendingAttach.map(async (p) => {
            const dataUrl = await fileToDataUrl(p.file)
            const type: LogAttachment['type'] = p.file.type.startsWith(
              'video/',
            )
              ? 'video'
              : 'image'
            return {
              id: crypto.randomUUID(),
              type,
              dataUrl,
            }
          }),
        )
        attachments = built
        twPendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
        setTwPendingAttach([])
      }
    }

    const body =
      textTrim ||
      (attachments?.length ? '(미디어만 첨부한 날)' : '')
    const next: LogEntry = {
      id: entryId,
      tag: 'tailwind',
      body,
      createdAt: new Date().toISOString(),
      inspiredCount: 0,
      ...(legId ? { voyageLegId: legId } : {}),
      ...(attachments?.length ? { attachments } : {}),
    }
    setEntries((prev) => [next, ...prev])
    setTailwindDraft('')
    if (twAttachInputRef.current) twAttachInputRef.current.value = ''
    if (uid) {
      void upsertLog(uid, next).catch(() => {
        showToast({
          kind: 'sync_error',
          message: '일지를 클라우드에 저장하지 못했습니다. 네트워크를 확인해 주세요.',
        })
      })
    }
  }

  function diaryEntriesForArchive(): LogEntry[] {
    const leg = voyageProfile.voyageLegId.trim()
    if (!leg) return [...entries]
    return entries.filter((e) => e.voyageLegId === leg)
  }

  /** 완료 항해를 Firestore에 아카이브한 뒤 활성 항해·일지·유저 메타를 비웁니다. */
  async function archiveVoyageToFirestoreAndClear(completedAt: string) {
    const synced = withSyncedVoyageDerived(voyageProfile)
    await appendArchivedVoyage(uid, {
      completedAt,
      goalName: synced.goalName.trim() || '나의 항해',
      voyageLegId: synced.voyageLegId.trim(),
      linkedCategoryId: synced.linkedCategoryId,
      progressPercent: synced.progressPercent,
      subGoal: synced.subGoal,
      diaryEntries: diaryEntriesForArchive(),
      activeGoalSnapshot: synced,
    })
    await deleteActiveVoyage(uid)
    await deleteAllLogsForUser(uid)
    const freshMeta: VoyageMeta = {
      isCompleted: false,
      finalRetrospective: null,
    }
    await mergeUserDoc(uid, { routines: [], voyageMeta: freshMeta })
  }

  /** 활성 항해·일지·루틴·메타 UI 상태 동기화 (Firestore는 별도 성공 후 호출) */
  function resetLocalOceanAfterArchive() {
    const freshMeta: VoyageMeta = {
      isCompleted: false,
      finalRetrospective: null,
    }
    wavePendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    twPendingAttach.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setWavePendingAttach([])
    setTwPendingAttach([])

    setVoyageProfile(getEmptyVoyageProfile())
    setEntries([])
    setRoutines([])
    setVoyageMeta(freshMeta)
    setDraft('')
    setTailwindDraft('')
    setNewMilestoneDraft('')
    setEmptyGoalDraft('')
    setDepartMilestonesDraft('')
    setGoalCategoryId('')
    setSelectedWaveTag('passion')
    setCustomRoutineDraft('')
    setMyRoutineTick((t) => t + 1)
    setVoyageCompletionPromptOpen(false)
  }

  function buildVoyageRecordPrefill(): VoyageRecordPrefill {
    const synced = withSyncedVoyageDerived(voyageProfile)
    const leg = synced.voyageLegId.trim()
    const diaryEntries = leg
      ? entries.filter((e) => e.voyageLegId === leg)
      : [...entries]
    const cheerAgg = aggregateDefaultCheersForDiaryIds(
      diaryEntries.map((e) => e.id),
      loadCheerReactions(),
    )
    return {
      diaryEntries,
      excludedDiaryIds: [],
      initialCategoryId: synced.linkedCategoryId,
      goalNameSnapshot:
        synced.goalName.trim() || '나의 항해',
      recordValueSuggestion:
        synced.progressPercent > 0
          ? `${synced.progressPercent}% 달성`
          : '',
      ...(cheerAgg.total > 0
        ? {
            communityCheerTotal: cheerAgg.total,
            communityCheerByEmoji: cheerAgg.byEmoji,
          }
        : {}),
    }
  }

  function handleVoyageCompletePromptOpen() {
    setVoyageCompletionPromptOpen(true)
  }

  function handleVoyageCompletionDismiss() {
    setVoyageCompletionPromptOpen(false)
  }

  async function handleVoyageCompletionNoRecord() {
    if (!uid) {
      showToast({
        kind: 'sync_error',
        message: '로그인 정보를 확인할 수 없어 항해를 마무리할 수 없습니다.',
      })
      return
    }
    const completedAt = new Date().toISOString()
    try {
      await archiveVoyageToFirestoreAndClear(completedAt)
      resetLocalOceanAfterArchive()
      showToast({ kind: 'voyage_archived' })
      navigate('/', { replace: true })
    } catch {
      showToast({
        kind: 'sync_error',
        message: '항해 완료 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      })
    }
  }

  async function handleVoyageCompletionToGannessRecord() {
    if (!uid) {
      showToast({
        kind: 'sync_error',
        message: '로그인 정보를 확인할 수 없어 항해를 마무리할 수 없습니다.',
      })
      return
    }
    const voyageRecordPrefill = buildVoyageRecordPrefill()
    const completedAt = new Date().toISOString()
    try {
      await archiveVoyageToFirestoreAndClear(completedAt)
      resetLocalOceanAfterArchive()
      showToast({ kind: 'voyage_archived' })
      navigate('/records', {
        replace: true,
        state: {
          openRecordSubmission: true,
          voyageRecordPrefill,
        },
      })
    } catch {
      showToast({
        kind: 'sync_error',
        message: '항해 완료 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      })
    }
  }

  const rootBg = depthBackgroundClass(entryCount)

  const waveCardClass = `rounded-2xl border p-5 shadow-md backdrop-blur-sm transition-colors duration-1000 ease-in-out ${
    deepWater
      ? abyss
        ? 'border-slate-600/60 bg-slate-800/45 shadow-black/30'
        : 'border-white/20 bg-white/10 shadow-black/20'
      : 'border-emerald-100/90 bg-white/85 shadow-emerald-100/40'
  }`

  const labelTone = abyss
    ? 'text-slate-100'
    : deepWater
      ? 'text-white'
      : 'text-slate-800'

  const mutedTone = abyss
    ? 'text-slate-400'
    : deepWater
      ? 'text-white/75'
      : 'text-slate-500'

  const shellBg = hasGoal
    ? `min-h-screen transition-colors duration-1000 ease-in-out ${rootBg}`
    : 'min-h-screen bg-gradient-to-b from-sky-100 via-cyan-50/70 to-indigo-100 transition-colors duration-500'

  return (
    <div className={shellBg}>
      {uid && !oceanReady && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-sky-200 via-cyan-100 to-indigo-200/95 px-6 text-center shadow-inner"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="relative flex h-20 w-20 items-center justify-center">
            <Waves
              className="absolute h-16 w-16 text-cyan-500/90 animate-pulse"
              aria-hidden
            />
            <Sailboat
              className="relative z-[1] h-9 w-9 text-indigo-700 drop-shadow-md motion-safe:animate-bounce"
              aria-hidden
            />
          </div>
          <p className="max-w-xs text-sm font-semibold leading-snug text-slate-700">
            항해 기록을 불러오는 중입니다...
          </p>
          <div
            className="h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-500/30 border-t-cyan-600"
            aria-hidden
          />
        </div>
      )}
      {hasGoal && (
        <div
          className="pointer-events-none fixed inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/10"
          aria-hidden
        />
      )}

      <main
        className={
          hasGoal
            ? `relative mx-auto max-w-lg px-4 pb-32 pt-10 sm:px-6 sm:pb-36 ${
                abyss
                  ? 'text-slate-200'
                  : deepWater
                    ? 'text-white'
                    : 'text-slate-900'
              }`
            : 'relative mx-auto flex min-h-[calc(100svh-5.5rem)] max-w-lg flex-col justify-center px-4 pb-32 pt-12 text-slate-900 sm:px-6 sm:pb-36'
        }
      >
        {!hasGoal ? (
          <section className="w-full rounded-3xl border border-sky-200/90 bg-white/90 p-8 shadow-xl shadow-sky-200/40 backdrop-blur-sm sm:p-10">
            <Ship
              className="mx-auto mb-5 h-16 w-16 text-sky-600"
              strokeWidth={1.25}
              aria-hidden
            />
            <h2 className="text-center text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl">
              어떤 목표를 향해 돛을 올릴까요?
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              목표 한 줄과 성격(카테고리)을 정한 뒤 출항하면 항해 일지와 달성률을 기록할
              수 있어요.
            </p>
            <form onSubmit={handleDepart} className="mx-auto mt-8 max-w-md space-y-5">
              <div className="space-y-2">
                <label
                  id="goal-category-label"
                  htmlFor="goal-category-trigger"
                  className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  목표의 성격 (카테고리)
                </label>
                <div ref={departCategoryDropdownRef} className="relative">
                  <button
                    id="goal-category-trigger"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isDepartCategoryDropdownOpen}
                    aria-controls="depart-category-listbox"
                    aria-labelledby="goal-category-label"
                    onClick={() =>
                      setIsDepartCategoryDropdownOpen((o) => !o)
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none ring-sky-200/60 transition hover:border-blue-300 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {departCategoryTriggerLabel}
                    </span>
                    <ChevronDown
                      strokeWidth={2}
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ease-out ${
                        isDepartCategoryDropdownOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  <ul
                    id="depart-category-listbox"
                    role="listbox"
                    aria-labelledby="goal-category-label"
                    className={`absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 origin-top overflow-y-auto rounded-2xl border border-blue-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5 transition-[opacity,transform,visibility] duration-200 ease-out ${
                      isDepartCategoryDropdownOpen
                        ? 'pointer-events-auto visible translate-y-0 opacity-100'
                        : 'pointer-events-none invisible -translate-y-1 opacity-0'
                    }`}
                  >
                    <li role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={goalCategoryId === ''}
                        onClick={() => pickDepartCategory('')}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        선택하지 않음 · 자유 목표
                      </button>
                    </li>
                    {recordCategories.map((c) => (
                      <li key={c.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={goalCategoryId === c.id}
                          onClick={() => pickDepartCategory(c.id)}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        >
                          {c.title}
                          {c.status === 'pending' ? ' (심사 중)' : ''}
                        </button>
                      </li>
                    ))}
                    <li role="presentation" className="border-t border-slate-100">
                      <button
                        type="button"
                        role="option"
                        aria-selected={
                          goalCategoryId === DEPART_NEW_CATEGORY_VALUE
                        }
                        onClick={() =>
                          pickDepartCategory(DEPART_NEW_CATEGORY_VALUE)
                        }
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        [+ 새로운 카테고리 직접 개척하기]
                      </button>
                    </li>
                  </ul>
                </div>
                {goalCategoryId === DEPART_NEW_CATEGORY_VALUE && (
                  <div className="animate-cheer-bubble-in space-y-1.5 pt-1">
                    <label
                      htmlFor="depart-custom-category"
                      className="block text-[11px] font-bold uppercase tracking-wide text-sky-700/90"
                    >
                      개척할 카테고리 이름
                    </label>
                    <input
                      id="depart-custom-category"
                      type="text"
                      value={departCustomCategoryDraft}
                      onChange={(e) =>
                        setDepartCustomCategoryDraft(e.target.value)
                      }
                      placeholder="예: 잉여로움, 낮잠, 수업 중 몰래 듣는 플레이리스트…"
                      autoComplete="off"
                      className="w-full rounded-2xl border border-sky-200/90 bg-sky-50/60 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-inner outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="new-goal"
                  className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  항해 목표
                </label>
                <input
                  id="new-goal"
                  type="text"
                  value={emptyGoalDraft}
                  onChange={(e) => setEmptyGoalDraft(e.target.value)}
                  placeholder="예: 우리 학교에서 하루에 낮잠 제일 많이 잔 사람"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="depart-milestones"
                  className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  세부 단계 (선택 · 한 줄에 하나씩)
                </label>
                <textarea
                  id="depart-milestones"
                  value={departMilestonesDraft}
                  onChange={(e) => setDepartMilestonesDraft(e.target.value)}
                  rows={4}
                  placeholder={'예:\n1단계: 슛 폼 교정\n2단계: 50개 성공'}
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <button
                type="submit"
                disabled={
                  goalCategoryId === DEPART_NEW_CATEGORY_VALUE &&
                  !departCustomCategoryDraft.trim()
                }
                className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-300/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                출항하기
              </button>
            </form>
          </section>
        ) : (
          <>
        <header className="mb-8 text-center">
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm ${
              abyss
                ? 'border-slate-600/80 bg-slate-800/50 text-slate-200'
                : deepWater
                  ? 'border-white/25 bg-white/15 text-white'
                  : 'border-sky-200/80 bg-white/70 text-sky-800'
            }`}
          >
            <Anchor className="h-3.5 w-3.5" aria-hidden />
            연대의 항해 · 마이페이지
          </div>
          <h1
            className={`flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl ${
              abyss
                ? 'text-white'
                : deepWater
                  ? 'text-white'
                  : 'text-slate-900'
            }`}
          >
            <BookOpen
              className={
                abyss
                  ? 'h-8 w-8 text-sky-300'
                  : deepWater
                    ? 'h-8 w-8 text-sky-200'
                    : 'h-8 w-8 text-sky-600'
              }
              strokeWidth={1.75}
            />
            나의 항해 일지
          </h1>
        </header>

        <VoyageMilestoneBanner voyageMeta={voyageMeta} />

        {lighthouseMemoRefs.length > 0 && (
          <section
            className={`mb-8 rounded-2xl border p-5 shadow-md backdrop-blur-sm ${
              abyss
                ? 'border-amber-500/30 bg-amber-950/25'
                : deepWater
                  ? 'border-amber-200/40 bg-amber-50/15'
                  : 'border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-white shadow-amber-100/50'
            }`}
            aria-label="등대 선원 비망록"
          >
            <p
              className={`text-center text-sm font-bold ${labelTone}`}
            >
              <span aria-hidden className="mr-1">
                🏮
              </span>
              등대 선원의 비망록
            </p>
            <p className={`mt-1 text-center text-xs ${mutedTone}`}>
              역할 모델로 등록한 분들의 루틴·극복 방법을 참고해 보세요.
            </p>
            <ul className="mt-4 space-y-4">
              {lighthouseMemoRefs.map(({ id, label, memo }) => (
                <li
                  key={id}
                  className={`rounded-xl border p-4 ${
                    abyss
                      ? 'border-white/15 bg-black/25'
                      : deepWater
                        ? 'border-white/20 bg-white/10'
                        : 'border-amber-100/90 bg-white/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/mate/${encodeURIComponent(id)}`}
                      className={`text-sm font-bold underline decoration-amber-400/80 underline-offset-2 ${
                        abyss ? 'text-amber-200' : 'text-amber-950'
                      }`}
                    >
                      {label}
                    </Link>
                  </div>
                  {!memo ||
                  (!memo.dailyRoutines.length &&
                    !memo.crisisMethodology.trim()) ? (
                    <p className={`mt-2 text-xs ${mutedTone}`}>
                      아직 공개된 비망록이 없어요. 상대가 기록 신청 시 적거나, 명예의 전당에
                      등재되면 여기에 나타납니다.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {memo.dailyRoutines.length > 0 && (
                        <div>
                          <p
                            className={`text-[11px] font-bold uppercase tracking-wide ${mutedTone}`}
                          >
                            데일리 루틴
                          </p>
                          <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm leading-snug">
                            {memo.dailyRoutines.map((line, i) => (
                              <li key={`${id}-r-${i}`}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {memo.crisisMethodology.trim().length > 0 && (
                        <div>
                          <p
                            className={`text-[11px] font-bold uppercase tracking-wide ${mutedTone}`}
                          >
                            태풍(위기) 극복
                          </p>
                          <p
                            className={`mt-1.5 whitespace-pre-wrap text-sm leading-relaxed ${labelTone}`}
                          >
                            {memo.crisisMethodology}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

            <section
              className={`mb-6 rounded-2xl border p-6 shadow-xl backdrop-blur-sm transition-colors duration-1000 ease-in-out ${
                deepWater
                  ? abyss
                    ? 'border-slate-600/60 bg-slate-800/50 shadow-black/30'
                    : 'border-white/25 bg-white/10 shadow-black/25'
                  : 'border-sky-100/90 bg-white/85 shadow-sky-100/50'
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  abyss
                    ? 'text-sky-300/90'
                    : deepWater
                      ? 'text-sky-100'
                      : 'text-sky-700'
                }`}
              >
                현재 목표
              </p>
              <p
                className={`mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${
                  abyss ? 'text-white' : deepWater ? 'text-white' : 'text-slate-900'
                }`}
              >
                {voyageProfile.goalName}
              </p>
              <p
                className={`mt-2 text-sm font-semibold tabular-nums ${
                  abyss
                    ? 'text-sky-200/90'
                    : deepWater
                      ? 'text-sky-100'
                      : 'text-sky-800'
                }`}
              >
                항해 {voyageDay}일차
              </p>
              {voyageProfile.linkedCategoryId && (
                <p
                  className={`mt-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                    abyss
                      ? 'border-amber-400/60 bg-amber-600/35 text-amber-50'
                      : deepWater
                        ? 'border-amber-400/60 bg-amber-500/30 text-amber-50'
                        : 'border-amber-300 bg-amber-100 text-amber-900'
                  }`}
                >
                  <Sparkles
                    className={`h-3.5 w-3.5 shrink-0 ${
                      deepWater ? 'text-amber-100' : 'text-amber-700'
                    }`}
                    aria-hidden
                  />
                  명예의 전당 기록과 연결됨
                </p>
              )}
              {voyageProfile.inspiredBy && (
                <p
                  className={`mt-3 inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl border px-3 py-1.5 text-xs font-medium leading-snug shadow-sm ${
                    abyss
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                      : deepWater
                        ? 'border-amber-300/50 bg-amber-400/20 text-amber-50'
                        : 'border-amber-200/90 bg-gradient-to-r from-amber-50 to-sky-50 text-amber-950'
                  }`}
                >
                  <span aria-hidden>✨</span>
                  <span className="font-semibold">{voyageProfile.inspiredBy}</span>
                  <span>의 기록에서 영감을 받음</span>
                </p>
              )}
              <p
                className={`mt-4 flex flex-wrap items-center gap-1.5 text-sm ${mutedTone}`}
              >
                <CalendarDays className="h-4 w-4 shrink-0 opacity-80" />
                <span>
                  {periodStart} — {periodEnd}
                </span>
              </p>

              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wide ${mutedTone}`}>
                    달성률
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      deepWater ? 'text-sky-200' : 'text-sky-700'
                    }`}
                  >
                    {voyageProgressPct}%
                  </span>
                </div>
                <div
                  className="relative h-12 overflow-hidden rounded-2xl border border-sky-300/40 bg-gradient-to-b from-sky-200/95 via-sky-400/50 to-[#0c4a6e] shadow-inner ring-1 ring-white/20"
                  role="progressbar"
                  aria-valuenow={voyageProgressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="전체 달성률"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-[38%] z-[2] h-[2px] bg-gradient-to-r from-amber-100/90 via-amber-50/80 to-transparent opacity-90 shadow-[0_0_12px_rgba(254,243,199,0.45)]"
                  />
                  <div
                    className="absolute inset-y-0 left-0 z-[1] rounded-r-md bg-gradient-to-t from-cyan-900/95 via-sky-500/90 to-sky-100/95 opacity-[0.97] shadow-[inset_0_-8px_24px_rgba(14,165,233,0.35)] transition-[width] duration-700 ease-out"
                    style={{ width: `${voyageProgressPct}%` }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-px bg-white/35" />
                  <div className="pointer-events-none absolute inset-x-0 top-[38%] z-[3] h-px bg-sky-950/25" />
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${mutedTone}`}>
                  완료한 세부 단계 비율로 자동 계산돼요. 단계는 아래에서 추가·체크할 수
                  있어요.
                </p>
              </div>

              <div
                className={`mt-8 border-t pt-7 ${
                  deepWater ? 'border-white/10' : 'border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListChecks
                    className={`h-5 w-5 shrink-0 ${
                      deepWater ? 'text-indigo-200' : 'text-indigo-600'
                    }`}
                    aria-hidden
                  />
                  <h3 className={`text-sm font-bold tracking-wide ${mutedTone}`}>
                    세부 단계{' '}
                    <span
                      className={`font-semibold ${
                        deepWater ? 'text-indigo-200/95' : 'text-indigo-600'
                      }`}
                    >
                      (Milestones)
                    </span>
                  </h3>
                </div>
                {voyageProfile.milestones.length === 0 ? (
                  <p className={`mt-3 text-sm ${mutedTone}`}>
                    아직 단계가 없어요. 출항할 때 적었거나, 아래에서 한 줄씩 추가해
                    보세요.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {voyageProfile.milestones.map((m) => (
                      <li
                        key={m.id}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                          deepWater
                            ? abyss
                              ? 'border-slate-600/80 bg-slate-900/40'
                              : 'border-white/20 bg-white/10'
                            : 'border-slate-200 bg-white/90'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={m.completed}
                          onChange={() => toggleMilestone(m.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`「${m.label}」 완료 표시`}
                        />
                        <span
                          className={`min-w-0 flex-1 leading-snug ${
                            m.completed
                              ? 'text-slate-400 line-through'
                              : abyss
                                ? 'text-slate-100'
                                : deepWater
                                  ? 'text-white'
                                  : 'text-slate-800'
                          }`}
                        >
                          {m.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newMilestoneDraft}
                    onChange={(e) => setNewMilestoneDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddMilestone()
                      }
                    }}
                    placeholder="새 세부 단계 입력 후 추가"
                    className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                      deepWater
                        ? abyss
                          ? 'border-slate-600 bg-slate-900/50 text-slate-100 focus:border-indigo-400 focus:ring-indigo-500/25'
                          : 'border-white/30 bg-white/95 text-slate-900 focus:ring-indigo-300/40'
                        : 'border-slate-200 bg-white text-slate-800 focus:border-indigo-400 focus:ring-indigo-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-105 active:scale-[0.98] ${
                      deepWater
                        ? abyss
                          ? 'border-indigo-400/50 bg-indigo-500/25 text-indigo-100'
                          : 'border-indigo-300/60 bg-indigo-500/30 text-white'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    추가
                  </button>
                </div>
              </div>

              <div
                className={`mt-8 flex items-start gap-3 border-t pt-7 ${
                  deepWater
                    ? 'border-white/10'
                    : 'border-slate-200/90'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    deepWater
                      ? 'bg-indigo-500/20 text-indigo-100'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  <Compass className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm font-bold tracking-wide ${mutedTone}`}>
                    다음 단계{' '}
                    <span
                      className={`font-semibold ${
                        deepWater ? 'text-indigo-200/95' : 'text-indigo-600'
                      }`}
                    >
                      (Next Step)
                    </span>
                  </h3>
                  {nextIncompleteMilestone ? (
                    <>
                      <p
                        className={`mt-2 text-base font-semibold leading-snug ${
                          abyss ? 'text-white' : deepWater ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {nextIncompleteMilestone.label}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          completeMilestoneById(nextIncompleteMilestone.id)
                        }
                        className={`mt-3 inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm transition hover:brightness-105 active:scale-[0.98] ${
                          deepWater
                            ? abyss
                              ? 'border-emerald-400/50 bg-emerald-600/35 text-emerald-50'
                              : 'border-emerald-300/70 bg-emerald-500/35 text-white'
                            : 'border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        }`}
                      >
                        완료하기
                      </button>
                    </>
                  ) : voyageProfile.milestones.length === 0 ? (
                    <p className={`mt-2 text-sm leading-relaxed ${mutedTone}`}>
                      세부 단계를 먼저 추가하면, 아직 끝내지 않은 첫 번째 단계가 여기에
                      표시돼요.
                    </p>
                  ) : (
                    <p className={`mt-2 text-sm leading-relaxed ${mutedTone}`}>
                      모든 세부 단계를 완료했어요. 항해를 마무리하고 기록을 남겨 볼까요?
                    </p>
                  )}
                </div>
              </div>

              <div className="relative z-[55] mt-8 scroll-mt-28 pointer-events-auto isolate">
                <button
                  type="button"
                  onClick={handleVoyageCompletePromptOpen}
                  className={`w-full rounded-2xl border-2 py-4 text-base font-bold shadow-lg transition hover:brightness-110 active:scale-[0.99] sm:py-5 sm:text-lg ${
                    abyss
                      ? 'border-amber-400/70 bg-gradient-to-r from-amber-600 to-orange-600 text-amber-50 shadow-amber-900/40'
                      : deepWater
                        ? 'border-amber-200/80 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-black/30'
                        : 'border-amber-400/90 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-orange-200/50'
                  }`}
                >
                  🏁 항해 완료 및 기록 신청하기
                </button>
              </div>
            </section>

            <section className="mb-5">
              <h2
                className={`text-center text-base font-bold tracking-tight sm:text-left ${labelTone}`}
              >
                항해 일지 · 미디어 타임라인
              </h2>
              <p className={`mt-1 text-center text-xs leading-relaxed sm:text-left ${mutedTone}`}>
                글 옆에서 사진·영상을 첨부하고 기록하면 아래 타임라인에 날짜와 미디어가 함께
                쌓여요. 순풍 · 파도 · 태풍은 색으로 구분됩니다.
              </p>
            </section>

            {diarySubmitBusy && (
              <div
                className={`mb-4 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
                  abyss
                    ? 'border-sky-500/35 bg-slate-900/65 text-sky-100'
                    : deepWater
                      ? 'border-white/25 bg-white/15 text-white'
                      : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                파일을 싣는 중입니다...
              </div>
            )}

            <div className="mb-10 grid gap-4 sm:grid-cols-2">
              <section className={waveCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <Waves className="h-5 w-5 opacity-90" aria-hidden />
                  <p className={`text-base font-semibold ${labelTone}`}>오늘의 파도</p>
                </div>
                <p className={`text-sm ${mutedTone}`}>
                  시행착오와 마음의 물결을 남겨요.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((t) => {
                    const on = selectedWaveTag === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedWaveTag(t.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-1000 ease-in-out ${
                          on
                            ? abyss
                              ? 'border-sky-400/80 bg-slate-700/80 text-slate-100 shadow-inner shadow-black/30'
                              : deepWater
                                ? 'border-sky-300 bg-white/20 text-white shadow-inner shadow-black/20'
                                : 'border-sky-400 bg-sky-100 text-sky-900 shadow-inner shadow-sky-200/50'
                            : abyss
                              ? 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                              : deepWater
                                ? 'border-white/25 bg-white/10 text-white/90 hover:bg-white/15'
                                : 'border-slate-200 bg-white/90 text-slate-600 hover:border-sky-200 hover:bg-sky-50/80'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
                <form onSubmit={handleSubmitWave} className="mt-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="log-body" className="sr-only">
                        오늘의 파도 기록
                      </label>
                      <textarea
                        id="log-body"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={5}
                        placeholder="오늘의 시행착오나 깨달음…"
                        className={`min-h-[10rem] w-full resize-y rounded-xl border px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                          deepWater
                            ? abyss
                              ? 'border-slate-600 bg-slate-900/60 text-slate-100 focus:border-sky-500 focus:ring-sky-500/30'
                              : 'border-white/30 bg-white/95 text-slate-900 focus:border-sky-400 focus:ring-sky-300/50'
                            : 'border-slate-200 bg-white/95 text-slate-800 focus:border-sky-400 focus:ring-sky-200'
                        }`}
                      />
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-[11.5rem]">
                      <input
                        ref={waveAttachInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          setWavePendingAttach((prev) =>
                            appendPendingAttach(prev, e.target.files),
                          )
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => waveAttachInputRef.current?.click()}
                        disabled={
                          diarySubmitBusy !== null ||
                          wavePendingAttach.length >= MAX_LOG_ATTACHMENTS
                        }
                        className={`inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-40 ${
                          abyss
                            ? 'border-slate-500 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                            : deepWater
                              ? 'border-white/30 bg-white/15 text-white hover:bg-white/25'
                              : 'border-sky-200 bg-white text-sky-900 hover:bg-sky-50'
                        }`}
                      >
                        <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                        사진·영상 첨부
                      </button>
                      <p className={`text-center text-[11px] ${mutedTone}`}>
                        {wavePendingAttach.length}/{MAX_LOG_ATTACHMENTS}개
                      </p>
                      {wavePendingAttach.length > 0 && (
                        <ul
                          className="flex max-h-48 flex-wrap content-start gap-2 overflow-y-auto sm:flex-col sm:flex-nowrap"
                          aria-label="첨부 미리보기"
                        >
                          {wavePendingAttach.map((p) => (
                            <li
                              key={p.key}
                              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-sm sm:h-24 sm:w-full sm:max-w-none"
                            >
                              {p.file.type.startsWith('video') ? (
                                <video
                                  src={p.previewUrl}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={p.previewUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeWaveAttach(p.key)}
                                className="absolute right-0.5 top-0.5 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/75"
                                aria-label="첨부 제거"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        diarySubmitBusy !== null ||
                        (!draft.trim() && wavePendingAttach.length === 0)
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors duration-1000 ease-in-out disabled:cursor-not-allowed disabled:opacity-40 ${
                        abyss
                          ? 'bg-slate-200 text-slate-900 hover:bg-white'
                          : deepWater
                            ? 'bg-sky-100 text-slate-900 hover:bg-white'
                            : 'bg-sky-600 text-white hover:bg-sky-700'
                      }`}
                    >
                      {diarySubmitBusy === 'wave' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          싣는 중…
                        </>
                      ) : (
                        <>
                          기록하기
                          <SendHorizontal className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>

              <section className={waveCardClass}>
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-200" aria-hidden />
                  <p className={`text-base font-semibold ${labelTone}`}>오늘의 순풍</p>
                </div>
                <p className={`text-sm ${mutedTone}`}>
                  긍정적인 변화와 작은 성취를 적어 보세요.
                </p>
                <form onSubmit={handleSubmitTailwind} className="mt-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="tailwind-log" className="sr-only">
                        오늘의 순풍
                      </label>
                      <textarea
                        id="tailwind-log"
                        value={tailwindDraft}
                        onChange={(e) => setTailwindDraft(e.target.value)}
                        rows={5}
                        placeholder="오늘 나에게 불어온 좋은 바람…"
                        className={`min-h-[10rem] w-full resize-y rounded-xl border px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                          deepWater
                            ? abyss
                              ? 'border-amber-900/50 bg-slate-900/60 text-amber-50 focus:border-amber-400 focus:ring-amber-500/30'
                              : 'border-amber-200/40 bg-white/95 text-slate-900 focus:ring-amber-300/50'
                            : 'border-amber-200 bg-amber-50/90 text-slate-800 focus:border-amber-400 focus:ring-amber-100'
                        }`}
                      />
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-[11.5rem]">
                      <input
                        ref={twAttachInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          setTwPendingAttach((prev) =>
                            appendPendingAttach(prev, e.target.files),
                          )
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => twAttachInputRef.current?.click()}
                        disabled={
                          diarySubmitBusy !== null ||
                          twPendingAttach.length >= MAX_LOG_ATTACHMENTS
                        }
                        className={`inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-40 ${
                          abyss
                            ? 'border-amber-700/50 bg-amber-950/40 text-amber-100 hover:bg-amber-950/60'
                            : deepWater
                              ? 'border-amber-300/40 bg-white/15 text-white hover:bg-white/25'
                              : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
                        }`}
                      >
                        <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                        사진·영상 첨부
                      </button>
                      <p className={`text-center text-[11px] ${mutedTone}`}>
                        {twPendingAttach.length}/{MAX_LOG_ATTACHMENTS}개
                      </p>
                      {twPendingAttach.length > 0 && (
                        <ul
                          className="flex max-h-48 flex-wrap content-start gap-2 overflow-y-auto sm:flex-col sm:flex-nowrap"
                          aria-label="순풍 첨부 미리보기"
                        >
                          {twPendingAttach.map((p) => (
                            <li
                              key={p.key}
                              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-amber-200/40 shadow-sm sm:h-24 sm:w-full sm:max-w-none"
                            >
                              {p.file.type.startsWith('video') ? (
                                <video
                                  src={p.previewUrl}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={p.previewUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeTwAttach(p.key)}
                                className="absolute right-0.5 top-0.5 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/75"
                                aria-label="첨부 제거"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        diarySubmitBusy !== null ||
                        (!tailwindDraft.trim() && twPendingAttach.length === 0)
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        abyss
                          ? 'bg-amber-400/90 text-slate-900 hover:bg-amber-300'
                          : deepWater
                            ? 'bg-amber-100 text-slate-900 hover:bg-white'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {diarySubmitBusy === 'tailwind' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          싣는 중…
                        </>
                      ) : (
                        <>
                          순풍 남기기
                          <SendHorizontal className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            </div>

          <section
            aria-labelledby="timeline-heading"
            className={`relative mt-12 border-t pt-10 sm:mt-14 ${
              deepWater ? 'border-white/10' : 'border-slate-200/80'
            }`}
          >
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="timeline-heading"
                  className={`text-sm font-bold uppercase tracking-wide ${
                    abyss
                      ? 'text-slate-300'
                      : deepWater
                        ? 'text-white/85'
                        : 'text-slate-700'
                  }`}
                >
                  일지 타임라인
                </h2>
                <p className={`mt-1 text-xs ${mutedTone}`}>
                  카드를 눌러 사진·영상을 크게 볼 수 있어요.
                </p>
              </div>
              <span
                className={`text-xs ${
                  abyss
                    ? 'text-slate-500'
                    : deepWater
                      ? 'text-white/65'
                      : 'text-slate-500'
                }`}
              >
                최신 위 · 아래로 갈수록 이전의 바다
              </span>
            </div>

            <div className="relative">
              <div
                className={`pointer-events-none absolute bottom-0 left-6 top-2 w-1 rounded-full ${timelineRailGradient(
                  oceanSurface,
                )}`}
                aria-hidden
              />
              <ol className="relative space-y-8">
                {sorted.map((entry) => (
                  <li key={entry.id} className="relative">
                    <div className="absolute left-6 top-5 z-[2] -translate-x-1/2">
                      <DiaryTimelineEmotionIcon
                        tag={entry.tag}
                        surface={oceanSurface}
                      />
                    </div>
                    <article
                      className={`ml-2 min-w-0 rounded-2xl border p-5 shadow-sm transition-colors sm:ml-14 ${timelineEntryArticleClass(
                        entry.tag,
                        oceanSurface,
                      )}`}
                    >
                      <div
                        className={`flex flex-wrap items-center gap-2 text-xs ${timelineMetaTextClass(
                          entry.tag,
                          oceanSurface,
                        )}`}
                      >
                        <time dateTime={entry.createdAt}>
                          {formatShortDate(entry.createdAt)}
                        </time>
                        <TimelineMoodRibbon
                          moodTag={entry.tag}
                          surface={oceanSurface}
                          tagLabel={TAG_LABEL[entry.tag]}
                        />
                      </div>
                      <p
                        className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${timelineBodyTextClass(
                          entry.tag,
                          oceanSurface,
                        )}`}
                      >
                        {entry.body}
                      </p>
                      {entry.attachments && entry.attachments.length > 0 && (
                        <div className="mt-4">
                          <DiaryMediaPreviewGrid
                            items={entry.attachments.map((a) => ({
                              type: a.type,
                              src: logAttachmentSrc(a),
                            }))}
                            layout="timeline"
                            rowKeyPrefix={entry.id}
                            onOpen={setLightboxMedia}
                          />
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            className={`mb-8 rounded-2xl border p-5 shadow-md backdrop-blur-sm ${
              abyss
                ? 'border-emerald-500/25 bg-emerald-950/20'
                : deepWater
                  ? 'border-emerald-200/35 bg-emerald-50/12'
                  : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-white to-sky-50/40 shadow-emerald-100/40'
            }`}
            aria-label="오늘의 항해 체크리스트"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ListChecks
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    abyss ? 'text-emerald-300' : 'text-emerald-700'
                  }`}
                  aria-hidden
                />
                <div>
                  <h2 className={`text-sm font-bold ${labelTone}`}>
                    오늘의 항해 체크리스트
                  </h2>
                  <p className={`mt-0.5 text-xs leading-snug ${mutedTone}`}>
                    로컬 날짜가 바뀌면(자정) 어제의 체크는 자동으로 풀려요. 🏮는 명예의
                    전당 비망록에서 가져온 루틴이에요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      '오늘 체크한 루틴을 모두 미완료로 되돌릴까요?',
                    )
                  )
                    return
                  handleResetRoutineChecks()
                }}
                className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  abyss
                    ? 'border-white/20 bg-white/10 text-emerald-100 hover:bg-white/15'
                    : deepWater
                      ? 'border-white/25 bg-white/15 text-white hover:bg-white/20'
                      : 'border-emerald-200 bg-white/90 text-emerald-900 hover:bg-emerald-50'
                }`}
              >
                오늘 초기화
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={customRoutineDraft}
                onChange={(e) => setCustomRoutineDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomRoutine()
                  }
                }}
                placeholder="직접 루틴을 적어 보세요…"
                className={`min-w-[12rem] flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                  abyss
                    ? 'border-white/15 bg-black/30 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/50 focus:ring-emerald-500/30'
                    : deepWater
                      ? 'border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/25'
                      : 'border-emerald-100 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-200'
                }`}
                aria-label="새 루틴"
              />
              <button
                type="button"
                onClick={handleAddCustomRoutine}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition active:scale-[0.98] ${
                  abyss
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : deepWater
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                추가
              </button>
            </div>

            {myRoutineEntries.length === 0 ? (
              <p className={`mt-4 text-center text-sm ${mutedTone}`}>
                아직 루틴이 없어요. 위에서 직접 추가하거나 명예의 전당 비망록에서
                가져와 보세요.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {myRoutineEntries.map((r) => {
                  const done = isCompletedToday(r)
                  const fromLighthouse = r.originUserId != null
                  return (
                    <li
                      key={r.id}
                      className={`relative flex items-start gap-3 overflow-hidden rounded-xl border px-3 py-3 transition ${
                        abyss
                          ? 'border-white/12 bg-black/20'
                          : deepWater
                            ? 'border-white/18 bg-white/10'
                            : fromLighthouse
                              ? 'border-amber-100/90 bg-amber-50/40'
                              : 'border-emerald-100/90 bg-white/85'
                      }`}
                    >
                      {rippleRoutineId === r.id && (
                        <span
                          className="pointer-events-none absolute left-5 top-1/2 z-0 h-28 w-28 rounded-full bg-emerald-400/30 animate-water-ripple"
                          aria-hidden
                        />
                      )}
                      <label className="relative z-[1] flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => handleRoutineToggle(r.id)}
                          className={`mt-1 h-4 w-4 shrink-0 rounded border text-emerald-600 focus:ring-emerald-500 ${
                            abyss ? 'border-slate-500 bg-slate-800' : ''
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`text-sm leading-snug ${
                              done
                                ? mutedTone + ' line-through opacity-75'
                                : labelTone
                            }`}
                          >
                            {fromLighthouse ? (
                              <span className="mr-1 inline" aria-hidden>
                                🏮
                              </span>
                            ) : null}
                            {r.label}
                          </span>
                          {fromLighthouse ? (
                            <span
                              className={`mt-1 flex flex-wrap items-center gap-1 text-[11px] font-medium ${
                                abyss ? 'text-amber-200/90' : 'text-amber-900/85'
                              }`}
                            >
                              <span className={mutedTone}>
                                {r.originDisplayName
                                  ? `${r.originDisplayName} 선배`
                                  : '등대에서 가져옴'}
                              </span>
                            </span>
                          ) : (
                            <span
                              className={`mt-1 block text-[11px] font-medium ${mutedTone}`}
                            >
                              내가 적은 루틴
                            </span>
                          )}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeMyRoutine(r.id)}
                        className={`relative z-[1] shrink-0 rounded-lg p-2 transition ${
                          abyss
                            ? 'text-slate-400 hover:bg-white/10 hover:text-rose-300'
                            : deepWater
                              ? 'text-white/60 hover:bg-white/15 hover:text-rose-200'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                        aria-label={`「${r.label}」 삭제`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          </>
        )}
      </main>

      <MediaLightbox
        open={lightboxMedia != null}
        media={lightboxMedia}
        onClose={() => setLightboxMedia(null)}
      />

      {voyageCompletionPromptOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center overflow-hidden p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-gradient-to-b from-sky-950/40 via-slate-900/55 to-indigo-950/60 backdrop-blur-[3px]"
            aria-label="닫기"
            onClick={handleVoyageCompletionDismiss}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voyage-complete-prompt-title"
            className="relative mt-8 w-full max-w-md overflow-visible rounded-2xl border border-sky-200/90 bg-gradient-to-b from-white to-sky-50/90 p-6 shadow-2xl shadow-sky-300/30 sm:mt-0 sm:p-8"
          >
            <div
              className="pointer-events-none absolute -top-2 left-1/2 z-[1] -translate-x-1/2 sm:-top-4"
              aria-hidden
            >
              <span className="block select-none text-6xl leading-none drop-shadow-md filter sm:text-7xl animate-whale-breach">
                🐳
              </span>
            </div>
            <div className="relative pt-14 sm:pt-16">
              <p
                id="voyage-complete-prompt-title"
                className="text-center text-lg font-bold leading-snug text-slate-900 sm:text-xl"
              >
                수고하셨습니다!
                <br />
                이 여정을 명예의 전당에 기록하시겠습니까?
              </p>
              <p className="mt-4 text-center text-sm leading-relaxed text-slate-600">
                「예」를 누르면 기록 신청서가 열리며, 항해 목표·카테고리와 타임라인
                일지·미디어가 함께 옮겨집니다. 일지별로 공개 여부를 골라 제출할 수
                있어요.
              </p>
              <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
                <button
                  type="button"
                  onClick={handleVoyageCompletionNoRecord}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:min-w-[120px]"
                >
                  아니오
                </button>
                <button
                  type="button"
                  onClick={handleVoyageCompletionToGannessRecord}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:brightness-110 sm:min-w-[120px]"
                >
                  예
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
