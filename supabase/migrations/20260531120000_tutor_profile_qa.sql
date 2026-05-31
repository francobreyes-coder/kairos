-- Optional "Get to know me" Q&A list on the tutor profile. Tutors can pick
-- from suggested questions during onboarding/profile editing or write their
-- own. Stored as an ordered array of {question, answer} so order is preserved
-- and we don't have to manage a separate child table for what is effectively
-- a small list owned by a single tutor.

alter table tutor_profiles
  add column if not exists qa jsonb not null default '[]'::jsonb;
