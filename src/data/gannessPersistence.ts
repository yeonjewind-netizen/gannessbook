/**
 * 명예의 전당 — localStorage 기반 신청·승인·히스토리 확장
 */

import {
  GANNESS_JOURNEY_LOGS,
  GANNESS_RECORD_CATEGORIES,
  coerceRecordMedia,
  FALLBACK_MEDIA,
  type GannessRecordCategory,
  type RecordGeneration,
  type RecordMedia,
} from './gannessRecords'
import type { MoodTag } from '../voyage/types'
import { appendRecordApprovedNotification } from '../voyage/notificationsStorage'
import { publishVoyageMemo } from '../voyage/voyageMemoStorage'
import { isMoodTag } from '../voyage/voyageEntries'
import { getFirebaseStorage, isFirebaseConfigured } from '../lib/firebase'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

export const GANNESS_STORAGE_EVENT = 'ganness-storage'

export function notifyGannessStorage() {
  window.dispatchEvent(new Event(GANNESS_STORAGE_EVENT))
}

const LS_APPLICATIONS = 'ganness-book:applications'
const LS_HISTORY_EXT = 'ganness-book:history-extensions'
const LS_JOURNEY_EXT = 'ganness-book:journey-logs-extension'
const LS_CATEGORY_META = 'ganness-book:category-meta'
const LS_ADMIN_MODE = 'ganness-book:admin-mode'
const LS_CUSTOM_RECORD_CATEGORIES = 'ganness-book:record-custom-categories'

export type StoredCustomRecordCategory = {
  id: string
  title: string
  createdAt: number
}

export type VoyageDiarySnapshotItem = {
  id: string
  createdAt: string
  tag: string
  /** 심사·UI에서 감정 스타일 복원용 (tailwind·direction 등) */
  moodTag?: MoodTag
  body: string
  /** 일지에 첨부된 사진·영상(data URL) — 심사·등재 후 Journey 연동에 사용 */
  mediaItems?: StoredMediaItem[]
}

export type MergedJourneyLog = {
  headline: string
  body: string
  voyageDiarySnapshots?: VoyageDiarySnapshotItem[]
}

/** `ganness-book:` 접두사 로컬 스토리지 전부 삭제 후 문제 복구용 */
export function clearGannessBookLocalStorage(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k != null && k.startsWith('ganness-book:')) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export type StoredMediaItem = {
  type: 'image' | 'video'
  /** 로컬 data URL */
  dataUrl?: string
  /** Firebase Storage 등 HTTPS URL */
  mediaUrl?: string
}

/** 심사·그리드 표시용 단일 주소 */
export function storedMediaSrc(m: StoredMediaItem): string {
  const u = m.mediaUrl?.trim()
  if (u) return u
  return m.dataUrl?.trim() ?? ''
}

export type RecordApplication = {
  id: string
  applicantName: string
  categoryId: string
  recordValue: string
  journeyNote: string
  status: 'pending' | 'approved' | 'rejected'
  rejectedReason?: string
  mediaItems: StoredMediaItem[]
  createdAt: number
  /** 기록실에 공개로 제출한 나의 바다 일지 스냅샷(원문 읽기 전용으로 저장) */
  voyageDiarySnapshots?: VoyageDiarySnapshotItem[]
  /** 제출 시점, 일지 id 기준으로 집계한 기본 5종 응원 합계(공동의 바다 연동) */
  communityCheerTotal?: number
  communityCheerByEmoji?: Record<string, number>
  /** 항해사의 비망록 — 매일 지킨 습관 */
  dailyRoutines?: string[]
  /** 태풍(위기) 극복 방법 */
  crisisMethodology?: string
  /** 제출자 기기 userId — 등대·비망록 연동 */
  submitterUserId?: string
}

type HistoryExtensions = Record<string, RecordGeneration[]>
type JourneyExtensions = Record<
  string,
  {
    headline: string
    body: string
    voyageDiarySnapshots?: VoyageDiarySnapshotItem[]
  }
>
type CategoryMeta = Record<
  string,
  { status?: 'approved' | 'pending' | 'rejected' }
>

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseSnapshotMediaItems(raw: unknown): StoredMediaItem[] {
  if (!Array.isArray(raw)) return []
  const out: StoredMediaItem[] = []
  for (const item of raw) {
    const m = normalizeStoredMedia(item)
    if (m) out.push(m)
  }
  return out
}

