import { useCallback, useSyncExternalStore } from 'react'
import {
  GANNESS_RECORD_CATEGORIES,
  type GannessRecordCategory,
} from '../data/gannessRecords'
import {
  GANNESS_STORAGE_EVENT,
  getAdminMode,
  getPendingApplications,
  mergeRecordCategories,
  setAdminMode as persistAdminMode,
  type RecordApplication,
} from '../data/gannessPersistence'

function subscribe(cb: () => void) {
  window.addEventListener(GANNESS_STORAGE_EVENT, cb)
  return () => window.removeEventListener(GANNESS_STORAGE_EVENT, cb)
}

/**
 * useSyncExternalStore는 getSnapshot이 "저장소가 바뀌지 않았으면" 이전과 동일한 참조·값을
 * 돌려줘야 한다. mergeRecordCategories()를 매 렌더마다 호출하면 매번 새 배열이 생겨
 * Maximum update depth exceeded 가 난다. → 이벤트 때만 캐시를 갱신한다.
 */
let mergedCategoriesCache: GannessRecordCategory[] = GANNESS_RECORD_CATEGORIES
let pendingApplicationsCache: RecordApplication[] = []

function refreshGannessSnapshots(): void {
  try {
    mergedCategoriesCache = mergeRecordCategories()
  } catch {
    mergedCategoriesCache = GANNESS_RECORD_CATEGORIES
  }
  try {
    pendingApplicationsCache = getPendingApplications()
  } catch {
    pendingApplicationsCache = []
  }
}

refreshGannessSnapshots()

function subscribeGannessStore(cb: () => void) {
  const onStore = () => {
    refreshGannessSnapshots()
    cb()
  }
  window.addEventListener(GANNESS_STORAGE_EVENT, onStore)
  return () => window.removeEventListener(GANNESS_STORAGE_EVENT, onStore)
}

export function useMergedRecordCategories() {
  return useSyncExternalStore(
    subscribeGannessStore,
    () => mergedCategoriesCache,
    () => GANNESS_RECORD_CATEGORIES,
  )
}

export function useAdminMode() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => getAdminMode(),
    () => false,
  )

  const setEnabled = useCallback((on: boolean) => {
    persistAdminMode(on)
  }, [])

  return { enabled, setEnabled }
}

export function usePendingApplications() {
  return useSyncExternalStore(
    subscribeGannessStore,
    () => pendingApplicationsCache,
    () => [],
  )
}
