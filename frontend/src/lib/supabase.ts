import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY; auth will not work.");
}

// Use sessionStorage so each browser tab has an isolated session.
// This prevents the admin tab from being kicked out when a client
// logs in from a different tab in the same browser window.
// Sessions persist across page refreshes within the same tab but
// are cleared when the tab is closed.
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
  },
});

export function subscribeToCallLogs(
  clientId: string,
  onInsert: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`call_logs:${clientId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "call_logs",
        filter: `client_id=eq.${clientId}`,
      },
      (payload) => onInsert(payload.new as Record<string, unknown>),
    )
    .subscribe();
}
