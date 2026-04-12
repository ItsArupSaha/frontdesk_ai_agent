import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — auth will not work.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

/** Subscribe to realtime inserts on call_logs for a given client. */
export function subscribeToCallLogs(
  clientId: string,
  onInsert: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`call_logs:${clientId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_logs',
        filter: `client_id=eq.${clientId}`,
      },
      (payload) => onInsert(payload.new as Record<string, unknown>),
    )
    .subscribe()
}
