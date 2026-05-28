'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/landing/header'
import { NotesViewer } from '@/components/session/NotesViewer'
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { DEFAULT_TIMEZONE, convertSlotToTimezone } from '@/lib/timezone'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'

interface SessionInfo {
  id: string
  scheduled_date: string
  time_slot: string
  status: string
  student_name: string
  tutor_name: string
  is_tutor: boolean
  timezone: string | null
}

export default function SessionNotesPage() {
  const params = useParams()
  const sessionId = params.id as string
  const router = useRouter()
  const { status: authStatus } = useSession()

  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const viewerTz = useViewerTimezone()

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/auth')
  }, [authStatus, router])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    let cancelled = false
    fetch('/api/sessions')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load session')
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const match = (data.sessions ?? []).find(
          (s: SessionInfo) => s.id === sessionId,
        )
        if (!match) throw new Error('Session not found')
        setInfo(match)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load session')
      })
    return () => {
      cancelled = true
    }
  }, [authStatus, sessionId])

  if (authStatus === 'loading' || (!info && !error)) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-3xl flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground">Loading session…</p>
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
            <h1 className="text-xl font-bold text-foreground mb-2">
              Couldn&rsquo;t load session
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => router.push('/sessions')}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Back to sessions
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
          <button
            onClick={() => router.push('/sessions')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sessions
          </button>

          {info && (
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Session Notes
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {info.is_tutor ? info.student_name : info.tutor_name}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(info, viewerTz)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {convertSlotToTimezone(
                    info.scheduled_date,
                    info.time_slot,
                    info.timezone || DEFAULT_TIMEZONE,
                    viewerTz,
                  )?.time ?? info.time_slot}
                </span>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card overflow-hidden h-[calc(100vh-260px)] min-h-[480px]">
            <NotesViewer sessionId={sessionId} />
          </div>
        </div>
      </main>
    </>
  )
}

function formatDate(s: SessionInfo, viewerTz: string): string {
  try {
    const converted = convertSlotToTimezone(
      s.scheduled_date,
      s.time_slot,
      s.timezone || DEFAULT_TIMEZONE,
      viewerTz,
    )
    const d = converted?.utc ?? new Date(s.scheduled_date + 'T00:00:00')
    return new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return s.scheduled_date
  }
}
