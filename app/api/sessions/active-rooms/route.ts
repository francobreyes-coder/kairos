import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { listActiveRoomNames } from '@/lib/daily'

/**
 * GET /api/sessions/active-rooms
 *
 * Returns the IDs of the authenticated user's confirmed sessions whose
 * Daily.co room currently has at least one participant. The student's
 * sessions page polls this so it can surface a Join button as soon as
 * the tutor (or anyone else) joins, regardless of the scheduled time.
 */
export async function GET() {
  const authSession = await auth()
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authSession.user.id
  const supabase = getSupabase()

  const { data: rows, error } = await supabase
    .from('sessions')
    .select('id, video_room_name, student_id, tutor_id')
    .eq('status', 'confirmed')
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userSessions = (rows ?? []).filter((r) => r.video_room_name)
  if (userSessions.length === 0) {
    return NextResponse.json({ activeIds: [] })
  }

  let active: Set<string>
  try {
    active = await listActiveRoomNames()
  } catch (e) {
    console.error('Failed to fetch Daily.co presence:', e)
    // Fail closed (no false positives), but don't block the page.
    return NextResponse.json({ activeIds: [] })
  }

  const activeIds = userSessions
    .filter((r) => active.has(r.video_room_name as string))
    .map((r) => r.id)

  return NextResponse.json({ activeIds })
}