function parseVoyageDiarySnapshots(
  raw: unknown,
): VoyageDiarySnapshotItem[] {
  if (!Array.isArray(raw)) return []
  const out: VoyageDiarySnapshotItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    const createdAt = typeof o.createdAt === 'string' ? o.createdAt : ''
    if (!id || !createdAt) continue
    const tag = typeof o.tag === 'string' ? o.tag : ''
    const body = typeof o.body === 'string' ? o.body : ''
    const moodTag = isMoodTag(o.moodTag) ? o.moodTag : undefined
    const mediaItems = parseSnapshotMediaItems(o.mediaItems)
    out.push({
      id,
      createdAt,
      tag,
      body,
      ...(moodTag ? { moodTag } : {}),
      ...(mediaItems.length ? { mediaItems } : {}),
    })
  }
  return out
}

function loadCustomRecordCategoryDefs(): StoredCustomRecordCategory[] {
  const parsed = safeParse<unknown>(
    localStorage.getItem(LS_CUSTOM_RECORD_CATEGORIES),
    [],
  )
  if (!Array.isArray(parsed)) return []
  const out: StoredCustomRecordCategory[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const r = row as Partial<StoredCustomRecordCategory>
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    if (!id) continue
    out.push({
      id,
      title: title || '제목 미상',
      createdAt:
        typeof r.createdAt === 'number' && Number.isFinite(r.createdAt)
          ? r.createdAt
          : Date.now(),
    })
  }
  return out
}

