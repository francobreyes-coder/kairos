'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  User,
  TrendingUp,
  XCircle,
  AlertCircle,
  ExternalLink,
  Pencil,
  Save,
  ChevronRight,
  Briefcase,
  Info,
  Video,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SERVICE_OPTIONS = [
  { id: 'essays', label: 'Essay Writing', defaultPrice: 50, description: 'College application essays, personal statements, supplements' },
  { id: 'sat-act', label: 'SAT/ACT Prep', defaultPrice: 65, description: 'Test prep sessions, practice tests, strategy coaching' },
  { id: 'activities', label: 'Activities List Building', defaultPrice: 45, description: 'Extracurricular planning, resume building, activity curation' },
]

const MIN_PRICE = 0
const MAX_PRICE = 500

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
]

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardSession {
  id: string
  student_id: string
  tutor_id: string
  day_of_week: string
  time_slot: string
  scheduled_date: string
  status: string
  price: number
  payment_status: string
  notes: string
  created_at: string
  student_name: string
}

interface DashboardStats {
  totalEarnings: number
  earningsPerSession: number
  earningsThisWeek: number
  upcomingCount: number
  completedCount: number
  totalSessions: number
}

interface TutorProfile {
  name: string
  bio: string
  profile_photo: string | null
  subjects: string[]
  college: string
  major: string
  availability: Record<string, string[]>
  services: string[]
  service_prices: Record<string, number>
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function isWithinSessionWindow(scheduledDate: string, timeSlot: string): boolean {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return false
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  const sessionStart = new Date(`${scheduledDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000)
  const now = new Date()
  const earlyJoin = new Date(sessionStart.getTime() - 10 * 60 * 1000)
  return now >= earlyJoin && now <= sessionEnd
}

function getNextSessionCountdown(sessions: DashboardSession[]): string | null {
  if (sessions.length === 0) return null
  const next = sessions[0]
  const now = new Date()
  const sessionDate = new Date(next.scheduled_date + 'T00:00:00')
  const diffMs = sessionDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return `Today at ${next.time_slot}`
  if (diffDays === 1) return `Tomorrow at ${next.time_slot}`
  return `In ${diffDays} days — ${formatDate(next.scheduled_date)} at ${next.time_slot}`
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SessionRow({
  s,
  isPast,
  onCancel,
  cancelling,
}: {
  s: DashboardSession
  isPast?: boolean
  onCancel?: (id: string) => void
  cancelling?: string | null
}) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-secondary/50 transition-colors">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-accent" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{s.student_name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(s.scheduled_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {s.time_slot}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isPast && s.price > 0 && (
          <span className="text-sm font-medium text-foreground">{formatCurrency(s.price)}</span>
        )}
        {s.status === 'confirmed' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Confirmed
          </span>
        )}
        {s.status === 'completed' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        )}
        {s.status === 'cancelled' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        )}
        {!isPast && s.status === 'confirmed' && s.scheduled_date >= today && isWithinSessionWindow(s.scheduled_date, s.time_slot) && (
          <a
            href={`/session/${s.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-accent hover:bg-accent/90 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Video className="w-3 h-3" />
            Join
          </a>
        )}
        {!isPast && s.status === 'confirmed' && s.scheduled_date >= today && onCancel && (
          <button
            onClick={() => onCancel(s.id)}
            disabled={cancelling === s.id}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {cancelling === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Availability Editor                                                */
/* ------------------------------------------------------------------ */

function AvailabilityEditor({
  availability,
  onSave,
  saving,
}: {
  availability: Record<string, string[]>
  onSave: (a: Record<string, string[]>) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string[]>>(availability)

  useEffect(() => {
    setDraft(availability)
  }, [availability])

  function toggle(day: string, time: string) {
    setDraft((prev) => {
      const slots = prev[day] ?? []
      const next = slots.includes(time) ? slots.filter((t) => t !== time) : [...slots, time]
      return { ...prev, [day]: next }
    })
  }

  const totalSlots = Object.values(editing ? draft : availability).reduce((sum, s) => sum + s.length, 0)

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Availability</h3>
          <span className="text-xs text-muted-foreground ml-1">({totalSlots} slots)</span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setDraft(availability); setEditing(false) }}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onSave(draft); setEditing(false) }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-foreground bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-5 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Time grid */}
          {TIME_SLOTS.map((time) => (
            <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
              <div className="text-xs text-muted-foreground py-1.5 text-right pr-2">{time}</div>
              {DAYS.map((day) => {
                const source = editing ? draft : availability
                const active = (source[day] ?? []).includes(time)
                return (
                  <button
                    key={day}
                    disabled={!editing}
                    onClick={() => toggle(day, time)}
                    className={`h-7 rounded text-[10px] font-medium transition-all ${
                      active
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : editing
                          ? 'bg-secondary/50 hover:bg-secondary border border-transparent'
                          : 'bg-secondary/30 border border-transparent'
                    } ${editing ? 'cursor-pointer' : 'cursor-default'}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Service Pricing Editor                                             */
/* ------------------------------------------------------------------ */

function ServicePricingEditor({
  services,
  servicePrices,
  onSave,
  saving,
}: {
  services: string[]
  servicePrices: Record<string, number>
  onSave: (prices: Record<string, number>) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Initialize draft from current prices (as strings for input binding)
    const initial: Record<string, string> = {}
    for (const svc of services) {
      const opt = SERVICE_OPTIONS.find((o) => o.id === svc)
      initial[svc] = String(servicePrices[svc] ?? opt?.defaultPrice ?? 0)
    }
    setDraft(initial)
  }, [services, servicePrices])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const svc of services) {
      const val = parseFloat(draft[svc] ?? '')
      if (isNaN(val)) {
        newErrors[svc] = 'Enter a valid price'
      } else if (val < MIN_PRICE) {
        newErrors[svc] = `Min $${MIN_PRICE}`
      } else if (val > MAX_PRICE) {
        newErrors[svc] = `Max $${MAX_PRICE}`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const prices: Record<string, number> = {}
    for (const svc of services) {
      prices[svc] = parseFloat(draft[svc])
    }
    onSave(prices)
    setEditing(false)
  }

  function setDefault(svc: string) {
    const opt = SERVICE_OPTIONS.find((o) => o.id === svc)
    if (opt) {
      setDraft((prev) => ({ ...prev, [svc]: String(opt.defaultPrice) }))
    }
  }

  const activeServices = SERVICE_OPTIONS.filter((o) => services.includes(o.id))

  if (activeServices.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services & Pricing</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No services configured yet. Add services in your{' '}
          <Link href="/tutor/profile" className="text-accent hover:text-accent/80 font-medium">
            tutor profile
          </Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services & Pricing</h3>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setErrors({}) }}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-foreground bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Prices
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {activeServices.map((svc) => {
          const currentPrice = servicePrices[svc.id]
          const hasPrice = currentPrice !== undefined && currentPrice > 0

          return (
            <div
              key={svc.id}
              className={`rounded-xl border p-4 transition-all ${
                editing ? 'border-accent/20 bg-accent/5' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-foreground">{svc.label}</h4>
                    {!editing && hasPrice && (
                      <span className="text-sm font-bold text-accent">{formatCurrency(currentPrice)}/hr</span>
                    )}
                    {!editing && !hasPrice && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">No price set</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{svc.description}</p>
                </div>

                {editing && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={MIN_PRICE}
                        max={MAX_PRICE}
                        step="5"
                        value={draft[svc.id] ?? ''}
                        onChange={(e) => {
                          setDraft((prev) => ({ ...prev, [svc.id]: e.target.value }))
                          setErrors((prev) => { const n = { ...prev }; delete n[svc.id]; return n })
                        }}
                        className="w-20 h-9 px-2 rounded-lg bg-card border border-border text-foreground text-sm text-right outline-none focus:ring-2 focus:ring-ring/30 transition"
                      />
                      <span className="text-xs text-muted-foreground">/hr</span>
                    </div>
                    <button
                      onClick={() => setDefault(svc.id)}
                      className="text-[10px] text-accent hover:text-accent/80 font-medium"
                    >
                      Use suggested (${svc.defaultPrice})
                    </button>
                    {errors[svc.id] && (
                      <span className="text-[10px] text-red-500 font-medium">{errors[svc.id]}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {editing && (
          <div className="flex items-start gap-2 px-1 pt-1">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Prices are per hour. Suggested prices are based on typical rates for each service.
              Min ${MIN_PRICE} — Max ${MAX_PRICE} per hour.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TutorDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<TutorProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [upcoming, setUpcoming] = useState<DashboardSession[]>([])
  const [past, setPast] = useState<DashboardSession[]>([])
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchDashboard()
  }, [status])

  function fetchDashboard() {
    setLoading(true)
    fetch('/api/tutor/dashboard')
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error('NO_PROFILE')
          throw new Error('Failed to load dashboard')
        }
        return r.json()
      })
      .then((data) => {
        setProfile(data.profile)
        setStats(data.stats)
        setUpcoming(data.upcoming)
        setPast(data.past)
      })
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
      setUpcoming((prev) => prev.filter((s) => s.id !== sessionId))
      if (stats) {
        setStats({ ...stats, upcomingCount: stats.upcomingCount - 1 })
      }
    } catch {
      setError('Failed to cancel session')
    } finally {
      setCancelling(null)
    }
  }

  async function saveAvailability(newAvailability: Record<string, string[]>) {
    setSavingAvailability(true)
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: newAvailability }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setProfile((prev) => prev ? { ...prev, availability: newAvailability } : prev)
    } catch {
      setError('Failed to save availability')
    } finally {
      setSavingAvailability(false)
    }
  }

  async function saveServicePrices(newPrices: Record<string, number>) {
    setSavingPrices(true)
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicePrices: newPrices }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setProfile((prev) => prev ? { ...prev, service_prices: newPrices } : prev)
    } catch {
      setError('Failed to save pricing')
    } finally {
      setSavingPrices(false)
    }
  }

  const countdown = useMemo(() => getNextSessionCountdown(upcoming), [upcoming])

  /* Loading state */
  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </main>
      </>
    )
  }

  /* No profile — redirect to onboarding */
  if (error === 'NO_PROFILE') {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-md text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <User className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground mb-6">
              You need a completed tutor profile to access the dashboard.
            </p>
            <Link
              href="/tutor/onboarding"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Set Up Profile
            </Link>
          </div>
        </main>
      </>
    )
  }

  /* Error state */
  if (error) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-5xl text-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => { setError(null); fetchDashboard() }}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </>
    )
  }

  const displayed = tab === 'upcoming' ? upcoming : past

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <div className="mx-auto max-w-5xl">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {profile?.name ? `Welcome back, ${profile.name.split(' ')[0]}` : 'Tutor Dashboard'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {countdown ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    Next session: {countdown}
                  </span>
                ) : (
                  'Manage your sessions, availability, and earnings.'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/tutor/profile"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Profile
              </Link>
              <Link
                href="/find-tutors"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Public Profile
              </Link>
            </div>
          </div>

          {/* Overview cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={DollarSign}
              label="Total Earnings"
              value={formatCurrency(stats?.totalEarnings ?? 0)}
              sub={stats?.earningsThisWeek ? `${formatCurrency(stats.earningsThisWeek)} this week` : undefined}
              accent
            />
            <StatCard
              icon={Calendar}
              label="Upcoming"
              value={String(stats?.upcomingCount ?? 0)}
              sub="confirmed sessions"
            />
            <StatCard
              icon={CheckCircle}
              label="Completed"
              value={String(stats?.completedCount ?? 0)}
              sub="total sessions"
            />
            <StatCard
              icon={TrendingUp}
              label="Per Session"
              value={formatCurrency(stats?.earningsPerSession ?? 0)}
              sub="average earnings"
            />
          </div>

          {/* Sessions section */}
          <div className="rounded-2xl border border-border bg-card mb-8">
            <div className="flex items-center justify-between p-5 pb-0">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Sessions
              </h3>
              <Link
                href="/sessions"
                className="text-xs text-accent hover:text-accent/80 font-medium inline-flex items-center gap-1"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-4">
              <div className="flex gap-1 p-1 bg-muted rounded-xl mb-1">
                <button
                  onClick={() => setTab('upcoming')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    tab === 'upcoming'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Upcoming ({upcoming.length})
                </button>
                <button
                  onClick={() => setTab('past')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    tab === 'past'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Past ({past.length})
                </button>
              </div>
            </div>

            <div className="p-5 pt-3">
              {displayed.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tab === 'upcoming'
                      ? 'No upcoming sessions yet. Students can book you from the Find Tutors page.'
                      : 'No past sessions to show.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {displayed.map((s) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      isPast={tab === 'past'}
                      onCancel={tab === 'upcoming' ? cancelSession : undefined}
                      cancelling={cancelling}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Services & Pricing */}
          {profile && (
            <ServicePricingEditor
              services={profile.services ?? []}
              servicePrices={profile.service_prices ?? {}}
              onSave={saveServicePrices}
              saving={savingPrices}
            />
          )}

          {/* Availability editor */}
          {profile && (
            <AvailabilityEditor
              availability={profile.availability ?? {}}
              onSave={saveAvailability}
              saving={savingAvailability}
            />
          )}
        </div>
      </main>
    </>
  )
}
