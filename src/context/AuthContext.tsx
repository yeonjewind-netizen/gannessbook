import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { getUserDoc, mergeUserDoc } from '../lib/firestoreUtils'

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAdmin: boolean
  firebaseReady: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setLoading(true)
      void (async () => {
        try {
          await mergeUserDoc(u.uid, {
            ...(u.displayName ? { displayName: u.displayName } : {}),
            ...(u.email ? { email: u.email } : {}),
            ...(u.photoURL ? { photoURL: u.photoURL } : {}),
          })
          const row = await getUserDoc(u.uid)
          setIsAdmin(row?.isAdmin === true)
        } catch {
          setIsAdmin(false)
        } finally {
          setLoading(false)
        }
      })()
    })
    return unsub
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      window.alert(
        'Firebase 설정이 필요합니다. 프로젝트 루트의 .env.local에 VITE_FIREBASE_* 값을 넣고 서버를 재시작해 주세요.',
      )
      return
    }
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(getFirebaseAuth(), provider)
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : '로그인에 실패했습니다. 다시 시도해 주세요.'
      window.alert(msg)
    }
  }, [])

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured()) return
    await signOut(getFirebaseAuth())
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin,
      firebaseReady: isFirebaseConfigured(),
      signInWithGoogle,
      logout,
    }),
    [user, loading, isAdmin, signInWithGoogle, logout],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  }
  return ctx
}
