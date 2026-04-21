import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getMe } from "../lib/api";
import { supabase } from "../lib/supabase";

type Role = "admin" | "client" | null;

interface AuthState {
  user: User | null;
  clientId: string | null;
  token: string | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRole(accessToken: string) {
    try {
      const me = await getMe(accessToken);
      setRole(me.is_admin ? "admin" : "client");
    } catch {
      // Transient failure — keep existing role. Role only clears on sign-out.
      // Setting "client" on failure was kicking admins out during server blips.
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user && nextSession.access_token) {
        await fetchRole(nextSession.access_token);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        // Explicit sign-out or expired session — clear role.
        setRole(null);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED just renews the JWT — role never changes.
      // Re-fetching on every hourly refresh caused admins to get
      // redirected to /dashboard when the backend was momentarily slow.
      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        setLoading(false);
        return;
      }

      // SIGNED_IN, PASSWORD_RECOVERY, USER_UPDATED — re-fetch role.
      if (nextSession.access_token) {
        await fetchRole(nextSession.access_token);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        clientId: user?.id ?? null,
        token: session?.access_token ?? null,
        role,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
