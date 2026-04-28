-- Section-aware tests: each test_question is tagged with the section it
-- belongs to so the viewer can render section headers. Default 0 means
-- "single section" — keeps existing tests rendering unchanged.

ALTER TABLE test_questions
  ADD COLUMN IF NOT EXISTS section_index int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_test_questions_section_index
  ON test_questions(test_id, section_index);
