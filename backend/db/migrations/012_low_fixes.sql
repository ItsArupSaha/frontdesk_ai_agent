-- 012_low_fixes.sql
-- Store Vapi-reported call duration and add KB reingest timestamp.

ALTER TABLE call_logs
    ADD COLUMN IF NOT EXISTS duration_seconds INT;

-- Track when the knowledge base was last re-ingested per client.
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS kb_last_ingested_at TIMESTAMPTZ;
