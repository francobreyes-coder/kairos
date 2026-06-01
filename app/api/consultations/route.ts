import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { createVideoRoom } from '@/lib/daily'
import { sendBookingConfirmationEmail } from '@/lib/email'
import {
  DEFAULT_TIMEZONE,
  formatSessionDateTime,
} from '@/lib/timezone'

// POST /api/consultations — book a free 30-minute consultation. Mirrors the
// availability/double-booking checks in /api/checkout but skips Stripe and
// caps usage at one per student-tutor pair (also enforced by a partial
// unique index on sessions so concurrent attempts can't both land).
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tutors browse /find-tutors but don't book — same rule as checkout.
  const viewerRole = (session.user as { role?: string | null }).role ?? null
  if (viewerRole === 'college') {
    return NextResponse.json(
      { error: "Tutors can't book consultations." },
      { status: 403 },
    )
  }

  const body = await req.json()
  const { tutorId, dayOfWeek, timeSlot, scheduledDate, notes } = body
  if (!tutorId || !dayOfWeek || !timeSlot || !scheduledDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (tutorId === session.user.id) {
    return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('availability, offers_free_consultation, timezone')
    .eq('user_id', tutorId)
    .eq('profile_completed', true)
    .single()

  if (!tutor) {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })
  }
  if (!tutor.offers_free_consultation) {
    return NextResponse.json(
      { error: "This tutor doesn't offer free consultations." },
      { status: 400 },
    )
  }

  const tutorAvailability = tutor.availability as Record<string, string[]>
  const daySlots = tutorAvailability?.[dayOfWeek] ?? []
  if (!daySlots.includes(timeSlot)) {
    return NextResponse.json({ error: 'Tutor is not available at this time' }, { status: 400 })
  }

  // Resolve tutor user id — profiles can drift from users when the tutor
  // signed in with a different account than they applied with. sessions.tutor_id
  // FKs users(id), so insert under whatever users row actually exists.
  let resolvedTutorId = tutorId
  const { data: tutorUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', tutorId)
    .single()
  if (!tutorUser) {
    const { data: appsByUserId } = await supabase
      .from('tutor_applications')
      .select('email')
      .eq('user_id', tutorId)
    const resolvedEmail = appsByUserId?.find((a) => !!a.email)?.email ?? null
    if (resolvedEmail) {
      const { data: usersByEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', resolvedEmail)
      const fromUsers = usersByEmail?.[0]?.id ?? null
      if (fromUsers) resolvedTutorId = fromUsers
    }
    if (resolvedTutorId === tutorId) {
      return NextResponse.json(
        { error: "This tutor isn't available right now" },
        { status: 400 },
      )
    }
  }
  if (resolvedTutorId === session.user.id) {
    return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 })
  }

  // App-level cap check — the partial unique index is the source of truth,
  // but checking here lets us return a friendlier 409 instead of a generic
  // 23505 surfaced from the insert.
  const { data: existingConsult } = await supabase
    .from('sessions')
    .select('id')
    .eq('student_id', session.user.id)
    .eq('tutor_id', resolvedTutorId)
    .eq('session_type', 'consultation')
    .neq('status', 'cancelled')
    .maybeSingle()
  if (existingConsult) {
    return NextResponse.json(
      { error: "You've already booked a free consultation with this tutor." },
      { status: 409 },
    )
  }

  // Double-booking on the slot itself.
  const { data: conflict } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutor_id', resolvedTutorId)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .maybeSingle()
  if (conflict) {
    return NextResponse.json({ error: 'This time slot is already booked' }, { status: 409 })
  }

  const { data: studentConflict } = await supabase
    .from('sessions')
    .select('id')
    .eq('student_id', session.user.id)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .maybeSingle()
  if (studentConflict) {
    return NextResponse.json({ error: 'You already have a session at this time' }, { status: 409 })
  }

  const sessionTimezone = (tutor.timezone as string | null) || DEFAULT_TIMEZONE

  const { data: inserted, error: insertErr } = await supabase
    .from('sessions')
    .insert({
      student_id: session.user.id,
      tutor_id: resolvedTutorId,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      scheduled_date: scheduledDate,
      notes: typeof notes === 'string' ? notes : '',
      status: 'confirmed',
      session_type: 'consultation',
      price: 0,
      payment_status: 'paid',
      timezone: sessionTimezone,
    })
    .select()
    .single()

  if (insertErr) {
    // 23505 covers both the per-pair consult cap and the no-double-book index.
    if ((insertErr as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: "Couldn't book — this slot or consultation is no longer available." },
        { status: 409 },
      )
    }
    console.error('Failed to insert consultation:', insertErr)
    return NextResponse.json({ error: 'Failed to book consultation' }, { status: 500 })
  }

  const sessionId = inserted.id

  // Best-effort video room + confirmation email, same as paid bookings.
  try {
    const { roomName, roomUrl } = await createVideoRoom(
      sessionId,
      scheduledDate,
      timeSlot,
      sessionTimezone,
    )
    await supabase
      .from('sessions')
      .update({ video_room_name: roomName, video_room_url: roomUrl })
      .eq('id', sessionId)
  } catch (e) {
    console.error('Failed to create consultation video room:', e)
  }

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
    const studentName = student?.name?.split(' ')[0] || 'there'
    const formattedWhen = formatSessionDateTime(
      scheduledDate,
      timeSlot,
      sessionTimezone,
      sessionTimezone,
      { dateStyle: 'full', includeTimezone: true },
    )
    if (student?.email) {
      await sendBookingConfirmationEmail(
        student.email,
        studentName,
        tutorName,
        formattedWhen,
      )
    }
  } catch (e) {
    console.error('Failed to send consultation confirmation email:', e)
  }

  return NextResponse.json({ ok: true, sessionId })
}
