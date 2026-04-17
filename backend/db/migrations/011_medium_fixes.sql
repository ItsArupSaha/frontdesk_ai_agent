-- 011_medium_fixes.sql
-- Per-client missed-call SMS threshold and appointment duration.

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS missed_call_threshold_seconds INT  NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS appointment_duration_minutes  INT  NOT NULL DEFAULT 60;
