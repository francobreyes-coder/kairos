-- Migration: add price and payment_status columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
