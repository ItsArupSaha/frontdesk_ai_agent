-- Bookings table
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  call_id text references call_logs(call_id),
  caller_name text not null,
  caller_phone text not null,
  caller_address text not null,
  problem_description text not null,
  appointment_start timestamptz not null,
  appointment_end timestamptz not null,
  google_event_id text,
  confirmation_sms_sent boolean not null default false,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on bookings(client_id);
create index on bookings(appointment_start);
create index on bookings(status);

-- Add Google Calendar fields to clients table
alter table clients
  add column if not exists google_calendar_refresh_token_enc text,
  add column if not exists google_calendar_id text default 'primary';

-- Add service area code field to clients
alter table clients
  add column if not exists service_area_code text default '718';

-- Add caller_address and progress fields to conversation_state
alter table conversation_state
  add column if not exists caller_address text,
  add column if not exists collection_complete boolean not null default false,
  add column if not exists booking_complete boolean not null default false;
