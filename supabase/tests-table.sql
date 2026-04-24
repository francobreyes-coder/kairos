-- Custom tests created by tutors
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id text NOT NULL,                -- tutor's email or user ID
  name text NOT NULL,
  exam_type text NOT NULL CHECK (exam_type IN ('SAT', 'ACT')),
  filters jsonb NOT NULL DEFAULT '{}',   -- saved filter criteria for regeneration
  question_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_tutor_id ON tests(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tests_exam_type ON tests(exam_type);

-- Junction table linking tests to their questions (ordered)
CREATE TABLE IF NOT EXISTS test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  UNIQUE(test_id, question_id),
  UNIQUE(test_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_question_id ON test_questions(question_id);
