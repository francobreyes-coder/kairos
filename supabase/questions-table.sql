-- Question bank for SAT and ACT practice questions
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type text NOT NULL CHECK (exam_type IN ('SAT', 'ACT')),
  subject text NOT NULL,                -- e.g. "Math", "Reading", "Writing", "English", "Science"
  question_type text NOT NULL,          -- e.g. "algebra", "grammar", "main idea", "geometry"
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text text NOT NULL,
  answer_choices jsonb NOT NULL DEFAULT '[]',  -- e.g. [{"label":"A","text":"..."}, ...]
  correct_answer text NOT NULL,                -- e.g. "A" or the correct value
  explanation text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',           -- optional tags for flexible categorization
  time_estimate int,                           -- estimated seconds to solve
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes optimized for filtering + randomization
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_question_type ON questions(question_type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions USING GIN(tags);

-- Composite index for the most common filter pattern
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject_type
  ON questions(exam_type, subject, question_type);

-- Prevent exact duplicate questions
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_no_duplicates
  ON questions(exam_type, subject, question_type, md5(question_text));
