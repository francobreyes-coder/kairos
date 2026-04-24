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

export async function createVideoRoom(sessionId: string, scheduledDate: string, timeSlot: string): Promise<CreateRoomResult> {
  const roomName = `session-${sessionId}`

  // Parse scheduled end time (session + 1.5 hours buffer)
  const expiry = computeRoomExpiry(scheduledDate, timeSlot)

  const res = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'private', // requires token to join
      properties: {
        exp: expiry,
        enable_chat: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
        max_participants: 2,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    // If room already exists, return the existing URL
    if (res.status === 400 && err.includes('already exists')) {
      return {
        roomName,
        roomUrl: `https://${getDomain()}.daily.co/${roomName}`,
      }
    }
    throw new Error(`Daily.co room creation failed: ${res.status} ${err}`)
  }

  const room = await res.json()
  return {
    roomName: room.name,
    roomUrl: room.url,
  }
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Compute Unix timestamp 1.5 hours after the session start */
function computeRoomExpiry(scheduledDate: string, timeSlot: string): number {
  // timeSlot format: "10:00 AM", "1:00 PM", etc.
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) {
    // Fallback: expire in 3 hours from now
    return Math.floor(Date.now() / 1000) + 10800
  }

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()

  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  const dt = new Date(`${scheduledDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  // Add 1.5 hours buffer after session start
  dt.setMinutes(dt.getMinutes() + 90)

  return Math.floor(dt.getTime() / 1000)
}
