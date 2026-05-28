/**
 * Timezone utilities used by both the server (booking, emails, room expiry)
 * and the client (booking modal, sessions page, tutor dashboard).
 *
 * Tutor availability and session times are stored as plain "1:00 PM" /
 * "2026-04-20" strings plus an IANA timezone column (tutor_profiles.timezone
 * for availability, sessions.timezone for booked sessions). To display these
 * to a viewer in their own timezone we:
 *   1. parseSlotTime("1:00 PM") → { hour: 13, minute: 0 }
 *   2. zonedTimeToUtc(date, hour, minute, sourceTz) → real UTC Date
 *   3. format that Date in the viewer's IANA timezone
 *
 * The conversion is pure DST-safe via Intl.DateTimeFormat — no library deps.
 */

export const DEFAULT_TIMEZONE = 'America/New_York'
const VIEWER_TZ_STORAGE_KEY = 'kairos.viewerTz'

/** A small curated list shown in the override dropdown. */
export const COMMON_TIMEZONES: Array<{ id: string; label: string }> = [
  { id: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { id: 'America/Denver', label: 'Mountain — Denver' },
  { id: 'America/Phoenix', label: 'Arizona (no DST)' },
  { id: 'America/Chicago', label: 'Central — Chicago' },
  { id: 'America/New_York', label: 'Eastern — New York' },
  { id: 'America/Toronto', label: 'Eastern — Toronto' },
  { id: 'America/Halifax', label: 'Atlantic' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris / Berlin' },
  { id: 'Europe/Athens', label: 'Athens' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: 'Asia/Kolkata', label: 'India' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Australia/Sydney', label: 'Sydney' },
]

/**
 * Browser timezone. Returns DEFAULT_TIMEZONE outside a browser or when the
 * resolved value is empty.
 */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) return tz
  } catch {
    /* ignore */
  }
  return DEFAULT_TIMEZONE
}

/**
 * Viewer's effective display timezone — localStorage override if set,
 * otherwise the browser's resolved timezone. Server-safe (returns
 * DEFAULT_TIMEZONE).
 */
export function getViewerTimezone(): string {
  if (typeof window === 'undefined') return DEFAULT_TIMEZONE
  try {
    const override = window.localStorage.getItem(VIEWER_TZ_STORAGE_KEY)
    if (override) return override
  } catch {
    /* ignore */
  }
  return getBrowserTimezone()
}

/** Set or clear the viewer's timezone override. Notifies subscribers. */
export function setViewerTimezone(tz: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (tz) window.localStorage.setItem(VIEWER_TZ_STORAGE_KEY, tz)
    else window.localStorage.removeItem(VIEWER_TZ_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  for (const cb of viewerTzListeners) cb()
}

const viewerTzListeners = new Set<() => void>()

/**
 * Subscribe to viewer-timezone changes. Returns an unsubscribe function.
 * Used by the useViewerTimezone hook to keep every page in sync when one
 * selector changes the override.
 */
export function subscribeToViewerTimezone(cb: () => void): () => void {
  viewerTzListeners.add(cb)
  return () => {
    viewerTzListeners.delete(cb)
  }
}

/** Parse "1:00 PM" / "12:30 AM" → { hour: 0–23, minute: 0–59 }. Returns null on bad input. */
export function parseSlotTime(slot: string): { hour: number; minute: number } | null {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return { hour, minute }
}

/** Format hour/minute back into the "1:00 PM" form used everywhere else. */
export function formatSlotTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

/**
 * Offset of `tz` at the given UTC instant, in milliseconds. Positive when
 * `tz` is ahead of UTC. Implemented by formatting the instant's wall-clock
 * components in `tz` and re-interpreting them as if they were UTC.
 */
function getTimezoneOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const lookup: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== 'literal') lookup[p.type] = Number(p.value)
  }
  let hour = lookup.hour ?? 0
  if (hour === 24) hour = 0
  const asIfUtc = Date.UTC(
    lookup.year ?? 1970,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    hour,
    lookup.minute ?? 0,
    lookup.second ?? 0,
  )
  return asIfUtc - instant.getTime()
}

/**
 * Convert a wall-clock date+time in `sourceTz` to a real UTC Date.
 * `dateStr` is "YYYY-MM-DD". DST-safe via a single offset correction.
 */
export function zonedTimeToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  sourceTz: string,
): Date {
  const [yStr, mStr, dStr] = dateStr.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const day = Number(dStr)
  // First guess: treat the wall-clock components as if they were UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  // Then subtract the source-tz offset at that instant to get the real UTC.
  const offset = getTimezoneOffsetMs(guess, sourceTz)
  return new Date(guess.getTime() - offset)
}

