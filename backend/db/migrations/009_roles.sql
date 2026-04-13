-- Phase 7: Separate admins table.
--
-- Design decision: admins (Arup) are NOT clients.
-- The clients table is for paying client businesses only.
-- Admin identity is managed in this dedicated table, keyed to the
-- Supabase auth user ID. At most 1-2 admins will ever exist.
--
-- To add yourself as admin after running this migration:
--   insert into admins (id, email)
--   values ('your-supabase-user-id', 'your@email.com');

create table if not exists admins (
    id    uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    created_at timestamptz not null default now()
);

-- Only the admin themselves (via RLS) or the service role can read this.
alter table admins enable row level security;

create policy "Admins can read own row"
    on admins for select
    using (auth.uid() = id);
