-- Add figures column to questions table.
-- Each entry: { url: string, caption: string }
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS figures jsonb NOT NULL DEFAULT '[]';

-- Storage bucket for question figure crops.
-- Run once in the Supabase SQL editor (or set up via the dashboard).
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-figures', 'question-figures', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
DROP POLICY IF EXISTS "question-figures public read" ON storage.objects;
CREATE POLICY "question-figures public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-figures');

-- Service-role write (extraction script uses service key — already privileged,
-- but make the policy explicit so future anon usage still requires auth.)
DROP POLICY IF EXISTS "question-figures service write" ON storage.objects;
CREATE POLICY "question-figures service write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'question-figures');
