'use client'

import { useState, useEffect } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Clock,
  Calendar,
  DollarSign,
  CreditCard,
} from 'lucide-react'
import {
  DEFAULT_TIMEZONE,
  convertSlotToTimezone,
} from '@/lib/timezone'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { TimezoneSelector } from '@/components/timezone-selector'

interface SlotInfo {
  time: string
  date: string
  available: boolean
}

// A slot after conversion into the viewer's timezone. The original tutor-tz
// (time, date, dayOfWeek) are kept so we can send them back to the booking
// API exactly as the tutor stored them — the server validates against its
// own copy of the availability template, which is still in tutor-tz.
interface DisplaySlot {
  display: { time: string; date: string; dayOfWeek: string }
  source: { time: string; date: string; dayOfWeek: string }
  available: boolean
}

interface BookingModalProps {
  tutorId: string
  tutorName: string
  services: string[]
  servicePrices: Record<string, number>
  onClose: () => void
  onBooked: () => void
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SERVICE_LABELS: Record<string, string> = {
  essays: 'Essay Writing',
  sat: 'SAT Prep',
  act: 'ACT Prep',
  activities: 'Activities',
  'sat-act': 'SAT/ACT Prep',
}

// Returns the Monday of the week containing today, shifted by `offset` weeks.
// Sun=0, Mon=1, ..., Sat=6. This week's Monday is "daysSinceMonday" days back.
function getMonday(offset: number): Date {
  const now = new Date()
  const day = now.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysSinceMonday + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}`
}

export default function BookingModal({ tutorId, tutorName, services, servicePrices, onClose, onBooked }: BookingModalProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState<Record<string, SlotInfo[]>>({})
  const [tutorTimezone, setTutorTimezone] = useState<string>(DEFAULT_TIMEZONE)
  const viewerTz = useViewerTimezone()
  const [loading, setLoading] = useState(true)
  // Selected slot carries both the original tutor-tz coordinates (sent to
  // the API for validation) and the display coordinates (shown in the UI).
  const [selected, setSelected] = useState<DisplaySlot | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(
    services.length === 1 ? services[0] : null
  )
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monday = getMonday(weekOffset)
  const selectedPrice = selectedService ? servicePrices[selectedService] : null

  // Clear selected slot when viewer tz changes — its display coordinates
  // are now in a different tz and the user should re-pick deliberately.
  useEffect(() => {
    setSelected(null)
  }, [viewerTz])

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    setError(null)
    const weekStr = monday.toISOString().split('T')[0]
    fetch(`/api/tutor/availability?tutorId=${tutorId}&week=${weekStr}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? {})
        setTutorTimezone(data.tutorTimezone || DEFAULT_TIMEZONE)
      })
      .catch(() => setError('Failed to load availability'))
      .finally(() => setLoading(false))
  }, [tutorId, weekOffset])

  // Convert tutor-tz slots into the viewer's tz and regroup by the day they
  // actually land on in the viewer's local time. Slots can shift days when
  // the tz gap crosses midnight (e.g. a Sydney tutor's 8AM Monday slot is
  // Sunday afternoon in NY).
  const displayGroups: { dayOfWeek: string; date: string; slots: DisplaySlot[] }[] = (() => {
    const buckets = new Map<string, { dayOfWeek: string; date: string; slots: DisplaySlot[] }>()
    for (const sourceDay of DAYS) {
      const daySlots = slots[sourceDay]
      if (!daySlots) continue
      for (const s of daySlots) {
        const converted = convertSlotToTimezone(s.date, s.time, tutorTimezone, viewerTz)
        if (!converted) continue
        const key = converted.date
        if (!buckets.has(key)) {
          buckets.set(key, { dayOfWeek: converted.dayOfWeek, date: converted.date, slots: [] })
        }
        buckets.get(key)!.slots.push({
          display: { time: converted.time, date: converted.date, dayOfWeek: converted.dayOfWeek },
          source: { time: s.time, date: s.date, dayOfWeek: sourceDay },
          available: s.available,
        })
      }
    }
    // Sort buckets by date, slots within each bucket by underlying instant.
    const ordered = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
    for (const b of ordered) {
      b.slots.sort((x, y) => {
        // Reuse convertSlotToTimezone to get the UTC instant for stable ordering.
        const xu = convertSlotToTimezone(x.source.date, x.source.time, tutorTimezone, viewerTz)?.utc
        const yu = convertSlotToTimezone(y.source.date, y.source.time, tutorTimezone, viewerTz)?.utc
        return (xu?.getTime() ?? 0) - (yu?.getTime() ?? 0)
      })
    }
    return ordered
  })()

  async function handleBook() {
    if (!selected || !selectedService || !selectedPrice) return
    setBooking(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          // Send the tutor-tz coordinates the server stored, not the
          // viewer-tz display coordinates — the server validates against
          // its own availability template, which is in tutor tz.
          dayOfWeek: selected.source.dayOfWeek,
          timeSlot: selected.source.time,
          scheduledDate: selected.source.date,
          notes,
          service: selectedService,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start checkout')
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setBooking(false)
    }
  }

  const hasAnySlots = displayGroups.some((g) => g.slots.length > 0)
  const canBook = selected && selectedService && selectedPrice && selectedPrice > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Book a Session</h2>
            <p className="text-sm text-muted-foreground">with {tutorName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Redirecting to payment...</h3>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ll be redirected to Stripe to complete your booking.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Service selection */}
              {services.length > 1 && (
                <div className="mb-5">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Select a service
                  </label>
                  <div className="grid gap-2">
                    {services.map((svc) => {
                      const price = servicePrices[svc]
                      const isSelected = selectedService === svc
                      return (
                        <button
                          key={svc}
                          onClick={() => setSelectedService(isSelected ? null : svc)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                              : 'border-border hover:border-accent/30 hover:bg-muted/50'
                          }`}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {SERVICE_LABELS[svc] ?? svc}
                          </span>
                          {price > 0 && (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                              <DollarSign className="w-3.5 h-3.5" />
                              {price}/hr
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Single service — show price banner */}
              {services.length === 1 && selectedPrice && selectedPrice > 0 && (
                <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {SERVICE_LABELS[services[0]] ?? services[0]} — ${selectedPrice}/hr
                  </span>
                </div>
              )}

              {/* Week navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="w-4 h-4 text-accent" />
                  {formatWeekRange(monday)}
                </div>
                <button
                  onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                  disabled={weekOffset >= 3}
                  className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Viewer-tz override + indicator */}
              <div className="flex items-center justify-end mb-3">
                <TimezoneSelector />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
              ) : !hasAnySlots ? (
                <div className="text-center py-10">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No availability this week. Try another week.
                  </p>
                </div>
              ) : (
                <>
                  {/* Day slots (in viewer's tz; days regroup when tz crosses midnight) */}
                  <div className="space-y-4 mb-5">
                    {displayGroups.map((group) => (
                      <div key={group.date}>
                        <div className="text-sm font-medium text-foreground mb-2">
                          {group.dayOfWeek}{' '}
                          <span className="text-muted-foreground font-normal">
                            {formatDate(group.date)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.slots.map((slot) => {
                            const isSelected =
                              selected?.source.date === slot.source.date &&
                              selected?.source.time === slot.source.time
                            return (
                              <button
                                key={`${slot.source.dayOfWeek}-${slot.source.time}`}
                                disabled={!slot.available}
                                onClick={() => setSelected(isSelected ? null : slot)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  !slot.available
                                    ? 'bg-muted text-muted-foreground/50 line-through cursor-not-allowed'
                                    : isSelected
                                      ? 'bg-accent text-accent-foreground ring-2 ring-accent/30'
                                      : 'bg-muted/60 text-foreground hover:bg-accent/10 hover:text-accent'
                                }`}
                              >
                                {slot.display.time}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  {selected && (
                    <div className="mb-5">
                      <label className="text-sm font-medium text-foreground mb-1.5 block">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="What would you like help with?"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm resize-none"
                      />
                    </div>
                  )}

                  {/* Price summary */}
                  {canBook && (
                    <div className="mb-4 p-3 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-between">
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{SERVICE_LABELS[selectedService!] ?? selectedService}</span>
                        {' '}· {selected!.display.dayOfWeek}, {formatDate(selected!.display.date)} at {selected!.display.time}
                      </div>
                      <div className="text-lg font-bold text-accent">${selectedPrice}</div>
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Book button */}
                  <button
                    disabled={!canBook || booking}
                    onClick={handleBook}
                    className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {booking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting to checkout...
                      </>
                    ) : canBook ? (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay ${selectedPrice} & Book
                      </>
                    ) : !selectedService ? (
                      'Select a service'
                    ) : (
                      'Select a time slot'
                    )}
                  </button>

                  <p className="text-xs text-muted-foreground text-center mt-3">
                    You&apos;ll be redirected to Stripe for secure payment
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
