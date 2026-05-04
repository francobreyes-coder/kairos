-- Extend the students table with editable profile fields surfaced in the
-- student profile editor (name, birth, bio, gender, phone, photo).
-- Run once. All adds are idempotent.

ALTER TABLE students ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_photo text NOT NULL DEFAULT '';
