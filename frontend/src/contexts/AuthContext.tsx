import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getMe } from '../lib/api'

interface AuthState {
  user: User | null
  /** Supabase user.id — used as client_id for all backend API calls. */
  clientId: string | null
  /** Raw JWT access token — attach as Authorization: Bearer {token}. */
  token: string | null
  /** User role: 'admin' or 'client'. Null while loading. */
  role: 'admin' | 'client' | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<'admin' | 'client' | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * Fetch the user's role from GET /api/auth/me.
   * Works for both admins (no clients row) and clients.
   * Called after login and on session hydration.
   */
  async function fetchRole(accessToken: string): Promise<void> {
    try {
      const me = await getMe(accessToken)
      setRole(me.is_admin ? 'admin' : 'client')
    } catch {
      // If the request fails, default to 'client' — safe fallback.
      setRole('client')
    }
  }

  useEffect(() => {
    // Hydrate from existing session on mount.
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user && s.access_token) {
        await fetchRole(s.access_token)
      }
      setLoading(false)
    })

    // Keep in sync with auth state changes (login / logout / token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user && newSession.access_token) {
        await fetchRole(newSession.access_token)
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setRole(null)
  }

  const value: AuthState = {
    user,
    clientId: user?.id ?? null,
    token: session?.access_token ?? null,
    role,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Consume auth state anywhere in the component tree.
 * Throws if used outside <AuthProvider>.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
