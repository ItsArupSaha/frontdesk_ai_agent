-- Migration 014: Add vapi_phone_number column to clients table.
--
-- Separates the AI calling number (Vapi-native) from the SMS number (Twilio).
-- vapi_phone_number = the number clients forward their business line to (voice AI)
-- twilio_phone_number = used internally for outbound SMS only
--
-- Run once against your Supabase database.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT;
