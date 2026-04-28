-- Passages table — passages become first-class entities, decoupled from
-- the per-question text extraction. Questions reference one or more
-- passages via passage_ids (multiple for "Passage A vs B" questions).

CREATE TABLE IF NOT EXISTS passages (
  id              text PRIMARY KEY,         -- stable kebab-case id from extractor
                                            -- e.g. 'act-test-prep-2-eng-3-musical-detour'
  exam_type       text NOT NULL,            -- 'ACT' | 'SAT'
  subject         text NOT NULL,            -- 'English' | 'Math' | 'Reading' | 'Science' | 'Writing' | 'Reading and Writing'
  title           text,                     -- as printed; may be null for untitled passages
  passage_number  int,                      -- 3 for "Passage III"; null if no number
  kind            text NOT NULL DEFAULT 'single',  -- 'single' | 'paired-A' | 'paired-B'
  body            text NOT NULL,            -- full passage text with ^N line markers
  figures         jsonb NOT NULL DEFAULT '[]',  -- [{ url, caption }]
  source_pdf      text,                     -- 'ACT-Test-Prep-ACT-Practice-Test-2-Form.pdf'
  source_pages    int4range,                -- [12, 17)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passages_exam_subject_idx ON passages (exam_type, subject);

-- Question changes: drop the legacy passage_group, add passage_ids array
-- + question_number + context_lines for line-numbered Reading questions.
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS passage_ids     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS question_number int,
  ADD COLUMN IF NOT EXISTS context_lines   int[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS questions_passage_ids_idx ON questions USING gin (passage_ids);

-- passage_group is now redundant — kept temporarily for backwards compat
-- during cutover. Drop after the renderer switches to passage_ids:
--   ALTER TABLE questions DROP COLUMN passage_group;
