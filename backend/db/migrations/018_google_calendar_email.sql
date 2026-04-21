-- Migration 018: store connected Google account email per client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;
