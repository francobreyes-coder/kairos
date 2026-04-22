import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { sendBookingConfirmationEmail } from '@/lib/email'

// GET /api/sessions — fetch user's sessions (as student or tutor)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const userId = session.user.id

  // Fetch sessions where user is student OR tutor
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)
    .order('scheduled_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  // Gather all user IDs we need names for
  const userIds = new Set<string>()
  for (const s of sessions ?? []) {
    userIds.add(s.student_id)
    userIds.add(s.tutor_id)
  }

  const nameMap = new Map<string, string>()
  if (userIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(userIds))

    if (users) {
      for (const u of users) {
        nameMap.set(u.id, u.name ?? 'Unknown')
      }
    }

    // Also check tutor_applications for better names
    const { data: apps } = await supabase
      .from('tutor_applications')
      .select('user_id, name')
      .in('user_id', Array.from(userIds))
      .eq('application_status', 'approved')

    if (apps) {
      for (const a of apps) {
        nameMap.set(a.user_id, a.name)
      }
    }
  }

  const enriched = (sessions ?? []).map((s) => ({
    ...s,
    student_name: nameMap.get(s.student_id) ?? 'Student',
    tutor_name: nameMap.get(s.tutor_id) ?? 'Tutor',
    is_tutor: s.tutor_id === userId,
  }))

  return NextResponse.json({ sessions: enriched })
}

// POST /api/sessions — book a new session
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { tutorId, dayOfWeek, timeSlot, scheduledDate, notes } = body

  if (!tutorId || !dayOfWeek || !timeSlot || !scheduledDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Can't book yourself
  if (tutorId === session.user.id) {
    return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verify the tutor exists and has this availability
  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('availability')
    .eq('user_id', tutorId)
    .eq('profile_completed', true)
    .single()

  if (!tutor) {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })
  }

  const tutorAvailability = tutor.availability as Record<string, string[]>
  const daySlots = tutorAvailability[dayOfWeek] ?? []
  if (!daySlots.includes(timeSlot)) {
    return NextResponse.json({ error: 'Tutor is not available at this time' }, { status: 400 })
  }

  // Check for double booking (the unique index will also catch this, but give a nicer error)
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'This time slot is already booked' }, { status: 409 })
  }

  // Also prevent the student from double-booking themselves at the same time
  const { data: studentConflict } = await supabase
    .from('sessions')
    .select('id')
    .eq('student_id', session.user.id)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .single()

  if (studentConflict) {
    return NextResponse.json({ error: 'You already have a session at this time' }, { status: 409 })
  }

  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({
      student_id: session.user.id,
      tutor_id: tutorId,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      scheduled_date: scheduledDate,
      notes: notes || '',
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json({ error: 'Failed to book session' }, { status: 500 })
  }

  // Send confirmation email to student
  try {
    const { data: student } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', session.user.id)
      .single()

    const { data: tutorApp } = await supabase
      .from('tutor_applications')
      .select('name')
      .eq('user_id', tutorId)
      .eq('application_status', 'approved')
      .single()

    const tutorName = tutorApp?.name ?? 'your tutor'
    const studentEmail = student?.email
    const studentName = student?.name?.split(' ')[0] || 'there'
    const formattedDate = new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    if (studentEmail) {
      await sendBookingConfirmationEmail(studentEmail, studentName, tutorName, formattedDate, timeSlot)
    }
  } catch (e) {
    console.error('Failed to send booking confirmation email:', e)
  }

  return NextResponse.json({ session: newSession }, { status: 201 })
}

// PATCH /api/sessions — cancel a session
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sessionId, status } = body

  if (!sessionId || status !== 'cancelled') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verify the user owns this session
  const { data: existing } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id')
    .eq('id', sessionId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (existing.student_id !== session.user.id && existing.tutor_id !== session.user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { error } = await supabase
    .from('sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
