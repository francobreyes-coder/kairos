-- Subcategory ("topic") for the question bank.
--
-- The existing `question_type` already maps cleanly to the top-level SAT Math
-- categories (Algebra / Advanced math / Problem solving and data analysis /
-- Geometry and trigonometry). We add a nullable `topic` column for the
-- second level of the taxonomy (linear equations, ratios, …), and normalize
-- the four SAT Math question_type labels to title-cased form so the admin
-- filters render consistently.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS topic text;

CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- Normalize SAT Math category labels in place. Idempotent — re-running is a
-- no-op once the rows are already title-cased.
UPDATE questions SET question_type = 'Algebra'
  WHERE exam_type = 'SAT' AND subject = 'Math' AND question_type = 'algebra';

UPDATE questions SET question_type = 'Advanced math'
  WHERE exam_type = 'SAT' AND subject = 'Math' AND question_type = 'advanced math';

UPDATE questions SET question_type = 'Problem solving and data analysis'
  WHERE exam_type = 'SAT' AND subject = 'Math' AND question_type = 'problem solving and data analysis';

UPDATE questions SET question_type = 'Geometry and trigonometry'
  WHERE exam_type = 'SAT' AND subject = 'Math' AND question_type = 'geometry and trigonometry';
