-- Migration: Stripe Connect (Express) — tutors are paid out via their own
-- connected account; Kairos charges a platform fee on each transaction.

-- Tutor's connected Stripe Express account id (acct_...). Null until the
-- tutor starts the Connect onboarding flow.
ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Stripe identifiers we keep around so we can refund correctly. The PI is
-- needed to issue the refund; storing the original fee makes accounting
-- self-contained.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_application_fee_amount integer;
