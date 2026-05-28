'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Header } from '@/components/landing/header'
import {
  Calendar,
  Clock,
  User,
  Loader2,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Video,
  FileText,
} from 'lucide-react'
import {
  DEFAULT_TIMEZONE,
  convertSlotToTimezone,
  isWithinSessionWindow as isWithinWindow,
} from '@/lib/timezone'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { TimezoneSelector } from '@/components/timezone-selector'

interface Session {
  id: string
  student_id: string
  tutor_id: string
  day_of_week: string
  time_slot: string
  scheduled_date: string
  status: string
  notes: string
  created_at: string
  student_name: string
  tutor_name: string
  is_tutor: boolean
  timezone: string | null
}

export default function SessionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const viewerTz = useViewerTimezone()
  // IDs of sessions whose Daily.co room is currently in use. Polled
  // separately so the Join button appears as soon as the counterpart
  // joins, even if the scheduled time window has passed or hasn't started.
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchSessions()
  }, [status])

  // Poll the active-rooms endpoint while signed in. 20s is a comfortable
  // tradeoff between responsiveness for joining and Daily.co API load.
  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false

    async function refreshActive() {
      try {
        const res = await fetch('/api/sessions/active-rooms')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setActiveIds(new Set(data.activeIds ?? []))
      } catch {
        // Silent — best-effort polling
      }
    }

    refreshActive()
    const interval = setInterval(refreshActive, 20000)
    const onFocus = () => refreshActive()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [status])

  function fetchSessions() {
    setLoading(true)
    fetch('/api/sessions')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load sessions')
        return r.json()
      })
      .then((data) => setSessions(data.sessions ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  async function cancelSession(sessionId: string) {
    setCancelling(sessionId)
    try {
      const res = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Failed to cancel')
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'cancelled' } : s))
      )
    } catch {
      setError('Failed to cancel session')
    } finally {
      setCancelling(null)
    }
  }

  function sourceTz(s: Session): string {
    return s.timezone || DEFAULT_TIMEZONE
  }

  // Convert a session's stored (date, time, sourceTz) into the viewer's tz.
  // Returns the original strings if the slot can't be parsed.
  function viewerView(s: Session) {
    const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sourceTz(s), viewerTz)
    if (!converted) return { date: s.scheduled_date, time: s.time_slot, utc: null as Date | null }
    return { date: converted.date, time: converted.time, utc: converted.utc }
  }

  // Compare against "now" rather than a date string so timezone shifts that
  // move the session past midnight don't misclassify it.
  const nowMs = Date.now()
  const upcoming = sessions.filter((s) => {
    if (s.status !== 'confirmed') return false
    if (activeIds.has(s.id)) return true
    const utc = viewerView(s).utc
    // Keep visible for the full ~1h session window after start, then drop.
    return utc !== null && utc.getTime() + 60 * 60 * 1000 >= nowMs
  })
  const past = sessions.filter((s) => {
    if (s.status !== 'confirmed') return true
    if (activeIds.has(s.id)) return false
    const utc = viewerView(s).utc
    return utc !== null && utc.getTime() + 60 * 60 * 1000 < nowMs
  })

  const displayed = tab === 'upcoming' ? upcoming : past

  function isSessionLive(s: Session): boolean {
    return isWithinWindow(s.scheduled_date, s.time_slot, sourceTz(s))
  }

  function formatDate(s: Session): string {
    const utc = viewerView(s).utc
    if (!utc) return s.scheduled_date
    return new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(utc)
  }

  function statusBadge(s: string) {
    switch (s) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Confirmed
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        )
      default:
        return null
    }
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-3xl flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground">Loading your sessions...</p>
          </div>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-3xl text-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => { setError(null); fetchSessions() }}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <div className="mx-auto max-w-3xl">
          {/* Page header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">My Sessions</h1>
              <p className="text-muted-foreground">
                {session?.user?.role === 'tutor'
                  ? 'Manage sessions with your students.'
                  : 'Track your upcoming and past tutoring sessions.'}
              </p>
            </div>
            <TimezoneSelector />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
            <button
              onClick={() => setTab('upcoming')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'upcoming'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Upcoming ({upcoming.length})
            </button>
            <button
              onClick={() => setTab('past')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'past'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Past ({past.length})
            </button>
          </div>

          {/* Session list */}
          {displayed.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {tab === 'upcoming'
                  ? "You don't have any upcoming sessions. Browse tutors to book one!"
                  : "You don't have any past sessions yet."}
              </p>
              {tab === 'upcoming' && (
                <button
                  onClick={() => router.push('/find-tutors')}
                  className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Find Tutors
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-accent/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Tutor/Student name */}
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-base font-semibold text-foreground">
                          {s.is_tutor ? s.student_name : s.tutor_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({s.is_tutor ? 'Student' : 'Tutor'})
                        </span>
                      </div>

                      {/* Date + time (in viewer's tz) */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(s)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {viewerView(s).time}
                        </span>
                      </div>

                      {/* Notes */}
                      {s.notes && (
                        <p className="mt-2 text-sm text-muted-foreground italic">
                          &ldquo;{s.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {statusBadge(s.status)}
                      {s.status === 'confirmed' &&
                        (activeIds.has(s.id) || isSessionLive(s)) && (
                          <button
                            onClick={() => router.push(`/session/${s.id}`)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent/90 transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" />
                            {activeIds.has(s.id) ? 'Join Call · Live' : 'Join Call'}
                          </button>
                        )}
                      {s.status === 'confirmed' && upcoming.some((u) => u.id === s.id) && (
                        <button
                          onClick={() => cancelSession(s.id)}
                          disabled={cancelling === s.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {cancelling === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          Cancel
                        </button>
                      )}
                      {tab === 'past' && (
                        <button
                          onClick={() => router.push(`/session/${s.id}/notes`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          View notes
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
