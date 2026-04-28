-- Group questions that share a passage or experiment so they can be selected
-- and displayed together. NULL = standalone question (e.g. SAT/ACT Math).
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS passage_group text;

CREATE INDEX IF NOT EXISTS idx_questions_passage_group
  ON questions(passage_group)
  WHERE passage_group IS NOT NULL;
