import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { createVideoRoom } from '@/lib/daily'
import { getUserCandidateIds } from '@/lib/user-candidates'

/**
 * GET /api/sessions/heal-rooms
 *
 * Force-heal every Daily.co room for the user's confirmed sessions.
 * Each room gets create-or-updated with the current canonical
 * properties (enable_prejoin_ui: false, start_video_off/audio_off
 * true, refreshed exp). Returns a per-session report so we can verify
 * the healing landed.
 *
 * Used as a manual recovery hook when /api/video-room hasn't run for a
 * session in a while (e.g. tutor never got past the camera error) and
 * the room has been deleted by Daily's exp pruning or has stale config.
 */
export async function GET() {
  const authSession = await auth()
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authSession.user.id
  const supabase = getSupabase()

  const candidateIds = await getUserCandidateIds({
    id: userId,
    email: authSession.user.email,
  })
  const idList = candidateIds.join(',')

  const { data: rows, error } = await supabase
    .from('sessions')
    .select('id, scheduled_date, time_slot, timezone, video_room_name, video_room_url')
    .eq('status', 'confirmed')
    .or(`student_id.in.(${idList}),tutor_id.in.(${idList})`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{
    sessionId: string
    roomName?: string
    healed: boolean
    error?: string
  }> = []

  for (const r of rows ?? []) {
    try {
      const result = await createVideoRoom(r.id, r.scheduled_date, r.time_slot, r.timezone || 'America/New_York')
      // Persist if changed
      if (
        r.video_room_name !== result.roomName ||
        r.video_room_url !== result.roomUrl
      ) {
        await supabase
          .from('sessions')
          .update({
            video_room_name: result.roomName,
            video_room_url: result.roomUrl,
          })
          .eq('id', r.id)
      }
      results.push({
        sessionId: r.id,
        roomName: result.roomName,
        healed: true,
      })
    } catch (e: any) {
      results.push({
        sessionId: r.id,
        roomName: r.video_room_name ?? undefined,
        healed: false,
        error: e?.message || String(e),
      })
    }
  }

  return NextResponse.json({
    healed: results.filter((r) => r.healed).length,
    failed: results.filter((r) => !r.healed).length,
    results,
  })
}
