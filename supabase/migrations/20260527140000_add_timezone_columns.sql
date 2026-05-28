-- Anchor availability slots and booked sessions to an IANA timezone so they
-- can be displayed in any viewer's local time. Both columns are nullable:
-- code falls back to America/New_York when null, which matches the implicit
-- behavior before this migration.

alter table tutor_profiles
  add column if not exists timezone text;

alter table sessions
  add column if not exists timezone text;
