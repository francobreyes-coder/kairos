import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { createMeetingToken } from '@/lib/daily'

/**
 * GET /api/video-room?sessionId=<uuid>
 *
 * Returns a Daily.co meeting token for the authenticated user,
 * but ONLY if they are the student or tutor assigned to the session.
 */
export async function GET(req: NextRequest) {
  const authSession = await auth()
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const supabase = getSupabase()
  const userId = authSession.user.id

  // Fetch the session and verify the user is a participant
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id, video_room_name, video_room_url, scheduled_date, time_slot, status')
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Access control: only assigned tutor or student
  if (session.student_id !== userId && session.tutor_id !== userId) {
    return NextResponse.json({ error: 'Not authorized for this session' }, { status: 403 })
  }

  if (session.status === 'cancelled') {
    return NextResponse.json({ error: 'Session is cancelled' }, { status: 400 })
  }

  if (!session.video_room_name) {
    return NextResponse.json({ error: 'No video room for this session' }, { status: 404 })
  }

  // Resolve the user's display name
  const { data: userData } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  // Check tutor_applications for a better name
  const { data: tutorApp } = await supabase
    .from('tutor_applications')
    .select('name')
    .eq('user_id', userId)
    .eq('application_status', 'approved')
    .single()

  const userName = tutorApp?.name ?? userData?.name ?? 'Participant'

  // Generate a scoped meeting token
  const token = await createMeetingToken({
    roomName: session.video_room_name,
    userId,
    userName,
  })

  return NextResponse.json({
    token,
    roomUrl: session.video_room_url,
    roomName: session.video_room_name,
  })
}
