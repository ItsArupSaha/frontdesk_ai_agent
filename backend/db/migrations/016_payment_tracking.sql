-- Migration 016: Add LemonSqueezy payment/subscription tracking to clients table

ALTER TABLE clients
  ADD COLUMN lemon_squeezy_customer_id text,
  ADD COLUMN lemon_squeezy_subscription_id text,
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'paused', 'past_due', 'cancelled', 'expired')),
  ADD COLUMN subscription_renews_at timestamptz;

-- Index for quick lookup by LS customer/subscription IDs from webhook
CREATE INDEX clients_ls_customer_idx ON clients (lemon_squeezy_customer_id) WHERE lemon_squeezy_customer_id IS NOT NULL;
CREATE INDEX clients_ls_subscription_idx ON clients (lemon_squeezy_subscription_id) WHERE lemon_squeezy_subscription_id IS NOT NULL;
