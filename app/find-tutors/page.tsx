'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Header } from '@/components/landing/header'
import {
  Search,
  MapPin,
  Heart,
  Clock,
  Loader2,
  X,
  Star,
  DollarSign,
  Sparkles,
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
  essays: 'Essay Writing',
  'sat-act': 'SAT/ACT Prep',
  activities: 'Activities',
}

const TEACHING_STYLE_LABELS: Record<string, string> = {
  structured: 'Structured & Organized',
  collaborative: 'Collaborative',
  socratic: 'Socratic / Question-Based',
  flexible: 'Flexible & Adaptive',
}

const AVATAR_COLORS = [
  '#6C52E0',
  '#7A62EA',
  '#9B86F0',
  '#B47AE8',
  '#8177C9',
  '#7A3AE8',
  '#BDB0F5',
  '#5B24CC',
]

function getStartingPrice(prices: Record<string, number>): number | null {
  const values = Object.values(prices).filter((v) => v > 0)
  return values.length > 0 ? Math.min(...values) : null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Build filter chips from actual tutor data
function buildFilterChips(tutors: TutorMatch[]): string[] {
  const serviceSet = new Set<string>()
  for (const t of tutors) {
    for (const s of t.services) {
      if (SERVICE_LABELS[s]) serviceSet.add(SERVICE_LABELS[s])
    }
  }
  return Array.from(serviceSet)
}

type SortMode = 'best' | 'price-low' | 'price-high'

export default function FindTutorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<TutorMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortMode, setSortMode] = useState<SortMode>('best')
  const [bookingTutor, setBookingTutor] = useState<{
    id: string
    name: string
    services: string[]
    servicePrices: Record<string, number>
  } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
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
  }, [])

  const filterChips = useMemo(() => buildFilterChips(matches), [matches])

  const filtered = useMemo(() => {
    let result = matches

    // Filter by active chip
    if (activeFilter !== 'All') {
      result = result.filter((t) =>
        t.services.some((s) => SERVICE_LABELS[s] === activeFilter)
      )
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t) => {
        const searchable = [
          t.name,
          t.college,
          t.major,
          ...t.subjects,
          ...t.interests,
          t.teachingStyle,
          ...t.services.map((s) => SERVICE_LABELS[s] ?? s),
        ]
          .join(' ')
          .toLowerCase()
        return searchable.includes(q)
      })
    }

    // Sort
    if (sortMode === 'price-low') {
      result = [...result].sort(
        (a, b) => (getStartingPrice(a.servicePrices) ?? 999) - (getStartingPrice(b.servicePrices) ?? 999)
      )
    } else if (sortMode === 'price-high') {
      result = [...result].sort(
        (a, b) => (getStartingPrice(b.servicePrices) ?? 0) - (getStartingPrice(a.servicePrices) ?? 0)
      )
    }
    // 'best' = default API order (by match score)

    return result
  }, [matches, searchQuery, activeFilter, sortMode])

  function clearFilters() {
    setActiveFilter('All')
    setSearchQuery('')
    setSortMode('best')
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="feed-hero">
          <div className="feed-hero-k">k</div>
          <div className="feed-hero-eyebrow">Browse</div>
          <h1 className="feed-hero-title">Find Tutors</h1>
          <p className="feed-hero-desc">
            Connect with undergrads at top universities who&apos;ve done it. Real experience, proven results.
          </p>
        </div>
        <main className="feed-body">
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-purple animate-spin" />
            <p className="text-mute text-sm font-medium">Finding your best tutor matches...</p>
          </div>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="feed-hero">
          <div className="feed-hero-k">k</div>
          <div className="feed-hero-eyebrow">Browse</div>
          <h1 className="feed-hero-title">Find Tutors</h1>
          <p className="feed-hero-desc">
            Connect with undergrads at top universities who&apos;ve done it. Real experience, proven results.
          </p>
        </div>
        <main className="feed-body">
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-ink mb-2">Something went wrong</h2>
            <p className="text-mute mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-book-inline"
            >
              TRY AGAIN
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />

      {/* HERO BANNER */}
      <div className="feed-hero">
        <div className="feed-hero-k">k</div>
        <div className="feed-hero-eyebrow">Browse</div>
        <h1 className="feed-hero-title">Find Tutors</h1>
        <p className="feed-hero-desc">
          Connect with undergrads at top universities who&apos;ve done it. Real experience, proven results.
        </p>
      </div>

      {/* SEARCH + FILTERS BAR */}
      <div className="filter-bar">
        <div className="filter-top">
          <div className="search-wrap">
            <Search className="w-[18px] h-[18px] text-purple-soft flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, college, subject..."
              className="flex-1 border-none outline-none bg-transparent font-sans text-sm text-ink placeholder:text-mute"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-mute hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="sort-select"
          >
            <option value="best">Best match</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
        <div className="filter-chips">
          <span className="filter-label">Filter:</span>
          <button
            className={`chip ${activeFilter === 'All' ? 'active' : ''}`}
            onClick={() => setActiveFilter('All')}
          >
            All
          </button>
          {filterChips.map((label) => (
            <button
              key={label}
              className={`chip ${activeFilter === label ? 'active' : ''}`}
              onClick={() => setActiveFilter(label)}
            >
              {label}
            </button>
          ))}
          {(activeFilter !== 'All' || searchQuery || sortMode !== 'best') && (
            <button className="chip-clear" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* FEED BODY */}
      <div className="feed-body">
        <div className="feed-meta">
          <div className="feed-count">
            <span className="text-ink font-bold">{filtered.length}</span> tutors
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <Search className="w-12 h-12 text-mute opacity-40 mx-auto mb-4" />
            {matches.length === 0 ? (
              <p className="text-mute text-[15px]">
                We&apos;re onboarding tutors right now. Check back soon!
              </p>
            ) : (
              <p className="text-mute text-[15px]">
                No tutors match your search. Try different filters.
              </p>
            )}
          </div>
        ) : (
          <div className="tutor-grid">
            {filtered.map((tutor, idx) => {
              const photoUrl = tutor.profilePhoto
                ? `/api/storage?path=${encodeURIComponent(tutor.profilePhoto)}`
                : null
              const startPrice = getStartingPrice(tutor.servicePrices ?? {})
              const isFeatured = idx === 0 && activeFilter === 'All' && !searchQuery && sortMode === 'best'

              // Build tags: first service as primary, rest + subjects as secondary
              const serviceTags = tutor.services.map((s) => SERVICE_LABELS[s] ?? s)
              const subjectTags = tutor.subjects.slice(0, 3)

              return (
                <div
                  key={tutor.userId}
                  className={`tcard ${isFeatured ? 'featured' : ''}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {isFeatured && (
                    <div className="featured-badge">
                      <Sparkles className="w-3 h-3" /> Top Match
                    </div>
                  )}

                  {/* Header: avatar + info + price */}
                  <div className="tcard-header">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt=""
                        className="tcard-avatar-img"
                      />
                    ) : (
                      <div
                        className="tcard-avatar"
                        style={{ background: getAvatarColor(tutor.userId) }}
                      >
                        {getInitials(tutor.name)}
                      </div>
                    )}
                    <div className="tcard-info">
                      <div className="tcard-name">{tutor.name}</div>
                      <div className="tcard-school">
                        {tutor.college}
                        {tutor.major && ` · ${tutor.major}`}
                      </div>
                      {tutor.score > 0 && (
                        <div className="tcard-rating">
                          <Star className="w-[13px] h-[13px] text-amber fill-amber" />
                          <span className="tcard-score">
                            {tutor.score >= 60 ? 'Great' : tutor.score >= 35 ? 'Good' : 'Match'}
                          </span>
                          <span className="tcard-match-pct">({tutor.score}%)</span>
                        </div>
                      )}
                    </div>
                    {startPrice && (
                      <div className="tcard-price">
                        ${startPrice}
                        <span>/hr</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="tcard-tags">
                    {serviceTags.map((tag, i) => (
                      <span key={tag} className={`tcard-tag ${i > 0 ? 'secondary' : ''}`}>
                        {tag}
                      </span>
                    ))}
                    {subjectTags.map((tag) => (
                      <span key={tag} className="tcard-tag secondary">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="tcard-meta">
                    {tutor.teachingStyle && (
                      <div className="tcard-meta-row">
                        <Clock className="tcard-meta-icon w-[14px] h-[14px]" />
                        {TEACHING_STYLE_LABELS[tutor.teachingStyle] ?? tutor.teachingStyle}
                      </div>
                    )}
                    {tutor.interests.length > 0 && (
                      <div className="tcard-meta-row">
                        <Heart className="tcard-meta-icon w-[14px] h-[14px]" />
                        {tutor.interests.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Book Now */}
                  <button
                    className="btn-book"
                    onClick={() =>
                      setBookingTutor({
                        id: tutor.userId,
                        name: tutor.name,
                        services: tutor.services,
                        servicePrices: tutor.servicePrices,
                      })
                    }
                  >
                    BOOK NOW
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

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

      <style jsx>{`
        /* ── HERO BANNER ── */
        .feed-hero {
          background: linear-gradient(135deg, #82AAEE 0%, #B47AE8 52%, #E882CC 100%);
          padding: 120px 48px 48px;
          position: relative;
          overflow: hidden;
        }
        .feed-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 80% 50%, rgba(255, 255, 255, 0.18) 0%, transparent 60%);
          pointer-events: none;
        }
        .feed-hero-k {
          position: absolute;
          right: 48px;
          bottom: -16px;
          font-family: var(--font-shrikhand), 'Shrikhand', serif;
          font-size: 180px;
          color: rgba(255, 255, 255, 0.12);
          line-height: 1;
          pointer-events: none;
          user-select: none;
        }
        .feed-hero-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.75);
          margin-bottom: 10px;
          position: relative;
        }
        .feed-hero-title {
          font-family: var(--font-shrikhand), 'Shrikhand', serif;
          font-size: clamp(36px, 5vw, 64px);
          color: white;
          line-height: 1.05;
          max-width: 600px;
          margin-bottom: 14px;
          position: relative;
        }
        .feed-hero-desc {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.85);
          max-width: 480px;
          line-height: 1.6;
          position: relative;
        }

        /* ── SEARCH + FILTERS BAR ── */
        .filter-bar {
          position: sticky;
          top: 64px;
          z-index: 90;
          background: rgba(247, 245, 240, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #E6E3E8;
          padding: 16px 48px;
        }
        .filter-top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .search-wrap {
          flex: 1;
          max-width: 520px;
          height: 48px;
          border-radius: 14px;
          background: white;
          border: 1.5px solid #E6E3E8;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          box-shadow: 0 1px 2px rgba(28, 27, 31, 0.04), 0 2px 6px rgba(28, 27, 31, 0.05);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-wrap:focus-within {
          border-color: #7A62EA;
          box-shadow: 0 0 0 3px rgba(122, 98, 234, 0.12);
        }
        .sort-select {
          height: 48px;
          border-radius: 14px;
          padding: 0 16px;
          border: 1.5px solid #E6E3E8;
          background: white;
          font-family: var(--font-montserrat), 'Montserrat', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #1C1B1F;
          cursor: pointer;
          outline: none;
          box-shadow: 0 1px 2px rgba(28, 27, 31, 0.04), 0 2px 6px rgba(28, 27, 31, 0.05);
          transition: border-color 0.2s;
        }
        .sort-select:focus {
          border-color: #7A62EA;
        }

        .filter-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #8A8792;
          margin-right: 4px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .chip {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1.5px solid #E6E3E8;
          background: white;
          font-family: var(--font-montserrat), 'Montserrat', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #5A5862;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
          box-shadow: 0 1px 2px rgba(28, 27, 31, 0.04), 0 2px 6px rgba(28, 27, 31, 0.05);
        }
        .chip:hover {
          border-color: #9B86F0;
          color: #7A62EA;
        }
        .chip.active {
          background: #ECE7FC;
          border-color: #7A62EA;
          color: #7A62EA;
          font-weight: 600;
        }
        .chip-clear {
          padding: 8px 14px;
          border-radius: 999px;
          background: transparent;
          border: 1.5px solid transparent;
          font-size: 12px;
          font-weight: 600;
          color: #8A8792;
          cursor: pointer;
          transition: color 0.15s;
        }
        .chip-clear:hover {
          color: #1C1B1F;
        }

        /* ── MAIN GRID ── */
        .feed-body {
          padding: 32px 48px 80px;
          max-width: 1360px;
          margin: 0 auto;
        }
        .feed-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .feed-count {
          font-size: 14px;
          font-weight: 600;
          color: #5A5862;
        }
        .tutor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        /* ── TUTOR CARD ── */
        .tcard {
          background: white;
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 2px 4px rgba(28, 27, 31, 0.04), 0 8px 20px rgba(28, 27, 31, 0.07);
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
          cursor: pointer;
          animation: cardIn 0.4s cubic-bezier(0.2, 0, 0, 1) both;
        }
        .tcard:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(28, 27, 31, 0.1), 0 24px 56px rgba(28, 27, 31, 0.08);
        }
        .tcard:active {
          transform: scale(0.98);
        }
        @keyframes cardIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .tcard-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .tcard-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 17px;
          color: white;
        }
        .tcard-avatar-img {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
        }
        .tcard-info {
          flex: 1;
          min-width: 0;
        }
        .tcard-name {
          font-size: 16px;
          font-weight: 700;
          color: #1C1B1F;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tcard-school {
          font-size: 13px;
          color: #5A5862;
          margin-top: 2px;
        }
        .tcard-rating {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 5px;
        }
        .tcard-score {
          font-size: 13px;
          font-weight: 700;
          color: #1C1B1F;
        }
        .tcard-match-pct {
          font-size: 12px;
          color: #8A8792;
        }
        .tcard-price {
          font-size: 18px;
          font-weight: 700;
          color: #1C1B1F;
          flex-shrink: 0;
        }
        .tcard-price span {
          font-size: 12px;
          font-weight: 500;
          color: #8A8792;
        }

        .tcard-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tcard-tag {
          padding: 5px 12px;
          border-radius: 999px;
          background: #F6F3FE;
          color: #7A62EA;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .tcard-tag.secondary {
          background: #F1EFE9;
          color: #5A5862;
        }

        .tcard-meta {
          border-top: 1px solid #E6E3E8;
          padding-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .tcard-meta-row {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          color: #5A5862;
        }
        .tcard-meta-icon {
          color: #8A8792;
          flex-shrink: 0;
        }

        .btn-book {
          width: 100%;
          height: 44px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 45%, #C93FD8 100%);
          color: white;
          font-family: var(--font-montserrat), 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          box-shadow: 0 6px 16px rgba(122, 58, 232, 0.28);
          transition: transform 0.12s, opacity 0.12s;
        }
        .btn-book:hover {
          opacity: 0.9;
        }
        .btn-book:active {
          transform: scale(0.97);
        }
        .btn-book-inline {
          display: inline-block;
          padding: 12px 32px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 45%, #C93FD8 100%);
          color: white;
          font-family: var(--font-montserrat), 'Montserrat', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* ── FEATURED CARD ── */
        .tcard.featured {
          background: linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 60%, #C93FD8 100%);
          grid-column: span 2;
        }
        .tcard.featured .tcard-name {
          color: white;
        }
        .tcard.featured .tcard-school {
          color: rgba(255, 255, 255, 0.7);
        }
        .tcard.featured .tcard-score {
          color: white;
        }
        .tcard.featured .tcard-match-pct {
          color: rgba(255, 255, 255, 0.6);
        }
        .tcard.featured .tcard-price {
          color: white;
        }
        .tcard.featured .tcard-price span {
          color: rgba(255, 255, 255, 0.6);
        }
        .tcard.featured .tcard-tag {
          background: rgba(255, 255, 255, 0.18);
          color: white;
        }
        .tcard.featured .tcard-meta {
          border-color: rgba(255, 255, 255, 0.15);
        }
        .tcard.featured .tcard-meta-row {
          color: rgba(255, 255, 255, 0.75);
        }
        .tcard.featured .tcard-meta-icon {
          color: rgba(255, 255, 255, 0.5);
        }
        .tcard.featured .btn-book {
          background: white;
          color: #7A3AE8;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        .featured-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          width: fit-content;
          margin-bottom: 4px;
        }

        /* ── EMPTY STATE ── */
        .empty-state {
          text-align: center;
          padding: 80px 24px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .feed-hero {
            padding: 40px 20px 36px;
          }
          .feed-hero-k {
            font-size: 120px;
            right: 20px;
          }
          .filter-bar {
            padding: 14px 20px;
          }
          .filter-top {
            flex-direction: column;
            align-items: stretch;
          }
          .search-wrap {
            max-width: none;
          }
          .sort-select {
            width: 100%;
          }
          .feed-body {
            padding: 24px 20px 60px;
          }
          .tutor-grid {
            grid-template-columns: 1fr;
          }
          .tcard.featured {
            grid-column: span 1;
          }
        }
      `}</style>
    </>
  )
}
