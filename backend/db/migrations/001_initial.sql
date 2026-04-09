-- clients table
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  emergency_phone_number text not null,
  working_hours jsonb not null default '{}',
  services_offered text[] not null default '{}',
  service_area_description text not null default '',
  vapi_assistant_id text,
  twilio_phone_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- call_logs table
create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  call_id text not null unique,
  caller_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  was_emergency boolean not null default false,
  was_booked boolean not null default false,
  summary text,
  transcript jsonb not null default '[]',
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

-- conversation_state table (ephemeral, cleaned up after call ends)
create table if not exists conversation_state (
  call_id text primary key,
  client_id uuid not null references clients(id),
  current_node text not null default 'GREETING',
  caller_name text,
  caller_phone text,
  problem_description text,
  is_emergency boolean not null default false,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- seed one test client for local development
insert into clients (
  business_name,
  emergency_phone_number,
  working_hours,
  services_offered,
  service_area_description
) values (
  'Test Plumbing Co',
  '+15550000000',
  '{"mon":"8am-6pm","tue":"8am-6pm","wed":"8am-6pm","thu":"8am-6pm","fri":"8am-6pm","sat":"9am-2pm","sun":"closed"}',
  array['plumbing','drain cleaning','water heater repair','emergency plumbing'],
  'Serving Brooklyn, Queens, and Manhattan, New York'
) on conflict do nothing;
