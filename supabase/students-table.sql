-- Add 'role' column to existing users table (run once)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'high_school';

-- Students table for onboarding data
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  grade text NOT NULL DEFAULT '',
  interests text[] NOT NULL DEFAULT '{}',
  intended_major text NOT NULL DEFAULT '',
  colleges_of_interest text[] NOT NULL DEFAULT '{}',
  goals text[] NOT NULL DEFAULT '{}',
  preferred_teaching_style text NOT NULL DEFAULT '',
  tutor_personality text[] NOT NULL DEFAULT '{}',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