function saveCustomRecordCategoryDefs(list: StoredCustomRecordCategory[]) {
  try {
    localStorage.setItem(LS_CUSTOM_RECORD_CATEGORIES, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** 사용자 정의 기록 주제 — 심사 후 명예의 전당 확장과 동일하게 history ext에 누적 */
export function registerCustomRecordCategory(title: string): string {
  const t = title.trim()
  if (!t) return ''
  const id = `cat-custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const list = loadCustomRecordCategoryDefs()
  list.push({ id, title: t, createdAt: Date.now() })
  saveCustomRecordCategoryDefs(list)
  notifyGannessStorage()
  return id
}

function parseCommunityCheerByEmoji(
  raw: unknown,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && v > 0 && Number.isFinite(v))
      out[k] = Math.floor(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function parseDailyRoutinesFromUnknown(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw
    .filter(
      (x): x is string => typeof x === 'string' && x.trim() !== '',
    )
    .map((s) => s.trim())
  return out.length ? out : undefined
}

function normalizeStoredMedia(raw: unknown): StoredMediaItem | null {
  if (raw == null || typeof raw !== 'object') return null
  const m = raw as Partial<StoredMediaItem>
  const mediaUrl =
    typeof m.mediaUrl === 'string' &&
    m.mediaUrl.trim() !== '' &&
    /^https?:\/\//i.test(m.mediaUrl.trim())
      ? m.mediaUrl.trim()
      : ''
  const dataUrl =
    typeof m.dataUrl === 'string' && m.dataUrl.trim() !== ''
      ? m.dataUrl.trim()
      : ''
  if (!mediaUrl && !dataUrl) return null
  const type = m.type === 'video' ? 'video' : 'image'
  return {
    type,
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(dataUrl ? { dataUrl } : {}),
  }
}

function normalizeApplicationRecord(raw: unknown): RecordApplication | null {
  if (raw == null || typeof raw !== 'object') return null
  const a = raw as Partial<RecordApplication>
  const id =
    typeof a.id === 'string' && a.id
      ? a.id
      : `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const status: RecordApplication['status'] =
    a.status === 'approved' || a.status === 'rejected' || a.status === 'pending'
      ? a.status
      : 'pending'
  const mediaItems: StoredMediaItem[] = Array.isArray(a.mediaItems)
    ? a.mediaItems
        .map(normalizeStoredMedia)
        .filter((x): x is StoredMediaItem => x != null)
    : []
  const voyageDiarySnapshots = parseVoyageDiarySnapshots(
    a.voyageDiarySnapshots,
  )
  const cheerRaw = a.communityCheerTotal
  const communityCheerTotal =
    typeof cheerRaw === 'number' &&
    cheerRaw >= 0 &&
    Number.isFinite(cheerRaw)
      ? Math.floor(cheerRaw)
      : undefined
  const communityCheerByEmoji = parseCommunityCheerByEmoji(
    a.communityCheerByEmoji,
  )
  const dailyRoutines = parseDailyRoutinesFromUnknown(a.dailyRoutines)
  const crisisMethodology =
    typeof a.crisisMethodology === 'string' && a.crisisMethodology.trim()
      ? a.crisisMethodology.trim()
      : undefined
  const submitterUserId =
    typeof a.submitterUserId === 'string' && a.submitterUserId.trim()
      ? a.submitterUserId.trim()
      : undefined
  return {
    id,
    applicantName:
      typeof a.applicantName === 'string' && a.applicantName.trim()
        ? a.applicantName.trim()
        : '(이름 없음)',
    categoryId:
      typeof a.categoryId === 'string' && a.categoryId ? a.categoryId : '',
    recordValue:
      typeof a.recordValue === 'string' && a.recordValue.trim()
        ? a.recordValue.trim()
        : '—',
    journeyNote:
      typeof a.journeyNote === 'string' ? a.journeyNote : '',
    status,
    rejectedReason:
      typeof a.rejectedReason === 'string' ? a.rejectedReason : undefined,
    mediaItems,
    createdAt:
      typeof a.createdAt === 'number' && Number.isFinite(a.createdAt)
        ? a.createdAt
        : 0,
    ...(voyageDiarySnapshots.length > 0 ? { voyageDiarySnapshots } : {}),
    ...(communityCheerTotal != null && communityCheerTotal > 0
      ? { communityCheerTotal }
      : {}),
    ...(communityCheerByEmoji ? { communityCheerByEmoji } : {}),
    ...(dailyRoutines ? { dailyRoutines } : {}),
    ...(crisisMethodology ? { crisisMethodology } : {}),
    ...(submitterUserId ? { submitterUserId } : {}),
  }
}

export function loadApplications(): RecordApplication[] {
  const parsed = safeParse<unknown>(localStorage.getItem(LS_APPLICATIONS), [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => normalizeApplicationRecord(item))
    .filter((a): a is RecordApplication => a != null)
}

function saveApplications(apps: RecordApplication[]) {
  localStorage.setItem(LS_APPLICATIONS, JSON.stringify(apps))
}

export function loadHistoryExtensions(): HistoryExtensions {
  const parsed = safeParse<unknown>(localStorage.getItem(LS_HISTORY_EXT), {})
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return {}
  }
  return parsed as HistoryExtensions
}

function saveHistoryExtensions(ext: HistoryExtensions) {
  localStorage.setItem(LS_HISTORY_EXT, JSON.stringify(ext))
}

export function loadJourneyExtensions(): JourneyExtensions {
  const parsed = safeParse<unknown>(localStorage.getItem(LS_JOURNEY_EXT), {})
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return {}
  }
  return parsed as JourneyExtensions
}

function saveJourneyExtensions(ext: JourneyExtensions) {
  localStorage.setItem(LS_JOURNEY_EXT, JSON.stringify(ext))
}

export function loadCategoryMeta(): CategoryMeta {
  const parsed = safeParse<unknown>(localStorage.getItem(LS_CATEGORY_META), {})
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return {}
  }
  return parsed as CategoryMeta
}

function saveCategoryMeta(meta: CategoryMeta) {
  localStorage.setItem(LS_CATEGORY_META, JSON.stringify(meta))
}

export function getAdminMode(): boolean {
  try {
    return localStorage.getItem(LS_ADMIN_MODE) === '1'
  } catch {
    return false
  }
}

export function setAdminMode(on: boolean) {
  try {
    localStorage.setItem(LS_ADMIN_MODE, on ? '1' : '0')
  } catch {
    /* ignore */
  }
  notifyGannessStorage()
}

function normalizeRecordGenerationFromUnknown(
  raw: unknown,
  fallbackGen: number,
): RecordGeneration | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Partial<RecordGeneration>
  const generation =
    typeof r.generation === 'number' && Number.isFinite(r.generation)
      ? r.generation
      : fallbackGen
  const dailyRoutines = parseDailyRoutinesFromUnknown(r.dailyRoutines)
  const crisisMethodology =
    typeof r.crisisMethodology === 'string' && r.crisisMethodology.trim()
      ? r.crisisMethodology.trim()
      : undefined
  return {
    generation,
    name:
      typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '이름 미상',
    recordValue:
      typeof r.recordValue === 'string' && r.recordValue.trim()
        ? r.recordValue.trim()
        : '—',
    journeyId:
      typeof r.journeyId === 'string' && r.journeyId.trim()
        ? r.journeyId.trim()
        : `journey-${generation}-${fallbackGen}`,
    media: coerceRecordMedia(r.media),
    ...(dailyRoutines ? { dailyRoutines } : {}),
    ...(crisisMethodology ? { crisisMethodology } : {}),
  }
}

