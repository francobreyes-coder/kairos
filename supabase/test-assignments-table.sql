-- Migration: assignments linking a test to a student. A student can only
-- take a practice test if a tutor has assigned it to them.
CREATE TABLE IF NOT EXISTS test_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  tutor_id text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_test_assignments_student ON test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_test_assignments_test ON test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_test_assignments_tutor ON test_assignments(tutor_id);
