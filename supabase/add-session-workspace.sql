-- Collaborative workspace per session: shared notes + uploaded files.
-- One document per session for MVP; schema permits future multi-doc growth.

CREATE TABLE IF NOT EXISTS session_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Notes',
  content     jsonb,
  yjs_state   bytea,
  updated_by  text REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_documents_session
  ON session_documents(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_documents_one_per_session
  ON session_documents(session_id);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uploaded_by  text NOT NULL REFERENCES users(id),
  file_path    text NOT NULL,
  file_url     text NOT NULL,
  file_type    text NOT NULL CHECK (file_type IN ('pdf','image','other')),
  file_name    text NOT NULL,
  size_bytes   bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_session
  ON uploaded_files(session_id);

-- RLS: defense-in-depth. The API still does its own server-side membership
-- check via getUserCandidateIds (identity-drift aware), but RLS prevents
-- accidental leaks if a future code path forgets that check.
ALTER TABLE session_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so the API routes (which use the service-role
-- key) keep working unchanged. Anon clients never touch these tables — they
-- talk to the API for reads/writes and to Realtime broadcast for sync.

-- Storage bucket for session uploads. Reuses the existing private bucket
-- pattern but scopes paths to sessions/{session_id}/.
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-uploads', 'session-uploads', true)
ON CONFLICT (id) DO NOTHING;
