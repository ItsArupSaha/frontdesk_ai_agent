-- Migration 006: SMS automation — reminders_queue table + google_review_link on clients

-- Add Google review link to clients table (used for post-job review request SMS)
alter table clients add column if not exists google_review_link text;

-- Reminders queue: holds scheduled SMS jobs for reminders, review requests, and missed-call recovery
create table if not exists reminders_queue (
  id             uuid         primary key default gen_random_uuid(),
  client_id      uuid         not null references clients(id),
  booking_id     uuid         references bookings(id),
  type           text         not null check (type in ('reminder', 'review_request', 'missed_call_recovery')),
  to_number      text         not null,
  scheduled_for  timestamptz  not null,
  sent           boolean      not null default false,
  sent_at        timestamptz,
  message_body   text         not null,
  created_at     timestamptz  not null default now()
);

-- Partial index — only unsent rows need to be scanned by the scheduler
create index if not exists reminders_queue_scheduled_for_idx
  on reminders_queue(scheduled_for)
  where sent = false;
