-- Migration: create messages table for student-tutor messaging
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  session_id uuid REFERENCES sessions(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups of conversations between two users
CREATE INDEX IF NOT EXISTS idx_messages_participants
  ON messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- Index for session-linked messages
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id) WHERE session_id IS NOT NULL;
