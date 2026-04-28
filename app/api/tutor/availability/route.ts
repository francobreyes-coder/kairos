import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

// GET /api/tutor/availability?tutorId=X&week=2026-04-20
// Returns tutor's weekly availability with already-booked slots removed
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tutorId = req.nextUrl.searchParams.get('tutorId')
  const weekStart = req.nextUrl.searchParams.get('week') // ISO date string for the Monday of the week

  if (!tutorId) {
    return NextResponse.json({ error: 'Missing tutorId' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Get tutor's availability template
  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('availability')
    .eq('user_id', tutorId)
    .eq('profile_completed', true)
    .single()

  if (!tutor) {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })
  }

  const availability = tutor.availability as Record<string, string[]>

  // Calculate dates for each day of the selected week
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const monday = weekStart ? new Date(weekStart + 'T00:00:00') : getNextMonday()

  const dayDates: Record<string, string> = {}
  DAYS.forEach((day, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dayDates[day] = d.toISOString().split('T')[0]
  })

  // Get all dates for this week
  const weekDates = Object.values(dayDates)

  // Fetch booked sessions for this tutor in this week
  const { data: booked } = await supabase
    .from('sessions')
    .select('scheduled_date, time_slot')
    .eq('tutor_id', tutorId)
    .eq('status', 'confirmed')
    .in('scheduled_date', weekDates)

  const bookedSet = new Set(
    (booked ?? []).map((b) => `${b.scheduled_date}_${b.time_slot}`)
  )

  // Build available slots per day, excluding past dates and booked slots.
  // For today, also mark slots whose hour has already started as unavailable
  // so the user only sees genuinely-bookable times (e.g. afternoon slots
  // when it's already noon).
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentHour = now.getHours()
  const slots: Record<string, { time: string; date: string; available: boolean }[]> = {}

  for (const day of DAYS) {
    const daySlots = availability[day] ?? []
    if (daySlots.length === 0) continue

    const date = dayDates[day]
    if (date < today) continue // skip past dates

    slots[day] = daySlots.map((time) => {
      const isBooked = bookedSet.has(`${date}_${time}`)
      const slotHour = parseSlotHour(time)
      const isPastToday = date === today && slotHour >= 0 && slotHour <= currentHour
      return {
        time,
        date,
        available: !isBooked && !isPastToday,
      }
    })
  }

  return NextResponse.json({ slots, dayDates })
}

// Parse "8:00 AM" / "1:00 PM" into a 0–23 hour. Returns -1 if unparseable.
function parseSlotHour(s: string): number {
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return -1
  let h = parseInt(m[1], 10)
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h
}

// Returns the Monday of the week containing today (Sun=0..Sat=6).
function getNextMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}
