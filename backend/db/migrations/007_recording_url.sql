-- Migration 007: Add recording_url to call_logs
-- Vapi can return a recording URL after the call ends.
-- Nullable — older calls and calls with recording disabled will have NULL.

alter table call_logs
  add column if not exists recording_url text;
