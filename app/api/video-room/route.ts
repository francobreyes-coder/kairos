import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { createMeetingToken, createVideoRoom } from '@/lib/daily'
import { getUserCandidateIds } from '@/lib/user-candidates'

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

  // Access control: only assigned tutor or student. Match against every
  // id that resolves to this user, since the saved tutor_id may be a
  // different users.id than the current signin (identity drift).
  const candidateIds = await getUserCandidateIds({
    id: userId,
    email: authSession.user.email,
  })
  const candidateSet = new Set(candidateIds)
  if (!candidateSet.has(session.student_id) && !candidateSet.has(session.tutor_id)) {
    return NextResponse.json({ error: 'Not authorized for this session' }, { status: 403 })
  }

  if (session.status === 'cancelled') {
    return NextResponse.json({ error: 'Session is cancelled' }, { status: 400 })
  }

  // Always run room create-or-update so existing rooms pick up our current
  // config (e.g. enable_prejoin_ui: false, refreshed expiry). createVideoRoom
  // is idempotent — if the room exists, it patches its properties instead
  // of erroring. This heals rooms that were created before later fixes
  // landed without requiring a database migration or manual cleanup.
  let roomName: string
  let roomUrl: string
  try {
    const result = await createVideoRoom(
      session.id,
      session.scheduled_date,
      session.time_slot,
    )
    roomName = result.roomName
    roomUrl = result.roomUrl
  } catch (e) {
    console.error('Video room create/update failed:', e)
    if (session.video_room_name) {
      // Fallback: at least let the user try the existing room.
      roomName = session.video_room_name as string
      roomUrl = session.video_room_url as string
    } else {
      return NextResponse.json(
        { error: 'No video room for this session' },
        { status: 500 },
      )
    }
  }

  if (session.video_room_name !== roomName || session.video_room_url !== roomUrl) {
    await supabase
      .from('sessions')
      .update({ video_room_name: roomName, video_room_url: roomUrl })
      .eq('id', session.id)
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
    roomName,
    userId,
    userName,
  })

  return NextResponse.json({
    token,
    roomUrl,
    roomName,
  })
}
