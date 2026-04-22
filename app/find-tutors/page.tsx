'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/landing/header'
import {
  Search,
  GraduationCap,
  Sparkles,
  BookOpen,
  Heart,
  MapPin,
  Star,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  DollarSign,
  MessageSquare,
} from 'lucide-react'
import BookingModal from '@/components/booking-modal'

interface TutorMatch {
  userId: string
  name: string
  bio: string
  profilePhoto: string | null
  subjects: string[]
  college: string
  major: string
  interests: string[]
  teachingStyle: string
  services: string[]
  servicePrices: Record<string, number>
  score: number
  reasons: string[]
}

const SERVICE_LABELS: Record<string, string> = {
  'essays': 'Essay Writing',
  'sat-act': 'SAT/ACT Prep',
  'activities': 'Activities',
}

function getStartingPrice(prices: Record<string, number>): number | null {
  const values = Object.values(prices).filter((v) => v > 0)
  return values.length > 0 ? Math.min(...values) : null
}

export default function FindTutorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<TutorMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [bookingTutor, setBookingTutor] = useState<{ id: string; name: string; services: string[]; servicePrices: Record<string, number> } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/match-tutors')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load tutors')
        return r.json()
      })
      .then((data) => {
        setMatches(data.matches ?? [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return matches
    const q = searchQuery.toLowerCase()
    return matches.filter((t) => {
      const searchable = [
        t.name,
        t.college,
        t.major,
        ...t.subjects,
        ...t.interests,
        t.teachingStyle,
        ...t.services,
      ]
        .join(' ')
        .toLowerCase()
      return searchable.includes(q)
    })
  }, [matches, searchQuery])

  function toggleExpanded(userId: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function getScoreLabel(score: number): { text: string; color: string } {
    if (score >= 60) return { text: 'Great Match', color: 'bg-green-100 text-green-700' }
    if (score >= 35) return { text: 'Good Match', color: 'bg-blue-100 text-blue-700' }
    return { text: 'Match', color: 'bg-gray-100 text-gray-600' }
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-muted-foreground">Finding your best tutor matches...</p>
            </div>
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
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
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
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Tutor</h1>
            <p className="text-muted-foreground">
              Tutors ranked by how well they match your profile.{' '}
              {matches.length > 0 && (
                <span className="text-foreground font-medium">{matches.length} tutors available</span>
              )}
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, college, subject, interest..."
              className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-accent" />
              </div>
              {matches.length === 0 ? (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">No tutors yet</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {"We're onboarding tutors right now. Check back soon — we'll have matches for you!"}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-2">No results</h2>
                  <p className="text-muted-foreground">
                    No tutors match &ldquo;{searchQuery}&rdquo;. Try a different search.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tutor, idx) => {
                const scoreLabel = getScoreLabel(tutor.score)
                const isExpanded = expandedCards.has(tutor.userId)
                const photoUrl = tutor.profilePhoto
                  ? `/api/storage?path=${encodeURIComponent(tutor.profilePhoto)}`
                  : null

                return (
                  <div
                    key={tutor.userId}
                    className="rounded-2xl border border-border bg-card p-5 sm:p-6 hover:border-accent/30 transition-all"
                  >
                    {/* Top row: rank + avatar + name/college + score badge */}
                    <div className="flex items-start gap-4">
                      {/* Rank number */}
                      <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent text-sm font-bold flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                            <span className="text-lg font-bold text-accent">
                              {tutor.name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Name + college + major */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">{tutor.name}</h3>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${scoreLabel.color}`}>
                            {scoreLabel.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                          <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {tutor.college}
                            {tutor.major && ` · ${tutor.major}`}
                          </span>
                        </div>
                        {(() => {
                          const startPrice = getStartingPrice(tutor.servicePrices ?? {})
                          return startPrice ? (
                            <div className="flex items-center gap-1 mt-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <span className="text-sm font-semibold text-green-700">
                                From ${startPrice}/hr
                              </span>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>

                    {/* "Why this tutor?" reasons */}
                    <div className="mt-4 p-3.5 rounded-xl bg-accent/5 border border-accent/10">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-semibold text-accent uppercase tracking-wide">
                          Why this tutor?
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {tutor.reasons.map((reason, i) => (
                          <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                            <Star className="w-3 h-3 text-accent mt-1 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Tags: subjects + interests */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {tutor.subjects.slice(0, isExpanded ? undefined : 4).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700"
                        >
                          <BookOpen className="w-3 h-3" />
                          {s}
                        </span>
                      ))}
                      {tutor.interests.slice(0, isExpanded ? undefined : 3).map((i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-pink-50 text-pink-700"
                        >
                          <Heart className="w-3 h-3" />
                          {i}
                        </span>
                      ))}
                      {!isExpanded &&
                        tutor.subjects.length + tutor.interests.length > 7 && (
                          <span className="text-xs text-muted-foreground py-1">
                            +{tutor.subjects.length + tutor.interests.length - 7} more
                          </span>
                        )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        {tutor.bio && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{tutor.bio}</p>
                        )}
                        {tutor.teachingStyle && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5" />
                            Teaching style: <span className="text-foreground capitalize">{tutor.teachingStyle.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {/* Per-service pricing */}
                        {tutor.servicePrices && Object.keys(tutor.servicePrices).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {Object.entries(tutor.servicePrices)
                              .filter(([, price]) => price > 0)
                              .map(([svc, price]) => (
                                <span
                                  key={svc}
                                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  {SERVICE_LABELS[svc] ?? svc}: ${price}/hr
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom row: expand toggle + Book button */}
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={() => toggleExpanded(tutor.userId)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" /> Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" /> More details
                          </>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/messages?with=${tutor.userId}&name=${encodeURIComponent(tutor.name)}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Message
                        </button>
                        <button
                          onClick={() => setBookingTutor({ id: tutor.userId, name: tutor.name, services: tutor.services, servicePrices: tutor.servicePrices })}
                          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {bookingTutor && (
        <BookingModal
          tutorId={bookingTutor.id}
          tutorName={bookingTutor.name}
          services={bookingTutor.services}
          servicePrices={bookingTutor.servicePrices}
          onClose={() => setBookingTutor(null)}
          onBooked={() => setBookingTutor(null)}
        />
      )}
    </>
  )
}
