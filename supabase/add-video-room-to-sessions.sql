-- Add video room fields to sessions table for Daily.co integration
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS video_room_name text,
  ADD COLUMN IF NOT EXISTS video_room_url text;
