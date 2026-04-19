-- Migration 015: Add onboarding_status to clients table
-- Separates pending (self-submitted, not yet provisioned) from active clients

ALTER TABLE clients
  ADD COLUMN onboarding_status text NOT NULL DEFAULT 'active'
  CHECK (onboarding_status IN ('pending', 'active', 'suspended'));

-- Backfill all existing clients as active
UPDATE clients SET onboarding_status = 'active';

-- Index for admin panel filtering by status
CREATE INDEX clients_onboarding_status_idx ON clients (onboarding_status);
