/**
 * Firestore — users / voyages / logs
 * 모든 쿼리·문서는 userId(uid)로 스코프합니다.
 */

import {
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
import type { LogEntry, VoyageMeta } from '../voyage/types'
import type { MyRoutineEntry } from '../voyage/myRoutinesStorage'
import type { CompletedVoyageArchiveEntry } from '../voyage/completedVoyagesArchive'
import { profileFromSnapshotJson } from '../voyage/myVoyageStorage'
import { getFirestoreDb } from './firebase'
import { notifyProfileUpdates } from '../voyage/profileApplicantStorage'

export const COLLECTIONS = {
  users: 'users',
  voyages: 'voyages',
  logs: 'logs',
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
  await setDoc(ref, payload, { merge: true })
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
  const synced = withSyncedVoyageDerived(profile)
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

function logEntryToFirestore(
  uid: string,
  e: LogEntry,
): Record<string, unknown> {
  return {
    userId: uid,
    id: e.id,
    tag: e.tag,
    body: e.body,
    createdAt: e.createdAt,
    inspiredCount: e.inspiredCount ?? 0,
    ...(e.voyageLegId ? { voyageLegId: e.voyageLegId } : {}),
    ...(e.attachments?.length ? { attachments: e.attachments } : {}),
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
  const attachments = Array.isArray(d.attachments)
    ? (d.attachments as LogEntry['attachments'])
    : undefined
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
