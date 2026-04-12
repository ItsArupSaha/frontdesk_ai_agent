-- Migration 005: Add FSM (Jobber / Housecall Pro) config columns to clients table
-- Per-client FSM type and API keys, stored in DB (not .env).

alter table clients add column if not exists
  fsm_type text check (fsm_type in ('jobber', 'housecallpro'));

alter table clients add column if not exists
  jobber_api_key text;

alter table clients add column if not exists
  housecall_pro_api_key text;
