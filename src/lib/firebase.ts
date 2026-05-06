import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey?.trim() &&
      firebaseConfig.projectId?.trim() &&
      firebaseConfig.appId?.trim(),
  )
}

let appCache: FirebaseApp | null = null

/**
 * Firebase 앱 인스턴스. .env.local이 채워지기 전에는 호출하지 마세요.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase가 설정되지 않았습니다. .env.local에 VITE_FIREBASE_* 값을 입력한 뒤 개발 서버를 다시 시작해 주세요.',
    )
  }
  if (appCache) return appCache
  appCache = getApps()[0] ?? initializeApp(firebaseConfig)
  return appCache
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export function getFirestoreDb(): Firestore {
  return getFirestore(getFirebaseApp())
}

let storageCache: FirebaseStorage | null = null

/** Firebase Storage — 일지 미디어 업로드용 */
export function getFirebaseStorage(): FirebaseStorage {
  if (storageCache) return storageCache
  storageCache = getStorage(getFirebaseApp())
  return storageCache
}
