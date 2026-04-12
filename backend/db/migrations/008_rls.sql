-- Migration 008: Row Level Security (RLS)
-- ============================================================
-- PURPOSE
-- -------
-- Restrict the Supabase anon key (used by the React frontend)
-- so that every authenticated user can only read/write rows
-- that belong to their own client account.
--
-- HOW IT WORKS
-- ------------
-- Supabase has two keys that interact with this database:
--
--   service_role key  →  Used by the FastAPI backend (Railway).
--                        Supabase grants the service_role the
--                        BYPASSRLS privilege by default, so ALL
--                        existing backend queries continue to work
--                        without any code changes.
--
--   anon key + JWT    →  Used by the React frontend.
--                        After supabase.auth.signInWithPassword(),
--                        every query carries the user's JWT.
--                        auth.uid() returns the Supabase user ID,
--                        which equals the client_id throughout
--                        this schema (Phase 6 design decision).
--
-- Without any policy for a role, RLS defaults to DENY ALL.
-- Unauthenticated (anon, no JWT) requests are therefore denied
-- access to every table automatically once RLS is enabled.
--
-- REALTIME
-- --------
-- Supabase Realtime honours RLS on call_logs. The frontend
-- subscription already passes a client_id filter; the policy
-- provides the security guarantee behind that filter.
--
-- IDEMPOTENCY
-- -----------
-- Uses DROP POLICY IF EXISTS before each CREATE POLICY so this
-- file can be re-run safely (e.g. during local dev resets).
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. clients
--    id = auth.uid() because the Supabase auth user ID is the
--    client primary key (see Phase 6 spec).
-- ──────────────────────────────────────────────────────────────
alter table clients enable row level security;

drop policy if exists "clients_select_own" on clients;
create policy "clients_select_own"
  on clients
  for select
  using (auth.uid() = id);

-- Dashboard Settings page writes back via PUT /api/dashboard/settings.
-- The backend uses the service key, so this policy is a belt-and-
-- suspenders guard for any future direct-from-frontend writes.
drop policy if exists "clients_update_own" on clients;
create policy "clients_update_own"
  on clients
  for update
  using (auth.uid() = id);


-- ──────────────────────────────────────────────────────────────
-- 2. call_logs
--    Read-only for the frontend; the backend (service key)
--    inserts and updates rows without touching these policies.
-- ──────────────────────────────────────────────────────────────
alter table call_logs enable row level security;

drop policy if exists "call_logs_select_own" on call_logs;
create policy "call_logs_select_own"
  on call_logs
  for select
  using (auth.uid() = client_id);


-- ──────────────────────────────────────────────────────────────
-- 3. conversation_state
--    Ephemeral table; frontend has no direct need to read it
--    but it must be protected in case of accidental exposure.
-- ──────────────────────────────────────────────────────────────
alter table conversation_state enable row level security;

drop policy if exists "conversation_state_select_own" on conversation_state;
create policy "conversation_state_select_own"
  on conversation_state
  for select
  using (auth.uid() = client_id);


-- ──────────────────────────────────────────────────────────────
-- 4. bookings
--    Frontend reads bookings (Bookings page) and updates status
--    (Mark as Completed) via PATCH /api/dashboard/bookings/{id}.
--    The PATCH endpoint uses the service key, but the UPDATE
--    policy is here for defence-in-depth.
-- ──────────────────────────────────────────────────────────────
alter table bookings enable row level security;

drop policy if exists "bookings_select_own" on bookings;
create policy "bookings_select_own"
  on bookings
  for select
  using (auth.uid() = client_id);

drop policy if exists "bookings_update_own" on bookings;
create policy "bookings_update_own"
  on bookings
  for update
  using (auth.uid() = client_id);


-- ──────────────────────────────────────────────────────────────
-- 5. knowledge_chunks
--    Only accessed by the backend RAG service (service key).
--    The frontend never queries this table directly, but RLS
--    prevents any accidental anon-key reads of embeddings.
--
--    Note: the match_knowledge_chunks(query_embedding, ...)
--    function is called via the service key, which bypasses
--    RLS, so no changes to that function are needed.
-- ──────────────────────────────────────────────────────────────
alter table knowledge_chunks enable row level security;

drop policy if exists "knowledge_chunks_select_own" on knowledge_chunks;
create policy "knowledge_chunks_select_own"
  on knowledge_chunks
  for select
  using (auth.uid() = client_id);


-- ──────────────────────────────────────────────────────────────
-- 6. reminders_queue
--    Only read/written by the backend scheduler (service key).
--    RLS prevents any anon-key exposure of SMS job details.
-- ──────────────────────────────────────────────────────────────
alter table reminders_queue enable row level security;

drop policy if exists "reminders_queue_select_own" on reminders_queue;
create policy "reminders_queue_select_own"
  on reminders_queue
  for select
  using (auth.uid() = client_id);


-- ──────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run manually in Supabase SQL editor)
-- ──────────────────────────────────────────────────────────────
-- Check RLS is enabled on every table:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--     and tablename in (
--       'clients','call_logs','conversation_state',
--       'bookings','knowledge_chunks','reminders_queue'
--     );
--
-- List all policies:
--
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, policyname;
