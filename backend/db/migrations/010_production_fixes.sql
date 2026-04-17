-- 010_production_fixes.sql
-- Adds per-client timezone, bot_name, AI toggle, and main phone number.
-- Adds sms_optouts table for TCPA STOP compliance.

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS timezone          TEXT    NOT NULL DEFAULT 'America/New_York',
    ADD COLUMN IF NOT EXISTS bot_name          TEXT    NOT NULL DEFAULT 'Alex',
    ADD COLUMN IF NOT EXISTS is_ai_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS main_phone_number TEXT;

CREATE TABLE IF NOT EXISTS sms_optouts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT        NOT NULL,
    client_id    UUID        REFERENCES clients(id) ON DELETE CASCADE,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (phone_number, client_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_optouts_phone ON sms_optouts (phone_number);
