-- Sessions table for student-tutor bookings
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tutor_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week text NOT NULL,          -- e.g. "Monday"
  time_slot text NOT NULL,            -- e.g. "10:00 AM"
  scheduled_date date NOT NULL,       -- the actual calendar date
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  price numeric(10,2) DEFAULT 0,       -- session price in dollars
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor ON sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(scheduled_date);

-- Prevent double-booking: a tutor can only have one confirmed session per date + time slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_no_double_book
  ON sessions(tutor_id, scheduled_date, time_slot)
  WHERE status = 'confirmed';
