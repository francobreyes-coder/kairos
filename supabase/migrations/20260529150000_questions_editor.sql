-- Editor support for the question bank admin tool.
--
-- 1) Drop the difficulty CHECK so the admin can rename labels in-place
--    (e.g. easy → "Foundations") without first running DDL. The label is
--    still required (NOT NULL) and is the source of truth — no lookup table.
--
-- 2) Add data_table jsonb for a per-question structured table. Shape:
--      { "caption": "...", "headers": ["x","y"], "rows": [["1","2"], ...] }
--    Null when the question has no data table.

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_difficulty_check;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS data_table jsonb;
