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
  // rooms so that older rooms (which were created before enable_prejoin_ui
  // was added, or with a stale `exp`) get healed on the next join.
  const properties = {
    exp: expiry,
    enable_chat: true,
    enable_knocking: false,
    // Skip Daily's prejoin device-check screen. With prejoin on, the SDK
    // waits for an in-iframe "Join meeting" click; if that's missed the
    // tutor never actually enters the call and presence stays empty.
    enable_prejoin_ui: false,
    start_video_off: false,
    start_audio_off: false,
    max_participants: 2,
  }

  const auth = { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' }

  const createRes = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: roomName, privacy: 'private', properties }),
  })

  if (createRes.ok) {
    const room = await createRes.json()
    return { roomName: room.name, roomUrl: room.url }
  }

  const errText = await createRes.text()
  // Already exists — update properties so prior rooms pick up our latest
  // config (disable prejoin, extend expiry, etc.).
  if (createRes.status === 400 && errText.includes('already exists')) {
    const updateRes = await fetch(
      `${DAILY_API}/rooms/${encodeURIComponent(roomName)}`,
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ properties }),
      },
    )
    if (!updateRes.ok) {
      const err = await updateRes.text()
      console.error(`Daily.co room update failed: ${updateRes.status} ${err}`)
    }
    return {
      roomName,
      roomUrl: `https://${getDomain()}.daily.co/${roomName}`,
    }
  }

  throw new Error(`Daily.co room creation failed: ${createRes.status} ${errText}`)
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
