/**
 * Daily.co video room utilities — server-side only.
 *
 * Requires env vars:
 *   DAILY_API_KEY   — REST API key from https://dashboard.daily.co/developers
 *   DAILY_DOMAIN    — your Daily domain, e.g. "kairos" (without .daily.co)
 */

const DAILY_API = 'https://api.daily.co/v1'

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY
  if (!key) throw new Error('Missing DAILY_API_KEY env var')
  return key
}

function getDomain(): string {
  const domain = process.env.DAILY_DOMAIN
  if (!domain) throw new Error('Missing DAILY_DOMAIN env var')
  return domain
}

/* ------------------------------------------------------------------ */
/*  Create a private room for a session                                */
/* ------------------------------------------------------------------ */

interface CreateRoomResult {
  roomName: string
  roomUrl: string
}

export async function createVideoRoom(
  sessionId: string,
  scheduledDate: string,
  timeSlot: string,
): Promise<CreateRoomResult> {
  const roomName = `session-${sessionId}`
  const expiry = computeRoomExpiry(scheduledDate, timeSlot)

  // Properties we want every session room to have. Re-applied to existing
  // rooms so older rooms (created before enable_prejoin_ui was added, or
  // with a stale `exp`, or with media-on defaults) get healed on the next
  // join.
  const properties = {
    exp: expiry,
    enable_chat: true,
    enable_knocking: false,
    // Skip Daily's prejoin device-check screen.
    enable_prejoin_ui: false,
    // Acquire NO media at join time. With either of these false, Daily
    // calls getUserMedia for that track, which can fail with "another
    // application is using it" if the browser is holding the device from
    // a prior tab/session — and that error path doesn't always surface
    // through the SDK's error event. Joining muted bypasses media access
    // entirely; the user toggles mic/camera from the in-call controls.
    start_video_off: true,
    start_audio_off: true,
    max_participants: 2,
  }

  const headers = { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' }
  const updateUrl = `${DAILY_API}/rooms/${encodeURIComponent(roomName)}`

  // Try update first — if the room exists this guarantees our latest
  // config is applied. If it doesn't, fall back to create.
  const updateRes = await fetch(updateUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ privacy: 'private', properties }),
  })

  if (updateRes.ok) {
    return {
      roomName,
      roomUrl: `https://${getDomain()}.daily.co/${roomName}`,
    }
  }

  if (updateRes.status !== 404) {
    const err = await updateRes.text()
    console.error(`Daily.co room update failed: ${updateRes.status} ${err}`)
    // Fall through to create — sometimes Daily returns non-404 for rooms
    // it doesn't know about, and creating is harmless if the room is gone.
  }

  const createRes = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: roomName, privacy: 'private', properties }),
  })

  if (createRes.ok) {
    const room = await createRes.json()
    return { roomName: room.name, roomUrl: room.url }
  }

  const errText = await createRes.text()
  // Race: another request created the room between our update-404 and
  // create attempts. Treat as success.
  if (createRes.status === 400 && errText.includes('already exists')) {
    return {
      roomName,
      roomUrl: `https://${getDomain()}.daily.co/${roomName}`,
    }
  }

  throw new Error(`Daily.co room creation failed: ${createRes.status} ${errText}`)
}

/**
 * Fetch a room's current configuration from Daily.co. Returns null if the
 * room doesn't exist. Used by the debug endpoint to verify our healing
 * actually applied the latest properties.
 */
export async function getVideoRoom(roomName: string): Promise<unknown | null> {
  const res = await fetch(`${DAILY_API}/rooms/${encodeURIComponent(roomName)}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Daily.co get-room failed: ${res.status} ${err}`)
  }
  return await res.json()
}

/* ------------------------------------------------------------------ */
/*  Generate a meeting token for a specific user                       */
/* ------------------------------------------------------------------ */

interface CreateTokenParams {
  roomName: string
  userId: string
  userName: string
  /** Token lifetime in seconds (default: 2 hours) */
  expiresInSec?: number
}

export async function createMeetingToken({ roomName, userId, userName, expiresInSec = 7200 }: CreateTokenParams): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec

  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: userId,
        exp,
        is_owner: false,
        enable_screenshare: true,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Daily.co token creation failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.token as string
}

/* ------------------------------------------------------------------ */
/*  Active room presence                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns the set of Daily.co room names currently containing at least one
 * participant. Used to surface a Join button to the counterpart when the
 * tutor is already in a meeting, regardless of the scheduled time window.
 *
 * Daily.co's `/v1/presence` returns either:
 *   { total_count, data: [{ room, userName, ... }, ...] }    // array of participants
 *   { total_count, data: { "<room>": [participants], ... } } // map keyed by room
 * Handle both so we don't break if the API shape varies.
 */
export async function listActiveRoomNames(): Promise<Set<string>> {
  const res = await fetch(`${DAILY_API}/presence`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Daily.co presence failed: ${res.status} ${err}`)
  }
  const body = (await res.json()) as { data?: unknown }
  const out = new Set<string>()
  const data = body.data

  if (Array.isArray(data)) {
    for (const entry of data) {
      const room = (entry as { room?: unknown })?.room
      if (typeof room === 'string' && room.length > 0) out.add(room)
    }
  } else if (data && typeof data === 'object') {
    for (const [room, participants] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (Array.isArray(participants) && participants.length > 0) out.add(room)
    }
  }

  return out
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Compute Unix timestamp for the Daily.co room's `exp` (auto-delete time).
 *
 * scheduledDate + timeSlot have no timezone — they're stored as plain
 * "1:00 PM" against a date — and the server (Vercel) runs in UTC, while
 * the tutor and student are in their own local zones. Naively parsing the
 * timestamp as local time on a UTC server can produce a past `exp` for
 * same-day afternoon bookings west of UTC, which makes Daily.co reject
 * the room and leaves the session with no video link.
 *
 * Guard against that by always returning at least now + MIN_LIFETIME_SEC,
 * regardless of what the parsed timestamp says.
 */
function computeRoomExpiry(scheduledDate: string, timeSlot: string): number {
  const MIN_LIFETIME_SEC = 6 * 60 * 60 // 6 hours from creation, minimum
  const now = Math.floor(Date.now() / 1000)
  const floor = now + MIN_LIFETIME_SEC

  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return floor

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  const dt = new Date(
    `${scheduledDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
  )
  // 1.5h buffer after session start (assumed local-ish, may be off by tz).
  dt.setMinutes(dt.getMinutes() + 90)
  const scheduled = Math.floor(dt.getTime() / 1000)

  return Math.max(scheduled, floor)
}
