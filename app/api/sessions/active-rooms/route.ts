import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { listActiveRoomNames, getVideoRoom } from '@/lib/daily'

/**
 * GET /api/sessions/active-rooms
 *
 * Returns the IDs of the authenticated user's confirmed sessions whose
 * Daily.co room currently has at least one participant. The student's
 * sessions page polls this so it can surface a Join button as soon as
 * the tutor (or anyone else) joins, regardless of the scheduled time.
 *
 * Append ?debug=1 to surface the intermediate state (rooms checked,
 * active rooms returned by Daily, presence error if any) without
 * leaking it into the normal response shape.
 */
export async function GET(req: NextRequest) {
  const authSession = await auth()
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const userId = authSession.user.id
  const supabase = getSupabase()

  const { data: rows, error } = await supabase
    .from('sessions')
    .select('id, video_room_name, student_id, tutor_id, status')
    .eq('status', 'confirmed')
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userSessions = (rows ?? []).filter((r) => r.video_room_name)
  if (userSessions.length === 0) {
    return NextResponse.json(
      debug
        ? {
            activeIds: [],
            debug: {
              userId,
              totalSessions: rows?.length ?? 0,
              sessionsWithRoom: 0,
              note: 'No confirmed session has a video_room_name yet',
            },
          }
        : { activeIds: [] },
    )
  }

  let active: Set<string>
  let presenceError: string | undefined
  try {
    active = await listActiveRoomNames()
  } catch (e: any) {
    console.error('Failed to fetch Daily.co presence:', e)
    presenceError = e?.message || String(e)
    active = new Set()
  }

  const activeIds = userSessions
    .filter((r) => active.has(r.video_room_name as string))
    .map((r) => r.id)

  if (debug) {
    // Look up actual room config on Daily for each of the user's rooms,
    // so we can confirm our healing has applied (e.g. start_video_off).
    const roomConfigs: Record<string, unknown> = {}
    for (const r of userSessions) {
      const name = r.video_room_name as string
      try {
        const cfg = await getVideoRoom(name)
        roomConfigs[name] = cfg
          ? { exists: true, config: (cfg as { config?: unknown }).config ?? cfg }
          : { exists: false }
      } catch (e: any) {
        roomConfigs[name] = { error: e?.message || String(e) }
      }
    }

    return NextResponse.json({
      activeIds,
      debug: {
        userId,
        totalSessions: rows?.length ?? 0,
        sessionsWithRoom: userSessions.length,
        userRoomNames: userSessions.map((r) => r.video_room_name),
        activeRoomsFromDaily: Array.from(active),
        presenceError,
        roomConfigs,
      },
    })
  }

  return NextResponse.json({ activeIds })
}
