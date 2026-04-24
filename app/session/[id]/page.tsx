'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react'

interface SessionInfo {
  id: string
  student_id: string
  tutor_id: string
  scheduled_date: string
  time_slot: string
  status: string
  student_name: string
  tutor_name: string
  is_tutor: boolean
}

type ConnectionState = 'idle' | 'loading' | 'joining' | 'joined' | 'error' | 'left'

export default function VideoSessionPage() {
  const { data: authSession, status: authStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

  const callFrameRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/auth')
  }, [authStatus, router])

  // Fetch session info
  useEffect(() => {
    if (authStatus !== 'authenticated') return

    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        const found = data.sessions?.find((s: SessionInfo) => s.id === sessionId)
        if (!found) {
          setError('Session not found or you are not authorized to view it.')
          return
        }
        setSessionInfo(found)
      })
      .catch(() => setError('Failed to load session details.'))
  }, [authStatus, sessionId])

  // Session countdown timer
  useEffect(() => {
    if (!sessionInfo) return

    function updateTimer() {
      const match = sessionInfo!.time_slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (!match) return

      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const period = match[3].toUpperCase()
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0

      const sessionStart = new Date(`${sessionInfo!.scheduled_date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000) // 1 hour session
      const now = new Date()

      if (now >= sessionEnd) {
        setTimeRemaining('Session ended')
      } else if (now >= sessionStart) {
        const diff = sessionEnd.getTime() - now.getTime()
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setTimeRemaining(`${m}:${String(s).padStart(2, '0')} remaining`)
      } else {
        const diff = sessionStart.getTime() - now.getTime()
        const m = Math.floor(diff / 60000)
        if (m < 60) {
          setTimeRemaining(`Starts in ${m} min`)
        } else {
          setTimeRemaining(null)
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [sessionInfo])

  // Join the call
  const joinCall = useCallback(async () => {
    if (!sessionId || callFrameRef.current) return
    setConnectionState('loading')

    try {
      // Get meeting token from our API
      const res = await fetch(`/api/video-room?sessionId=${sessionId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join video room')
      }
      const { token, roomUrl } = await res.json()

      setConnectionState('joining')

      // Dynamically import Daily.co to avoid SSR issues
      const DailyIframe = (await import('@daily-co/daily-js')).default

      const callFrame = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '16px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      })

      callFrame.on('joined-meeting', () => {
        setConnectionState('joined')
        setParticipantCount(Object.keys(callFrame.participants()).length)
      })

      callFrame.on('participant-joined', () => {
        setParticipantCount(Object.keys(callFrame.participants()).length)
      })

      callFrame.on('participant-left', () => {
        setTimeout(() => {
          if (callFrameRef.current) {
            setParticipantCount(Object.keys(callFrameRef.current.participants()).length)
          }
        }, 100)
      })

      callFrame.on('left-meeting', () => {
        setConnectionState('left')
        setParticipantCount(0)
      })

      callFrame.on('error', (e: any) => {
        console.error('Daily.co error:', e)
        setError('Video connection error. Please try refreshing the page.')
        setConnectionState('error')
      })

      callFrameRef.current = callFrame

      await callFrame.join({ url: roomUrl, token })
    } catch (e: any) {
      console.error('Failed to join call:', e)
      setError(e.message || 'Failed to join video call')
      setConnectionState('error')
    }
  }, [sessionId])

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!cameraOn)
      setCameraOn(!cameraOn)
    }
  }, [cameraOn])

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!micOn)
      setMicOn(!micOn)
    }
  }, [micOn])

  // Leave call
  const leaveCall = useCallback(async () => {
    if (callFrameRef.current) {
      await callFrameRef.current.leave()
      callFrameRef.current.destroy()
      callFrameRef.current = null
    }
    setConnectionState('left')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.leave()
        callFrameRef.current.destroy()
        callFrameRef.current = null
      }
    }
  }, [])

  // Check if session is within joinable window (10 min before to session end)
  function isWithinSessionWindow(): boolean {
    if (!sessionInfo) return false
    const match = sessionInfo.time_slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return true // Allow if we can't parse

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const period = match[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0

    const sessionStart = new Date(`${sessionInfo.scheduled_date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
    const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000)
    const now = new Date()

    const earlyJoin = new Date(sessionStart.getTime() - 10 * 60 * 1000) // 10 min before

    return now >= earlyJoin && now <= sessionEnd
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Loading state
  if (authStatus === 'loading' || (!sessionInfo && !error)) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground">Loading session...</p>
          </div>
        </main>
      </>
    )
  }

  // Error state
  if (error && connectionState !== 'joined') {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-3xl text-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Unable to Join</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setError(null); setConnectionState('idle') }}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/sessions')}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Back to Sessions
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // Left meeting state
  if (connectionState === 'left') {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-3xl text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6">
              <PhoneOff className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Session Ended</h1>
            <p className="text-muted-foreground mb-6">
              You have left the video call
              {sessionInfo && ` with ${sessionInfo.is_tutor ? sessionInfo.student_name : sessionInfo.tutor_name}`}.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setConnectionState('idle'); setError(null) }}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Rejoin Call
              </button>
              <button
                onClick={() => router.push('/sessions')}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Back to Sessions
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  const canJoin = isWithinSessionWindow()

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-8 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Session info bar */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">
                    {sessionInfo!.is_tutor ? sessionInfo!.student_name : sessionInfo!.tutor_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({sessionInfo!.is_tutor ? 'Student' : 'Tutor'})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(sessionInfo!.scheduled_date)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {sessionInfo!.time_slot}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Connection status */}
                {connectionState === 'joined' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <Wifi className="w-3.5 h-3.5" />
                    Connected
                    {participantCount > 0 && ` (${participantCount})`}
                  </div>
                )}

                {/* Session timer */}
                {timeRemaining && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    timeRemaining === 'Session ended'
                      ? 'bg-red-100 text-red-700'
                      : timeRemaining.includes('remaining')
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {timeRemaining}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Video area */}
          <div className="relative rounded-2xl border border-border bg-black overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
            {/* Daily.co iframe container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Pre-join overlay */}
            {(connectionState === 'idle' || connectionState === 'loading' || connectionState === 'joining') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10">
                {connectionState === 'loading' || connectionState === 'joining' ? (
                  <>
                    <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                    <p className="text-white text-lg font-medium">
                      {connectionState === 'loading' ? 'Preparing video room...' : 'Joining call...'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-6">
                      <Video className="w-10 h-10 text-accent" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Ready to join?</h2>
                    <p className="text-gray-400 mb-8 text-center max-w-md">
                      {canJoin
                        ? `Join your session with ${sessionInfo!.is_tutor ? sessionInfo!.student_name : sessionInfo!.tutor_name}`
                        : 'This session is not within the joinable window (10 minutes before start time).'
                      }
                    </p>
                    {canJoin ? (
                      <button
                        onClick={joinCall}
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-accent text-accent-foreground text-base font-semibold hover:bg-accent/90 transition-colors"
                      >
                        <Video className="w-5 h-5" />
                        Join Session
                      </button>
                    ) : (
                      <div className="text-center">
                        <p className="text-amber-400 text-sm mb-4">
                          You can join 10 minutes before the scheduled time.
                        </p>
                        <button
                          onClick={() => router.push('/sessions')}
                          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition-colors"
                        >
                          Back to Sessions
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Controls bar (only visible when in call) */}
          {connectionState === 'joined' && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={toggleCamera}
                className={`p-3 rounded-full transition-colors ${
                  cameraOn
                    ? 'bg-muted text-foreground hover:bg-muted/80'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
                title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleMic}
                className={`p-3 rounded-full transition-colors ${
                  micOn
                    ? 'bg-muted text-foreground hover:bg-muted/80'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={leaveCall}
                className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                title="Leave call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
