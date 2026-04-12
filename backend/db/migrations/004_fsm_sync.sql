-- Migration 004: Track FSM (Jobber / Housecall Pro) sync status per booking
-- Run this against your Supabase project SQL editor or via psql.

alter table bookings add column if not exists
  fsm_synced boolean not null default false;

alter table bookings add column if not exists
  fsm_record_id text;

alter table bookings add column if not exists
  fsm_sync_error text;
