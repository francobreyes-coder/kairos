-- Free 30-minute consultation offered by tutors. The duration column is
-- stored even though the UI fixes it at 30 today, so we can lift the limit
-- per tutor later without another migration.
alter table tutor_profiles
  add column if not exists offers_free_consultation boolean not null default false,
  add column if not exists consultation_duration_minutes integer not null default 30;

-- Distinguish free consultations from paid sessions on the sessions table.
-- Paid bookings stay the default so historical rows don't need a backfill.
alter table sessions
  add column if not exists session_type text not null default 'paid';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_session_type_chk'
  ) then
    alter table sessions
      add constraint sessions_session_type_chk
      check (session_type in ('paid', 'consultation'));
  end if;
end$$;

-- Enforce "one free consultation per student-tutor pair (lifetime)" at the
-- DB level so a race between two simultaneous booking attempts can't slip
-- past the application check. Cancelled consults don't count, so a student
-- whose consult fell through can request again.
create unique index if not exists idx_sessions_one_consult_per_pair
  on sessions(student_id, tutor_id)
  where session_type = 'consultation' and status <> 'cancelled';
