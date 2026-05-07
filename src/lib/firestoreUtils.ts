/**
 * Firestore — users / voyages / logs
 * 모든 쿼리·문서는 userId(uid)로 스코프합니다.
 */

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore'
import type { MyVoyageProfile } from '../voyage/myVoyageStorage'
import { withSyncedVoyageDerived } from '../voyage/myVoyageStorage'
import type { LogAttachment, LogEntry, VoyageMeta } from '../voyage/types'
import type { MyRoutineEntry } from '../voyage/myRoutinesStorage'
import type { CompletedVoyageArchiveEntry } from '../voyage/completedVoyagesArchive'
import { profileFromSnapshotJson } from '../voyage/myVoyageStorage'
import { getFirestoreDb } from './firebase'
import { notifyProfileUpdates } from '../voyage/profileApplicantStorage'

export const COLLECTIONS = {
  users: 'users',
  voyages: 'voyages',
  logs: 'logs',
  recordApplications: 'recordApplications',
  records: 'records',
} as const

export const OCEAN_DATA_UPDATED_EVENT = 'ganness-book:ocean-data-updated'

export function notifyOceanDataUpdated(): void {
  window.dispatchEvent(new Event(OCEAN_DATA_UPDATED_EVENT))
}

function db() {
  return getFirestoreDb()
}

