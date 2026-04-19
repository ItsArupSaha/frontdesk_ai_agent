-- Migration 017: Index for missed-call recovery deduplication lookup
-- Supports the 24-hour per-phone dedup check in vapi_webhook.py

CREATE INDEX IF NOT EXISTS reminders_queue_recovery_dedup_idx
  ON reminders_queue (client_id, type, to_number, created_at)
  WHERE type = 'missed_call_recovery';
