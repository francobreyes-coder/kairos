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
} from 'lucide-react'

interface SlotInfo {
  time: string
  date: string
  available: boolean
}

interface BookingModalProps {
  tutorId: string
  tutorName: string
  onClose: () => void
  onBooked: () => void
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getMonday(offset: number): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offset * 7)
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

export default function BookingModal({ tutorId, tutorName, onClose, onBooked }: BookingModalProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState<Record<string, SlotInfo[]>>({})
  const [dayDates, setDayDates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ day: string; time: string; date: string } | null>(null)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monday = getMonday(weekOffset)

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    setError(null)
    const weekStr = monday.toISOString().split('T')[0]
    fetch(`/api/tutor/availability?tutorId=${tutorId}&week=${weekStr}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? {})
        setDayDates(data.dayDates ?? {})
      })
      .catch(() => setError('Failed to load availability'))
      .finally(() => setLoading(false))
  }, [tutorId, weekOffset])

  async function handleBook() {
    if (!selected) return
    setBooking(true)
    setError(null)

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          dayOfWeek: selected.day,
          timeSlot: selected.time,
          scheduledDate: selected.date,
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to book')
      }

      setSuccess(true)
      setTimeout(() => {
        onBooked()
        onClose()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to book session')
    } finally {
      setBooking(false)
    }
  }

  const hasAnySlots = Object.values(slots).some((daySlots) => daySlots.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              <h3 className="text-lg font-semibold text-foreground">Session Booked!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Your session with {tutorName} on {selected?.date && formatDate(selected.date)} at{' '}
                {selected?.time} has been confirmed.
              </p>
            </div>
          ) : (
            <>
              {/* Week navigation */}
              <div className="flex items-center justify-between mb-5">
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
                  {/* Day slots */}
                  <div className="space-y-4 mb-5">
                    {DAYS.map((day) => {
                      const daySlots = slots[day]
                      if (!daySlots || daySlots.length === 0) return null
                      const date = dayDates[day]

                      return (
                        <div key={day}>
                          <div className="text-sm font-medium text-foreground mb-2">
                            {day}{' '}
                            <span className="text-muted-foreground font-normal">
                              {date && formatDate(date)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {daySlots.map((slot) => {
                              const isSelected =
                                selected?.day === day && selected?.time === slot.time
                              return (
                                <button
                                  key={slot.time}
                                  disabled={!slot.available}
                                  onClick={() =>
                                    setSelected(
                                      isSelected
                                        ? null
                                        : { day, time: slot.time, date: slot.date }
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    !slot.available
                                      ? 'bg-muted text-muted-foreground/50 line-through cursor-not-allowed'
                                      : isSelected
                                        ? 'bg-accent text-accent-foreground ring-2 ring-accent/30'
                                        : 'bg-muted/60 text-foreground hover:bg-accent/10 hover:text-accent'
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
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

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Book button */}
                  <button
                    disabled={!selected || booking}
                    onClick={handleBook}
                    className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {booking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Booking...
                      </>
                    ) : selected ? (
                      `Book ${selected.day} at ${selected.time}`
                    ) : (
                      'Select a time slot'
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
