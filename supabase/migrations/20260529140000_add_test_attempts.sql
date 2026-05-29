-- Persist every completed practice-test submission. One row per (student,
-- test, attempt). Retakes append; we don't overwrite.
--
-- answers is keyed by question_id → student's response string. Stored as
-- jsonb so the review page can render correct/wrong per question without
-- a join against test_questions. Score / total are denormalized so
-- dashboards don't have to recompute per-row at list time.

create table if not exists test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  student_id text not null,
  tutor_id text not null,
  answers jsonb not null default '{}'::jsonb,
  correct_count int not null default 0,
  total_count int not null default 0,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_test_attempts_student
  on test_attempts(student_id, submitted_at desc);
create index if not exists idx_test_attempts_test
  on test_attempts(test_id, submitted_at desc);
create index if not exists idx_test_attempts_tutor
  on test_attempts(tutor_id, submitted_at desc);
