-- 013_real_world_additions.sql
-- Provisioning safeguards: SMS gating + admin scratch pad.
--
-- sms_enabled defaults FALSE because US carrier A2P 10DLC registration
-- takes 1-4 weeks.  Voice calls work immediately; admin flips this flag
-- after registration is confirmed.

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT false;

-- Free-text notes for admin to track provisioning progress (A2P status, etc.)
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS provisioning_notes TEXT;