function normalizeCategoryStatus(
  raw: unknown,
  fallback: GannessRecordCategory['status'],
): GannessRecordCategory['status'] {
  if (raw === 'approved' || raw === 'pending' || raw === 'rejected') return raw
  return fallback
}

function buildMergedCategory(
  cat: GannessRecordCategory,
  ext: HistoryExtensions,
  metaSafe: CategoryMeta,
): GannessRecordCategory {
  const rawExtra = ext[cat.id]
  const extraList = Array.isArray(rawExtra) ? rawExtra : []
  const baseHistory = Array.isArray(cat.history) ? cat.history : []

  const normalizedBase = baseHistory
    .map((row, i) => normalizeRecordGenerationFromUnknown(row, i + 1))
    .filter((x): x is RecordGeneration => x != null)

  const maxGen = normalizedBase.reduce((m, h) => Math.max(m, h.generation), 0)
  const normalizedExtra = extraList
    .map((row, i) =>
      normalizeRecordGenerationFromUnknown(row, maxGen + i + 1),
    )
    .filter((x): x is RecordGeneration => x != null)

  const mergedHistory = [...normalizedBase, ...normalizedExtra].sort(
    (a, b) => a.generation - b.generation,
  )

  const statusOverride = metaSafe[cat.id]?.status
  const status = normalizeCategoryStatus(statusOverride, cat.status)

  return {
    ...cat,
    title:
      typeof cat.title === 'string' && cat.title ? cat.title : '제목 미상',
    status,
    history: mergedHistory,
  }
}

export function mergeRecordCategories(): GannessRecordCategory[] {
  try {
    const ext = loadHistoryExtensions()
    const meta = loadCategoryMeta()
    const metaSafe: CategoryMeta =
      meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}

    const baseMerged = GANNESS_RECORD_CATEGORIES.map((cat) =>
      buildMergedCategory(cat, ext, metaSafe),
    )

    const customDefs = loadCustomRecordCategoryDefs()
    const customMerged = customDefs.map((def) =>
      buildMergedCategory(
        {
          id: def.id,
          title: def.title,
          status: 'pending',
          history: [],
        },
        ext,
        metaSafe,
      ),
    )

    return [...baseMerged, ...customMerged]
  } catch {
    const fallbackCustom = loadCustomRecordCategoryDefs().map((def) => ({
      id: def.id,
      title: def.title,
      status: 'pending' as const,
      history: [] as RecordGeneration[],
    }))
    return [
      ...GANNESS_RECORD_CATEGORIES.map((c) => ({
        ...c,
        history: Array.isArray(c.history) ? c.history : [],
      })),
      ...fallbackCustom,
    ]
  }
}

export function getRecordCategoryTitle(categoryId: string): string {
  if (!categoryId.trim()) return '—'
  try {
    const merged = mergeRecordCategories()
    const c = merged.find((x) => x.id === categoryId)
    return c?.title ?? categoryId
  } catch {
    return categoryId
  }
}