/** 활성 항해 문서 ID — 사용자당 1개 */
export function activeVoyageDocId(uid: string): string {
  return `active_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

// --- users/{uid} ---

export type FirestoreUserDoc = {
  voyageMeta: VoyageMeta
  routines: MyRoutineEntry[]
  isAdmin: boolean
  displayName?: string
  email?: string
  photoURL?: string
  updatedAt?: Timestamp
}

const defaultVoyageMeta: VoyageMeta = {
  isCompleted: false,
  finalRetrospective: null,
}

function parseVoyageMeta(raw: unknown): VoyageMeta {
  if (!raw || typeof raw !== 'object') return { ...defaultVoyageMeta }
  const o = raw as Record<string, unknown>
  return {
    isCompleted: o.isCompleted === true,
    finalRetrospective:
      typeof o.finalRetrospective === 'string' && o.finalRetrospective.trim()
        ? o.finalRetrospective.trim()
        : null,
    completedAt:
      typeof o.completedAt === 'string' && o.completedAt.trim()
        ? o.completedAt.trim()
        : undefined,
  }
}

/** Firestore는 필드 값으로 undefined를 허용하지 않음 — merge 시 중첩 객체 정리 */
function voyageMetaForFirestore(meta: VoyageMeta): VoyageMeta {
  const completedAt =
    typeof meta.completedAt === 'string' && meta.completedAt.trim()
      ? meta.completedAt.trim()
      : undefined
  return {
    isCompleted: meta.isCompleted === true,
    finalRetrospective:
      typeof meta.finalRetrospective === 'string' && meta.finalRetrospective.trim()
        ? meta.finalRetrospective.trim()
        : null,
    ...(completedAt ? { completedAt } : {}),
  }
}

function parseRoutines(raw: unknown): MyRoutineEntry[] {
  if (!Array.isArray(raw)) return []
  const out: MyRoutineEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    const label = typeof r.label === 'string' ? r.label.trim() : ''
    if (!id || !label) continue
    const originRaw = r.originUserId
    const originUserId =
      originRaw === null
        ? null
        : typeof originRaw === 'string' && originRaw.trim()
          ? originRaw.trim()
          : null
    const originDisplayName =
      typeof r.originDisplayName === 'string' && r.originDisplayName.trim()
        ? r.originDisplayName.trim()
        : undefined
    const addedAt =
      typeof r.addedAt === 'string' && r.addedAt
        ? r.addedAt
        : new Date().toISOString()
    const lcd = r.lastCompletedDay
    const lastCompletedDay =
      lcd === null
        ? null
        : typeof lcd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lcd)
          ? lcd
          : null
    out.push({
      id,
      label,
      originUserId,
      ...(originDisplayName ? { originDisplayName } : {}),
      addedAt,
      lastCompletedDay,
    })
  }
  return out
}

export async function getUserDoc(uid: string): Promise<FirestoreUserDoc | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.users, uid))
  if (!snap.exists()) return null
  const d = snap.data() as Record<string, unknown>
  return {
    voyageMeta: parseVoyageMeta(d.voyageMeta),
    routines: parseRoutines(d.routines),
    isAdmin: d.isAdmin === true,
    displayName:
      typeof d.displayName === 'string' ? d.displayName : undefined,
    email: typeof d.email === 'string' ? d.email : undefined,
    photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
  }
}

export async function mergeUserDoc(
  uid: string,
  partial: Partial<Omit<FirestoreUserDoc, 'updatedAt'>>,
): Promise<void> {
  const ref = doc(db(), COLLECTIONS.users, uid)
  const payload: Record<string, unknown> = {
    ...partial,
    updatedAt: serverTimestamp(),
  }
  if (payload.voyageMeta !== undefined) {
    payload.voyageMeta = voyageMetaForFirestore(payload.voyageMeta as VoyageMeta)
  }
  await setDoc(ref, payload, { merge: true })
}

export type AdminUserRow = {
  uid: string
  displayName: string
  email: string
  photoURL: string
  isAdmin: boolean
}

export async function listUsersForAdminPanel(): Promise<AdminUserRow[]> {
  const snap = await getDocs(collection(db(), COLLECTIONS.users))
  const rows: AdminUserRow[] = snap.docs.map((docSnap) => {
    const d = docSnap.data() as Record<string, unknown>
    return {
      uid: docSnap.id,
      displayName:
        typeof d.displayName === 'string' && d.displayName.trim()
          ? d.displayName.trim()
          : '이름 없음',
      email: typeof d.email === 'string' ? d.email : '',
      photoURL: typeof d.photoURL === 'string' ? d.photoURL : '',
      isAdmin: d.isAdmin === true,
    }
  })
  return rows.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
    return a.displayName.localeCompare(b.displayName, 'ko')
  })
}

export async function setUserAdminFlag(
  uid: string,
  isAdmin: boolean,
): Promise<void> {
  await mergeUserDoc(uid, { isAdmin })
}

type FirestoreStoredMediaItem = {
  type: 'image' | 'video'
  mediaUrl?: string
  dataUrl?: string
}

type FirestoreVoyageDiarySnapshotItem = {
  id: string
  createdAt: string
  tag: string
  moodTag?: string
  body: string
  mediaItems?: FirestoreStoredMediaItem[]
}

export type FirestoreRecordApplication = {
  id: string
  applicantName: string
  categoryId: string
  /** 신청 시점의 카테고리 제목 — 다른 사용자/관리자 화면에서 표시용 */
  categoryTitle?: string
  recordValue: string
  journeyNote: string
  status: 'pending' | 'approved' | 'rejected'
  rejectedReason?: string
  mediaItems: FirestoreStoredMediaItem[]
  createdAt: number
  voyageDiarySnapshots?: FirestoreVoyageDiarySnapshotItem[]
  communityCheerTotal?: number
  communityCheerByEmoji?: Record<string, number>
  dailyRoutines?: string[]
  crisisMethodology?: string
  submitterUserId?: string
}

function parseFirestoreStoredMediaItems(raw: unknown): FirestoreStoredMediaItem[] {
  if (!Array.isArray(raw)) return []
  const out: FirestoreStoredMediaItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const mediaUrl =
      typeof o.mediaUrl === 'string' && /^https?:\/\//i.test(o.mediaUrl)
        ? o.mediaUrl
        : ''
    const dataUrl =
      typeof o.dataUrl === 'string' && o.dataUrl.startsWith('data:')
        ? o.dataUrl
        : ''
    if (!mediaUrl && !dataUrl) continue
    const type = o.type === 'video' ? 'video' : 'image'
    out.push({
      type,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(dataUrl ? { dataUrl } : {}),
    })
  }
  return out
}

function parseFirestoreVoyageSnapshots(
  raw: unknown,
): FirestoreVoyageDiarySnapshotItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: FirestoreVoyageDiarySnapshotItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    const createdAt = typeof o.createdAt === 'string' ? o.createdAt : ''
    if (!id || !createdAt) continue
    const mediaItems = parseFirestoreStoredMediaItems(o.mediaItems)
    out.push({
      id,
      createdAt,
      tag: typeof o.tag === 'string' ? o.tag : '',
      moodTag: typeof o.moodTag === 'string' ? o.moodTag : undefined,
      body: typeof o.body === 'string' ? o.body : '',
      ...(mediaItems.length ? { mediaItems } : {}),
    })
  }
  return out.length ? out : undefined
}

function parseRecordApplicationFromFirestore(
  id: string,
  raw: Record<string, unknown>,
): FirestoreRecordApplication | null {
  const status =
    raw.status === 'approved' || raw.status === 'rejected' || raw.status === 'pending'
      ? raw.status
      : 'pending'
  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : 0
  const mediaItems = parseFirestoreStoredMediaItems(raw.mediaItems)
  const voyageDiarySnapshots = parseFirestoreVoyageSnapshots(
    raw.voyageDiarySnapshots,
  )
  return {
    id,
    applicantName:
      typeof raw.applicantName === 'string' && raw.applicantName.trim()
        ? raw.applicantName.trim()
        : '(이름 없음)',
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : '',
    ...(typeof raw.categoryTitle === 'string' && raw.categoryTitle.trim()
      ? { categoryTitle: raw.categoryTitle.trim() }
      : {}),
    recordValue:
      typeof raw.recordValue === 'string' && raw.recordValue.trim()
        ? raw.recordValue.trim()
        : '—',
    journeyNote: typeof raw.journeyNote === 'string' ? raw.journeyNote : '',
    status,
    ...(typeof raw.rejectedReason === 'string' ? { rejectedReason: raw.rejectedReason } : {}),
    mediaItems,
    createdAt,
    ...(voyageDiarySnapshots ? { voyageDiarySnapshots } : {}),
    ...(typeof raw.communityCheerTotal === 'number' &&
    Number.isFinite(raw.communityCheerTotal) &&
    raw.communityCheerTotal > 0
      ? { communityCheerTotal: Math.floor(raw.communityCheerTotal) }
      : {}),
    ...(raw.communityCheerByEmoji && typeof raw.communityCheerByEmoji === 'object'
      ? { communityCheerByEmoji: raw.communityCheerByEmoji as Record<string, number> }
      : {}),
    ...(Array.isArray(raw.dailyRoutines)
      ? {
          dailyRoutines: raw.dailyRoutines.filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0,
          ),
        }
      : {}),
    ...(typeof raw.crisisMethodology === 'string' && raw.crisisMethodology.trim()
      ? { crisisMethodology: raw.crisisMethodology.trim() }
      : typeof raw.recoveryExperience === 'string' && raw.recoveryExperience.trim()
        ? { crisisMethodology: raw.recoveryExperience.trim() }
        : {}),
    ...(typeof raw.submitterUserId === 'string' && raw.submitterUserId.trim()
      ? { submitterUserId: raw.submitterUserId.trim() }
      : {}),
  }
}

export async function createRecordApplicationInFirestore(
  payload: FirestoreRecordApplication,
): Promise<void> {
  await setDoc(doc(db(), COLLECTIONS.recordApplications, payload.id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function listRecordApplicationsByStatus(
  status: 'pending' | 'approved' | 'rejected',
): Promise<FirestoreRecordApplication[]> {
  const q = query(
    collection(db(), COLLECTIONS.recordApplications),
    where('status', '==', status),
  )
  const snap = await getDocs(q)
  const out: FirestoreRecordApplication[] = []
  for (const docSnap of snap.docs) {
    const parsed = parseRecordApplicationFromFirestore(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    )
    if (parsed) out.push(parsed)
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export async function patchRecordApplicationStatus(
  applicationId: string,
  input: { status: 'approved' | 'rejected'; rejectedReason?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: serverTimestamp(),
    ...(input.status === 'rejected'
      ? { rejectedReason: input.rejectedReason?.trim() ?? '' }
      : { rejectedReason: '' }),
  }
  await updateDoc(doc(db(), COLLECTIONS.recordApplications, applicationId), patch)
}

/** 신청서를 영구 삭제 (관리자 전용) */
export async function deleteRecordApplication(
  applicationId: string,
): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.recordApplications, applicationId))
}

/** 특정 카테고리의 심사 대기 신청들을 조회 — 심사중 카드 상세보기 폴백용 */
export async function listPendingApplicationsByCategoryId(
  categoryId: string,
): Promise<FirestoreRecordApplication[]> {
  const trimmed = categoryId.trim()
  if (!trimmed) return []
  const q = query(
    collection(db(), COLLECTIONS.recordApplications),
    where('categoryId', '==', trimmed),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  const out: FirestoreRecordApplication[] = []
  for (const docSnap of snap.docs) {
    const parsed = parseRecordApplicationFromFirestore(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    )
    if (parsed) out.push(parsed)
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

// --- records (확정된 명예의 전당 기록) ---

export type FirestoreRecordTimelineRow = {
  generation: number
  applicationId: string
  name: string
  recordValue: string
  journeyId: string
  mediaType: 'image' | 'video'
  mediaUrl: string
  approvedAt: number
  dailyRoutines?: string[]
  crisisMethodology?: string
  /** 신청자가 적은 전체 소감 */
  journeyNote?: string
  /** 항해 일지(나의 바다) 스냅샷 — 순풍/파도/태풍 분류용 원본 */
  voyageDiarySnapshots?: FirestoreVoyageDiarySnapshotItem[]
  /** 신청 시점 누적 응원 */
  communityCheerTotal?: number
  communityCheerByEmoji?: Record<string, number>
  /** 함께 보존되는 미디어 첨부 — 다중 사진/영상 지원 */
  mediaItems?: FirestoreStoredMediaItem[]
}

export type FirestoreRecordDoc = {
  id: string
  categoryId: string
  title: string
  status: 'approved'
  currentHolder: FirestoreRecordTimelineRow | null
  timeline: FirestoreRecordTimelineRow[]
  createdAt: number
}

function parseRecordTimelineRow(raw: unknown): FirestoreRecordTimelineRow | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const generation =
    typeof o.generation === 'number' && Number.isFinite(o.generation)
      ? o.generation
      : 0
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!generation || !name) return null
  const recordValue = typeof o.recordValue === 'string' ? o.recordValue : ''
  const dailyRoutines = Array.isArray(o.dailyRoutines)
    ? o.dailyRoutines.filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      )
    : []
  const crisis =
    typeof o.crisisMethodology === 'string' && o.crisisMethodology.trim()
      ? o.crisisMethodology.trim()
      : typeof o.recoveryExperience === 'string' && o.recoveryExperience.trim()
        ? o.recoveryExperience.trim()
        : ''
  const journeyNote =
    typeof o.journeyNote === 'string' && o.journeyNote.trim()
      ? o.journeyNote.trim()
      : ''
  const voyageDiarySnapshots = parseFirestoreVoyageSnapshots(
    o.voyageDiarySnapshots,
  )
  const cheerTotal =
    typeof o.communityCheerTotal === 'number' &&
    Number.isFinite(o.communityCheerTotal) &&
    o.communityCheerTotal > 0
      ? Math.floor(o.communityCheerTotal)
      : undefined
  const cheerByEmoji =
    o.communityCheerByEmoji &&
    typeof o.communityCheerByEmoji === 'object' &&
    !Array.isArray(o.communityCheerByEmoji)
      ? (o.communityCheerByEmoji as Record<string, number>)
      : undefined
  const mediaItems = parseFirestoreStoredMediaItems(o.mediaItems)
  return {
    generation,
    applicationId:
      typeof o.applicationId === 'string' ? o.applicationId : '',
    name,
    recordValue,
    journeyId: typeof o.journeyId === 'string' ? o.journeyId : '',
    mediaType: o.mediaType === 'video' ? 'video' : 'image',
    mediaUrl: typeof o.mediaUrl === 'string' ? o.mediaUrl : '',
    approvedAt:
      typeof o.approvedAt === 'number' && Number.isFinite(o.approvedAt)
        ? o.approvedAt
        : 0,
    ...(dailyRoutines.length ? { dailyRoutines } : {}),
    ...(crisis ? { crisisMethodology: crisis } : {}),
    ...(journeyNote ? { journeyNote } : {}),
    ...(voyageDiarySnapshots ? { voyageDiarySnapshots } : {}),
    ...(cheerTotal != null ? { communityCheerTotal: cheerTotal } : {}),
    ...(cheerByEmoji ? { communityCheerByEmoji: cheerByEmoji } : {}),
    ...(mediaItems.length ? { mediaItems } : {}),
  }
}

function parseRecordTimeline(raw: unknown): FirestoreRecordTimelineRow[] {
  if (!Array.isArray(raw)) return []
  const out: FirestoreRecordTimelineRow[] = []
  for (const row of raw) {
    const parsed = parseRecordTimelineRow(row)
    if (parsed) out.push(parsed)
  }
  return out.sort((a, b) => a.generation - b.generation)
}

function parseRecordDocFromFirestore(
  id: string,
  raw: Record<string, unknown>,
): FirestoreRecordDoc | null {
  const timeline = parseRecordTimeline(raw.timeline)
  const currentHolder =
    raw.currentHolder && typeof raw.currentHolder === 'object'
      ? parseRecordTimelineRow(raw.currentHolder)
      : timeline.length
        ? timeline[timeline.length - 1]
        : null
  return {
    id,
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : id,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : id,
    status: 'approved',
    currentHolder,
    timeline,
    createdAt:
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : 0,
  }
}

export async function getRecordDoc(
  recordId: string,
): Promise<FirestoreRecordDoc | null> {
  const trimmed = recordId.trim()
  if (!trimmed) return null
  const snap = await getDoc(doc(db(), COLLECTIONS.records, trimmed))
  if (!snap.exists()) return null
  return parseRecordDocFromFirestore(
    snap.id,
    snap.data() as Record<string, unknown>,
  )
}

export async function listRecordDocs(): Promise<FirestoreRecordDoc[]> {
  const snap = await getDocs(collection(db(), COLLECTIONS.records))
  const out: FirestoreRecordDoc[] = []
  for (const docSnap of snap.docs) {
    const parsed = parseRecordDocFromFirestore(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    )
    if (parsed) out.push(parsed)
  }
  return out
}

/** 기록 문서 영구 삭제 (관리자 전용) */
export async function deleteRecordDoc(recordId: string): Promise<void> {
  const trimmed = recordId.trim()
  if (!trimmed) return
  await deleteDoc(doc(db(), COLLECTIONS.records, trimmed))
}

/**
 * 타임라인의 특정 회차(generation) 한 줄만 영구 삭제 (관리자 전용).
 * arrayRemove는 객체 동등성 매칭이 까다로워서 read → filter → updateDoc 으로 안전 처리.
 * 마지막 한 줄까지 비면 records 문서를 통째로 삭제한다.
 */
export async function removeTimelineRowFromRecord(
  recordId: string,
  generation: number,
): Promise<{ removed: boolean; remainingTimeline: FirestoreRecordTimelineRow[] }> {
  const trimmedId = recordId.trim()
  if (!trimmedId || !Number.isFinite(generation)) {
    return { removed: false, remainingTimeline: [] }
  }
  const ref = doc(db(), COLLECTIONS.records, trimmedId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    return { removed: false, remainingTimeline: [] }
  }
  const timeline = parseRecordTimeline(
    (snap.data() as Record<string, unknown>).timeline,
  )
  const next = timeline.filter((r) => r.generation !== generation)
  if (next.length === timeline.length) {
    return { removed: false, remainingTimeline: timeline }
  }
  if (next.length === 0) {
    await deleteDoc(ref)
    return { removed: true, remainingTimeline: [] }
  }
  const newCurrent = next.reduce<FirestoreRecordTimelineRow | null>(
    (acc, row) => (acc == null || row.generation > acc.generation ? row : acc),
    null,
  )
  await updateDoc(ref, {
    timeline: next,
    currentHolder: newCurrent,
    updatedAt: serverTimestamp(),
  })
  return { removed: true, remainingTimeline: next }
}

/**
 * 신청 승인 처리 — records 컬렉션에 새 문서를 만들거나 기존 문서의 timeline에
 * arrayUnion으로 합치고, 신청서 상태도 approved 로 갱신한다.
 */
export async function approveApplicationToRecord(
  application: FirestoreRecordApplication,
  options: { categoryTitle: string },
): Promise<{ recordId: string; isNewRecord: boolean }> {
  const recordId = application.categoryId.trim()
  if (!recordId) {
    throw new Error('승인할 기록의 카테고리 ID가 없습니다.')
  }

  const ref = doc(db(), COLLECTIONS.records, recordId)
  const snap = await getDoc(ref)
  const existed = snap.exists()
  const existingTimeline = existed
    ? parseRecordTimeline(
        (snap.data() as Record<string, unknown>).timeline,
      )
    : []

  const nextGeneration =
    existingTimeline.reduce((m, r) => Math.max(m, r.generation), 0) + 1

  const firstMedia = application.mediaItems[0]
  const primaryMediaUrl = firstMedia
    ? (firstMedia.mediaUrl?.trim() ?? '') ||
      (firstMedia.dataUrl?.trim() ?? '')
    : ''
  const mediaType: 'image' | 'video' =
    firstMedia?.type === 'video' ? 'video' : 'image'

  const dailyRoutines = (application.dailyRoutines ?? []).filter(
    (s) => s.trim().length > 0,
  )
  const crisis = application.crisisMethodology?.trim() ?? ''
  const journeyNote = application.journeyNote?.trim() ?? ''
  const voyageDiarySnapshots = application.voyageDiarySnapshots
  const cheerTotal = application.communityCheerTotal
  const cheerByEmoji = application.communityCheerByEmoji
  const allMediaItems = application.mediaItems ?? []

  const newRow: FirestoreRecordTimelineRow = {
    generation: nextGeneration,
    applicationId: application.id,
    name: application.applicantName,
    recordValue: application.recordValue,
    journeyId: `APP-${application.id}`,
    mediaType,
    mediaUrl: primaryMediaUrl,
    approvedAt: Date.now(),
    ...(dailyRoutines.length ? { dailyRoutines } : {}),
    ...(crisis ? { crisisMethodology: crisis } : {}),
    ...(journeyNote ? { journeyNote } : {}),
    ...(voyageDiarySnapshots && voyageDiarySnapshots.length
      ? { voyageDiarySnapshots }
      : {}),
    ...(typeof cheerTotal === 'number' && cheerTotal > 0
      ? { communityCheerTotal: cheerTotal }
      : {}),
    ...(cheerByEmoji && Object.keys(cheerByEmoji).length > 0
      ? { communityCheerByEmoji: cheerByEmoji }
      : {}),
    ...(allMediaItems.length ? { mediaItems: allMediaItems } : {}),
  }

  if (existed) {
    await updateDoc(ref, {
      timeline: arrayUnion(newRow),
      currentHolder: newRow,
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  } else {
    const created: FirestoreRecordDoc = {
      id: recordId,
      categoryId: recordId,
      title: options.categoryTitle.trim() || recordId,
      status: 'approved',
      currentHolder: newRow,
      timeline: [newRow],
      createdAt: Date.now(),
    }
    await setDoc(ref, {
      ...created,
      updatedAt: serverTimestamp(),
    })
  }

  await updateDoc(doc(db(), COLLECTIONS.recordApplications, application.id), {
    status: 'approved',
    rejectedReason: '',
    approvedAt: Date.now(),
    updatedAt: serverTimestamp(),
  })

  return { recordId, isNewRecord: !existed }
}

export async function setUserVoyageMeta(
  uid: string,
  meta: VoyageMeta,
): Promise<void> {
  await mergeUserDoc(uid, { voyageMeta: meta })
}

export async function setUserRoutines(
  uid: string,
  routines: MyRoutineEntry[],
): Promise<void> {
  await mergeUserDoc(uid, { routines })
}

// --- voyages (active + archived) ---

type VoyageDocActive = {
  userId: string
  status: 'active'
  profile: MyVoyageProfile
}

type VoyageDocArchived = {
  userId: string
  status: 'archived'
  completedAt: string
  goalName: string
  voyageLegId: string
  linkedCategoryId: string | null
  progressPercent: number
  subGoal: string
  finalRetrospective: string | null
  diaryEntries: LogEntry[]
  activeGoalSnapshot?: MyVoyageProfile | null
}

export async function getActiveVoyageProfile(
  uid: string,
): Promise<MyVoyageProfile | null> {
  const snap = await getDoc(doc(db(), COLLECTIONS.voyages, activeVoyageDocId(uid)))
  if (!snap.exists()) return null
  const d = snap.data() as Record<string, unknown>
  if (d.status !== 'active') return null
  const profile = d.profile as unknown
  if (!profile || typeof profile !== 'object') return null
  const p = profile as Record<string, unknown>
  const synced = withSyncedVoyageDerived({
    goalName: typeof p.goalName === 'string' ? p.goalName : '',
    inspiredBy:
      typeof p.inspiredBy === 'string' && p.inspiredBy.trim()
        ? p.inspiredBy.trim()
        : null,
    subGoal: '',
    progressPercent: 0,
    linkedCategoryId:
      typeof p.linkedCategoryId === 'string' && p.linkedCategoryId.trim()
        ? p.linkedCategoryId.trim()
        : null,
    voyageLegId:
      typeof p.voyageLegId === 'string' ? p.voyageLegId.trim() : '',
    milestones: Array.isArray(p.milestones)
      ? (p.milestones as MyVoyageProfile['milestones']).filter(
          (m) => m && typeof m.id === 'string' && typeof m.label === 'string',
        )
      : [],
  })
  return synced
}

export async function setActiveVoyageProfile(
  uid: string,
  profile: MyVoyageProfile,
): Promise<void> {
  const milestoneSource = Array.isArray(profile.milestones)
    ? profile.milestones
    : []
  const milestones: MyVoyageProfile['milestones'] = milestoneSource.map((m) => ({
    id:
      typeof m?.id === 'string' && m.id.trim()
        ? m.id.trim()
        : crypto.randomUUID(),
    label: typeof m?.label === 'string' ? m.label : '',
    completed: m?.completed === true,
  }))
  const synced = withSyncedVoyageDerived({
    ...profile,
    goalName: typeof profile.goalName === 'string' ? profile.goalName : '',
    inspiredBy: profile.inspiredBy ?? null,
    subGoal: typeof profile.subGoal === 'string' ? profile.subGoal : '',
    linkedCategoryId: profile.linkedCategoryId ?? null,
    voyageLegId:
      typeof profile.voyageLegId === 'string' ? profile.voyageLegId : '',
    milestones,
  })
  const payload: VoyageDocActive = {
    userId: uid,
    status: 'active',
    profile: synced,
  }
  await setDoc(doc(db(), COLLECTIONS.voyages, activeVoyageDocId(uid)), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteActiveVoyage(uid: string): Promise<void> {
  await deleteDoc(doc(db(), COLLECTIONS.voyages, activeVoyageDocId(uid)))
}

export async function appendArchivedVoyage(
  uid: string,
  payload: {
    completedAt: string
    goalName: string
    voyageLegId: string
    linkedCategoryId: string | null
    progressPercent: number
    subGoal: string
    diaryEntries: LogEntry[]
    activeGoalSnapshot: MyVoyageProfile
  },
): Promise<string> {
  const id = crypto.randomUUID()
  const ref = doc(db(), COLLECTIONS.voyages, id)
  const row: VoyageDocArchived = {
    userId: uid,
    status: 'archived',
    completedAt: payload.completedAt,
    goalName: payload.goalName.trim() || '나의 항해',
    voyageLegId: payload.voyageLegId.trim(),
    linkedCategoryId: payload.linkedCategoryId,
    progressPercent: payload.progressPercent,
    subGoal: payload.subGoal,
    finalRetrospective: null,
    diaryEntries: payload.diaryEntries,
    activeGoalSnapshot: payload.activeGoalSnapshot,
  }
  await setDoc(ref, {
    ...row,
    createdAt: serverTimestamp(),
  })
  notifyProfileUpdates()
  notifyOceanDataUpdated()
  return id
}

export async function listArchivedVoyages(
  uid: string,
): Promise<CompletedVoyageArchiveEntry[]> {
  const q = query(
    collection(db(), COLLECTIONS.voyages),
    where('userId', '==', uid),
  )
  const snap = await getDocs(q)
  const out: CompletedVoyageArchiveEntry[] = []
  for (const docSnap of snap.docs) {
    const d = docSnap.data() as Record<string, unknown>
    if (d.status !== 'archived') continue
    const completedAt =
      typeof d.completedAt === 'string' ? d.completedAt.trim() : ''
    if (!completedAt) continue
    const snapParsed =
      d.activeGoalSnapshot !== undefined && d.activeGoalSnapshot !== null
        ? profileFromSnapshotJson(d.activeGoalSnapshot)
        : null
    out.push({
      id: docSnap.id,
      goalName:
        typeof d.goalName === 'string' ? d.goalName.trim() || '나의 항해' : '나의 항해',
      completedAt,
      voyageLegId:
        typeof d.voyageLegId === 'string' ? d.voyageLegId : '',
      linkedCategoryId:
        typeof d.linkedCategoryId === 'string' && d.linkedCategoryId.trim()
          ? d.linkedCategoryId.trim()
          : null,
      progressPercent:
        typeof d.progressPercent === 'number' && Number.isFinite(d.progressPercent)
          ? Math.max(0, Math.min(100, Math.round(d.progressPercent)))
          : 0,
      subGoal: typeof d.subGoal === 'string' ? d.subGoal : '',
      finalRetrospective:
        typeof d.finalRetrospective === 'string' && d.finalRetrospective.trim()
          ? d.finalRetrospective.trim()
          : null,
      diaryEntries: Array.isArray(d.diaryEntries)
        ? (d.diaryEntries as LogEntry[])
        : [],
      ...(snapParsed ? { activeGoalSnapshot: snapParsed } : {}),
    })
  }
  return out.sort(
    (a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )
}

export async function patchArchivedVoyageRetrospective(
  uid: string,
  completedAt: string,
  text: string,
): Promise<void> {
  const at = completedAt.trim()
  if (!at) return
  const list = await listArchivedVoyages(uid)
  const row = list.find((e) => e.completedAt === at)
  if (!row) return
  await updateDoc(doc(db(), COLLECTIONS.voyages, row.id), {
    finalRetrospective: text.trim() || null,
  })
  notifyProfileUpdates()
  notifyOceanDataUpdated()
}

// --- logs ---

function attachmentsForFirestore(
  list: LogEntry['attachments'],
): Record<string, unknown>[] | undefined {
  if (!list?.length) return undefined
  const rows: Record<string, unknown>[] = []
  for (const a of list) {
    const row: Record<string, unknown> = {
      id: a.id,
      type: a.type,
    }
    const mu = a.mediaUrl?.trim()
    const du = a.dataUrl?.trim()
    if (mu) row.mediaUrl = mu
    if (du) row.dataUrl = du
    rows.push(row)
  }
  return rows.length ? rows : undefined
}

function parseLogAttachmentsFromFirestore(
  raw: unknown,
): LogAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LogAttachment[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    const type =
      o.type === 'video' ? 'video' : o.type === 'image' ? 'image' : ''
    const mediaUrl =
      typeof o.mediaUrl === 'string' && /^https?:\/\//i.test(o.mediaUrl.trim())
        ? o.mediaUrl.trim()
        : ''
    const dataUrl =
      typeof o.dataUrl === 'string' && o.dataUrl.startsWith('data:')
        ? o.dataUrl
        : ''
    if (!id || !type || (!mediaUrl && !dataUrl)) continue
    out.push({
      id,
      type,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(dataUrl ? { dataUrl } : {}),
    })
  }
  return out.length ? out : undefined
}

function logEntryToFirestore(
  uid: string,
  e: LogEntry,
): Record<string, unknown> {
  const attachments = attachmentsForFirestore(e.attachments)
  return {
    userId: uid,
    id: e.id,
    tag: e.tag,
    body: e.body,
    createdAt: e.createdAt,
    inspiredCount: e.inspiredCount ?? 0,
    ...(e.voyageLegId ? { voyageLegId: e.voyageLegId } : {}),
    ...(attachments?.length ? { attachments } : {}),
    updatedAt: serverTimestamp(),
  }
}

function firestoreToLogEntry(d: Record<string, unknown>): LogEntry | null {
  const id = typeof d.id === 'string' ? d.id : ''
  const tag = d.tag
  const body = typeof d.body === 'string' ? d.body : ''
  const createdAt = typeof d.createdAt === 'string' ? d.createdAt : ''
  if (!id || !body || !createdAt) return null
  if (
    tag !== 'passion' &&
    tag !== 'wall' &&
    tag !== 'direction' &&
    tag !== 'tailwind'
  ) {
    return null
  }
  const inspiredCount =
    typeof d.inspiredCount === 'number' && d.inspiredCount >= 0
      ? Math.floor(d.inspiredCount)
      : 0
  const voyageLegId =
    typeof d.voyageLegId === 'string' && d.voyageLegId.trim()
      ? d.voyageLegId.trim()
      : undefined
  const attachments = parseLogAttachmentsFromFirestore(d.attachments)
  return {
    id,
    tag,
    body,
    createdAt,
    inspiredCount,
    ...(voyageLegId ? { voyageLegId } : {}),
    ...(attachments?.length ? { attachments } : {}),
  }
}

export async function listLogsForUser(uid: string): Promise<LogEntry[]> {
  const q = query(
    collection(db(), COLLECTIONS.logs),
    where('userId', '==', uid),
  )
  const snap = await getDocs(q)
  const out: LogEntry[] = []
  for (const docSnap of snap.docs) {
    const e = firestoreToLogEntry(docSnap.data() as Record<string, unknown>)
    if (e) out.push(e)
  }
  return out.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function upsertLog(uid: string, entry: LogEntry): Promise<void> {
  await setDoc(
    doc(db(), COLLECTIONS.logs, entry.id),
    logEntryToFirestore(uid, entry),
  )
}

export async function deleteAllLogsForUser(uid: string): Promise<void> {
  const q = query(
    collection(db(), COLLECTIONS.logs),
    where('userId', '==', uid),
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db())
  let n = 0
  for (const d of snap.docs) {
    batch.delete(d.ref)
    n++
    if (n >= 450) {
      await batch.commit()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}

export async function migrateLogsAssignLeg(
  uid: string,
  legId: string,
): Promise<void> {
  const q = query(
    collection(db(), COLLECTIONS.logs),
    where('userId', '==', uid),
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db())
  let n = 0
  for (const docSnap of snap.docs) {
    const d = docSnap.data() as Record<string, unknown>
    if (d.voyageLegId) continue
    batch.update(docSnap.ref, { voyageLegId: legId, updatedAt: serverTimestamp() })
    n++
    if (n >= 450) {
      await batch.commit()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}

// --- bootstrap ---

export async function loadMyOceanBundle(uid: string): Promise<{
  profile: MyVoyageProfile
  entries: LogEntry[]
  routines: MyRoutineEntry[]
  meta: VoyageMeta
}> {
  const [userRow, profile, entries] = await Promise.all([
    getUserDoc(uid),
    getActiveVoyageProfile(uid),
    listLogsForUser(uid),
  ])
  const meta = userRow?.voyageMeta ?? { ...defaultVoyageMeta }
  const routines = userRow?.routines ?? []
  const empty = withSyncedVoyageDerived({
    goalName: '',
    inspiredBy: null,
    subGoal: '',
    progressPercent: 0,
    linkedCategoryId: null,
    voyageLegId: '',
    milestones: [],
  })
  return {
    profile: profile ?? empty,
    entries,
    routines,
    meta,
  }
}