/**
 * Convert a (dateStr, "1:00 PM", sourceTz) tuple into how that slot looks in
 * `viewerTz`: returns { date, time, dayOfWeek } as strings.
 *
 * - `date`     — "YYYY-MM-DD" in viewerTz
 * - `time`     — "1:00 PM" in viewerTz
 * - `dayOfWeek`— "Monday" in viewerTz
 *
 * If the slot can't be parsed, returns null.
 */
export interface ZonedSlot {
  date: string
  time: string
  dayOfWeek: string
  utc: Date
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function convertSlotToTimezone(
  dateStr: string,
  slot: string,
  sourceTz: string,
  viewerTz: string,
): ZonedSlot | null {
  const parsed = parseSlotTime(slot)
  if (!parsed) return null
  const utc = zonedTimeToUtc(dateStr, parsed.hour, parsed.minute, sourceTz)

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
  })
  const parts = dtf.formatToParts(utc)
  const lookup: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') lookup[p.type] = p.value
  }
  let h = Number(lookup.hour ?? '0')
  if (h === 24) h = 0
  const m = Number(lookup.minute ?? '0')

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: formatSlotTime(h, m),
    dayOfWeek: lookup.weekday ?? DAY_NAMES[utc.getUTCDay()],
    utc,
  }
}

/**
 * Format a session's wall-clock date+time (stored against sourceTz) for the
 * viewer's timezone. Returns "Mon, Apr 20 · 1:00 PM" by default; pass
 * `opts.dateStyle` to vary the date portion.
 */
export function formatSessionDateTime(
  dateStr: string,
  slot: string,
  sourceTz: string,
  viewerTz: string,
  opts: { dateStyle?: 'short' | 'full'; includeTimezone?: boolean } = {},
): string {
  const parsed = parseSlotTime(slot)
  if (!parsed) return `${dateStr} ${slot}`
  const utc = zonedTimeToUtc(dateStr, parsed.hour, parsed.minute, sourceTz)
  const dateOpts: Intl.DateTimeFormatOptions =
    opts.dateStyle === 'full'
      ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' }
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    ...dateOpts,
  }).format(utc)
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(utc)
  const base = `${datePart} · ${timePart}`
  if (!opts.includeTimezone) return base
  return `${base} ${getTimezoneAbbreviation(viewerTz, utc)}`
}

/** Short tz abbreviation ("EDT", "PST") for an instant in a tz. Falls back to ID. */
export function getTimezoneAbbreviation(tz: string, instant: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(instant)
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    if (name) return name
  } catch {
    /* ignore */
  }
  return tz
}

/** "America/New_York" → "New York"; falls back to the raw ID. */
export function shortTimezoneLabel(tz: string): string {
  const tail = tz.split('/').pop() ?? tz
  return tail.replace(/_/g, ' ')
}

/**
 * Returns true when `now` is within the early-join → end window for a
 * session whose wall clock is (dateStr, slot, sourceTz). Defaults: open
 * the door 10 minutes early, close it 60 minutes after start.
 */
export function isWithinSessionWindow(
  dateStr: string,
  slot: string,
  sourceTz: string,
  opts: { earlyJoinMin?: number; durationMin?: number; now?: Date } = {},
): boolean {
  const parsed = parseSlotTime(slot)
  if (!parsed) return false
  const earlyJoinMin = opts.earlyJoinMin ?? 10
  const durationMin = opts.durationMin ?? 60
  const start = zonedTimeToUtc(dateStr, parsed.hour, parsed.minute, sourceTz)
  const open = new Date(start.getTime() - earlyJoinMin * 60 * 1000)
  const close = new Date(start.getTime() + durationMin * 60 * 1000)
  const now = opts.now ?? new Date()
  return now >= open && now <= close
}

/**
 * Compute Unix timestamp (seconds) for a session's natural end + buffer.
 * Used by Daily.co room exp. Takes the source timezone so the underlying
 * UTC instant is exact regardless of where the server runs.
 */
export function sessionEndUnix(
  dateStr: string,
  slot: string,
  sourceTz: string,
  bufferMin: number = 90,
): number | null {
  const parsed = parseSlotTime(slot)
  if (!parsed) return null
  const start = zonedTimeToUtc(dateStr, parsed.hour, parsed.minute, sourceTz)
  return Math.floor((start.getTime() + bufferMin * 60 * 1000) / 1000)
}