export function getMergedJourneyLog(
  journeyId: string | null | undefined,
): MergedJourneyLog | undefined {
  if (journeyId == null || typeof journeyId !== 'string' || !journeyId.trim()) {
    return undefined
  }
  try {
    const ext = loadJourneyExtensions()
    const custom = ext[journeyId]
    if (
      custom &&
      typeof custom.headline === 'string' &&
      typeof custom.body === 'string'
    ) {
      const rawSnaps = (custom as { voyageDiarySnapshots?: unknown })
        .voyageDiarySnapshots
      const voyageDiarySnapshots = parseVoyageDiarySnapshots(rawSnaps)
      return {
        headline: custom.headline,
        body: custom.body,
        ...(voyageDiarySnapshots.length > 0
          ? { voyageDiarySnapshots }
          : {}),
      }
    }
    const base = GANNESS_JOURNEY_LOGS[journeyId]
    if (
      base &&
      typeof base.headline === 'string' &&
      typeof base.body === 'string'
    ) {
      return { headline: base.headline, body: base.body }
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export function getPendingApplications(): RecordApplication[] {
  try {
    return loadApplications().filter((a) => a?.status === 'pending')
  } catch {
    return []
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function uploadRecordApplicationMedia(
  appId: string,
  file: File,
): Promise<StoredMediaItem> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 완전하지 않아 Storage 업로드를 진행할 수 없습니다.')
  }
  const storage = getFirebaseStorage()
  const extFromName = (() => {
    const dot = file.name.lastIndexOf('.')
    if (dot < 0 || dot >= file.name.length - 1) return ''
    return file.name
      .slice(dot + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16)
  })()
  const ext = extFromName ? `.${extFromName}` : file.type.startsWith('video/') ? '.mp4' : '.jpg'
  const mediaId = `proof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const path = `record_applications/${appId}/${mediaId}${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, {
    ...(file.type ? { contentType: file.type } : {}),
  })
  const mediaUrl = await getDownloadURL(storageRef)
  return {
    type: file.type.startsWith('video/') ? 'video' : 'image',
    mediaUrl,
  }
}

function buildApprovedJourneyBody(app: RecordApplication): string {
  const parts: string[] = []
  const snaps = app.voyageDiarySnapshots
  if (snaps?.length) {
    const block = snaps
      .map((s) => {
        const mediaLine =
          s.mediaItems && s.mediaItems.length > 0
            ? `\n〔첨부 미디어 ${s.mediaItems.length}건〕`
            : ''
        return `· ${new Date(s.createdAt).toLocaleString('ko-KR', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })} [${s.tag}]\n${s.body}${mediaLine}`
      })
      .join('\n\n')
    parts.push(`【나의 바다에서 불러온 일지】\n${block}`)
  }
  const cheerN = app.communityCheerTotal
  if (typeof cheerN === 'number' && cheerN > 0) {
    const emojiLine =
      app.communityCheerByEmoji &&
      Object.keys(app.communityCheerByEmoji).length > 0
        ? Object.entries(app.communityCheerByEmoji)
            .filter(([, n]) => n > 0)
            .map(([e, c]) => `${e}×${c}`)
            .join(' ')
        : ''
    parts.push(
      `【공동체 응원】\n선원의 일지에 총 ${cheerN}번의 따뜻한 응원이 모였습니다.${emojiLine ? `\n(${emojiLine})` : ''}`,
    )
  }
  const note = app.journeyNote?.trim()
  if (note) {
    parts.push(`【전체 소감】\n${note}`)
  }
  const composed = parts.join('\n\n').trim()
  return (
    composed ||
    note ||
    '제출된 항해 일지가 없습니다. 증명 자료를 함께 확인해 주세요.'
  )
}

export async function submitRecordApplication(input: {
  applicantName: string
  categoryId: string
  recordValue: string
  journeyNote: string
  files: File[]
  voyageDiarySnapshots?: VoyageDiarySnapshotItem[]
  communityCheerTotal?: number
  communityCheerByEmoji?: Record<string, number>
  dailyRoutines?: string[]
  crisisMethodology?: string
  submitterUserId?: string
}): Promise<void> {
  const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const mediaItems = await Promise.all(
    input.files.map((file) => uploadRecordApplicationMedia(appId, file)),
  )

  const routinesIn =
    input.dailyRoutines?.map((s) => s.trim()).filter(Boolean) ?? []
  const crisisIn = input.crisisMethodology?.trim() ?? ''

  const app: RecordApplication = {
    id: appId,
    applicantName: input.applicantName.trim(),
    categoryId: input.categoryId,
    recordValue: input.recordValue.trim(),
    journeyNote: input.journeyNote.trim(),
    status: 'pending',
    mediaItems,
    createdAt: Date.now(),
    ...(input.voyageDiarySnapshots?.length
      ? { voyageDiarySnapshots: input.voyageDiarySnapshots }
      : {}),
    ...(typeof input.communityCheerTotal === 'number' &&
    input.communityCheerTotal > 0
      ? {
          communityCheerTotal: Math.floor(input.communityCheerTotal),
          ...(input.communityCheerByEmoji &&
          Object.keys(input.communityCheerByEmoji).length > 0
            ? { communityCheerByEmoji: input.communityCheerByEmoji }
            : {}),
        }
      : {}),
    ...(routinesIn.length ? { dailyRoutines: routinesIn } : {}),
    ...(crisisIn ? { crisisMethodology: crisisIn } : {}),
    ...(input.submitterUserId?.trim()
      ? { submitterUserId: input.submitterUserId.trim() }
      : {}),
  }

  const apps = loadApplications()
  apps.push(app)
  saveApplications(apps)
  notifyGannessStorage()
}

export function approveApplication(appId: string): boolean {
  const apps = loadApplications()
  const idx = apps.findIndex((a) => a.id === appId)
  if (idx < 0) return false
  const app = apps[idx]
  if (app.status !== 'pending') return false

  const merged = mergeRecordCategories()
  const cat = merged.find((c) => c.id === app.categoryId)
  if (!cat) return false

  const maxGen = (cat.history ?? []).reduce((m, h) => {
    const g =
      h && typeof h.generation === 'number' && Number.isFinite(h.generation)
        ? h.generation
        : 0
    return Math.max(m, g)
  }, 0)
  const nextGen = maxGen + 1
  const journeyId = `APP-${app.id}`

  const items = Array.isArray(app.mediaItems) ? app.mediaItems : []
  const first = items[0]
  const firstSrc = first ? storedMediaSrc(first) : ''
  const media: RecordMedia =
    first && firstSrc
      ? { type: first.type === 'video' ? 'video' : 'image', url: firstSrc }
      : FALLBACK_MEDIA

  const newRow: RecordGeneration = {
    generation: nextGen,
    name: app.applicantName,
    recordValue: app.recordValue,
    journeyId,
    media,
    ...(app.dailyRoutines?.length ? { dailyRoutines: app.dailyRoutines } : {}),
    ...(app.crisisMethodology?.trim()
      ? { crisisMethodology: app.crisisMethodology.trim() }
      : {}),
  }

  const ext = loadHistoryExtensions()
  ext[app.categoryId] = [...(ext[app.categoryId] ?? []), newRow]
  saveHistoryExtensions(ext)

  const jExt = loadJourneyExtensions()
  jExt[journeyId] = {
    headline: `${app.applicantName} · ${nextGen}대 기록`,
    body: buildApprovedJourneyBody(app),
    ...(app.voyageDiarySnapshots?.length
      ? { voyageDiarySnapshots: app.voyageDiarySnapshots }
      : {}),
  }
  saveJourneyExtensions(jExt)

  const memoKeys = [journeyId, app.submitterUserId].filter(
    (x): x is string => typeof x === 'string' && Boolean(x?.trim()),
  )
  if (
    memoKeys.length &&
    (app.dailyRoutines?.length || app.crisisMethodology?.trim())
  ) {
    publishVoyageMemo(memoKeys, {
      dailyRoutines: app.dailyRoutines ?? [],
      crisisMethodology: app.crisisMethodology?.trim() ?? '',
      displayName: app.applicantName,
    })
  }

  const meta = loadCategoryMeta()
  meta[app.categoryId] = { ...meta[app.categoryId], status: 'approved' }
  saveCategoryMeta(meta)

  apps[idx] = { ...app, status: 'approved' }
  saveApplications(apps)
  notifyGannessStorage()
  appendRecordApprovedNotification(getRecordCategoryTitle(app.categoryId))
  return true
}

export function rejectApplication(appId: string, reason: string): boolean {
  const apps = loadApplications()
  const idx = apps.findIndex((a) => a.id === appId)
  if (idx < 0) return false
  const app = apps[idx]
  if (app.status !== 'pending') return false

  apps[idx] = {
    ...app,
    status: 'rejected',
    rejectedReason: reason.trim() || '(사유 없음)',
  }
  saveApplications(apps)
  notifyGannessStorage()
  return true
}
