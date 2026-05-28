'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Sparkles, Clock, Heart, Star } from 'lucide-react'
import {
  MobileShell,
  MobileAppBar,
  MobileTabBar,
  MOBILE_GRAD,
  MOBILE_SH2,
  type MobileTabId,
} from './mobile-shell'

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
  satScore: number | null
  actScore: number | null
  score: number
  reasons: string[]
}

const SERVICE_LABELS: Record<string, string> = {
  essays: 'Essay Writing',
  sat: 'SAT Prep',
  act: 'ACT Prep',
  activities: 'Activities',
  'sat-act': 'SAT/ACT Prep',
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
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export type FindTutorsSortMode = 'best' | 'price-low' | 'price-high'

interface Props {
  matches: TutorMatch[]
  filtered: TutorMatch[]
  filterChips: string[]
  activeFilter: string
  setActiveFilter: (label: string) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortMode: FindTutorsSortMode
  setSortMode: (mode: FindTutorsSortMode) => void
  loading: boolean
  error: string | null
  viewerSelfId: string | null
  isTutorViewer: boolean
  onOpenProfile: (t: TutorMatch) => void
  onBook: (t: TutorMatch) => void
  onClearFilters: () => void
  // Active role for the bottom nav. Students get the normal student-style nav.
  // Tutor viewers don't have a "Tutors" entry pinned; we still render the same
  // bar but mark the search tab as the current location.
}

export function MobileFindTutors({
  matches,
  filtered,
  filterChips,
  activeFilter,
  setActiveFilter,
  searchQuery,
  setSearchQuery,
  sortMode,
  setSortMode,
  loading,
  error,
  viewerSelfId,
  isTutorViewer,
  onOpenProfile,
  onBook,
  onClearFilters,
}: Props) {
  const router = useRouter()
  const activeTab: MobileTabId = 'tutors'
  const [sortOpen, setSortOpen] = React.useState(false)

  const onTabSelect = (id: MobileTabId) => {
    const studentBase = '/student/dashboard'
    if (id === 'home') router.push(studentBase)
    else if (id === 'tutors') {/* already here */}
    else if (id === 'sessions') router.push(`${studentBase}?panel=essays`)
    else if (id === 'messages') router.push(`${studentBase}?panel=messages`)
    else if (id === 'profile') router.push(`${studentBase}?panel=profile`)
  }

  const sortLabel: Record<FindTutorsSortMode, string> = {
    best: 'Best match',
    'price-low': 'Price ↑',
    'price-high': 'Price ↓',
  }

  return (
    <MobileShell>
      <MobileAppBar />

      <div style={{ padding: '8px 20px 4px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8A8792',
            marginBottom: 4,
          }}
        >
          Browse
        </div>
        <h1 style={{ fontFamily: '"Shrikhand",serif', fontSize: 32, color: '#1C1B1F', lineHeight: 1.1 }}>
          Find Tutors
        </h1>
      </div>

      {/* SEARCH */}
      <div
        style={{
          margin: '14px 16px 12px',
          height: 46,
          borderRadius: 14,
          background: '#FFFFFF',
          border: '1.5px solid #E6E3E8',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
        }}
      >
        <Search size={18} color="#7A62EA" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, college, subject…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 13,
            color: '#1C1B1F',
            height: '100%',
            minWidth: 0,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'transparent', border: 'none', color: '#8A8792', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* CHIPS */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '4px 16px 14px',
          overflowX: 'auto',
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
        }}
        className="kr-no-scrollbar"
      >
        <style>{`
          .kr-no-scrollbar::-webkit-scrollbar { display: none; }
          .kr-no-scrollbar { scrollbar-width: none; }
        `}</style>
        <Chip active={activeFilter === 'All'} onClick={() => setActiveFilter('All')}>
          All
        </Chip>
        {filterChips.map((label) => (
          <Chip key={label} active={activeFilter === label} onClick={() => setActiveFilter(label)}>
            {label}
          </Chip>
        ))}
      </div>

      {/* META ROW */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5862' }}>
          <span style={{ color: '#1C1B1F', fontWeight: 700 }}>{filtered.length}</span> tutor{filtered.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={() => setSortOpen((o) => !o)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: '#5A5862',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="9" y1="18" x2="15" y2="18" />
          </svg>
          {sortLabel[sortMode]}
        </button>
      </div>

      {sortOpen && (
        <div
          style={{
            margin: '0 16px 14px',
            background: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E6E3E8',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(28,27,31,0.08)',
          }}
        >
          {(['best', 'price-low', 'price-high'] as FindTutorsSortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setSortMode(m)
                setSortOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: sortMode === m ? 700 : 500,
                color: sortMode === m ? '#6C52E0' : '#1C1B1F',
                background: sortMode === m ? '#F6F3FE' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {sortLabel[m]}
            </button>
          ))}
        </div>
      )}

      {/* FEED */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 16px' }}>
        {loading ? (
          <EmptyMessage title="Finding your best tutor matches…" />
        ) : error ? (
          <EmptyMessage title="Something went wrong" sub={error} action="Try Again" onAction={() => window.location.reload()} />
        ) : filtered.length === 0 ? (
          matches.length === 0 ? (
            <EmptyMessage title="We're onboarding tutors right now." sub="Check back soon!" />
          ) : (
            <EmptyMessage
              title="No matches"
              sub="Try different filters."
              action="Clear filters"
              onAction={onClearFilters}
            />
          )
        ) : (
          filtered.map((tutor, idx) => {
            const photoUrl = tutor.profilePhoto ? `/api/storage?path=${encodeURIComponent(tutor.profilePhoto)}` : null
            const startPrice = getStartingPrice(tutor.servicePrices ?? {})
            const isFeatured = idx === 0 && activeFilter === 'All' && !searchQuery && sortMode === 'best'
            const isSelf = tutor.userId === viewerSelfId
            const serviceTags = tutor.services.map((s) => SERVICE_LABELS[s] ?? s)
            const subjectTags = tutor.subjects.slice(0, 2)

            return (
              <TutorCard
                key={tutor.userId}
                tutor={tutor}
                photoUrl={photoUrl}
                startPrice={startPrice}
                isFeatured={isFeatured}
                isSelf={isSelf}
                isTutorViewer={isTutorViewer}
                serviceTags={serviceTags}
                subjectTags={subjectTags}
                onClick={() => onOpenProfile(tutor)}
                onBook={() => onBook(tutor)}
              />
            )
          })
        )}
      </div>

      <div style={{ height: 16 }} />

      <MobileTabBar
        items={[
          { id: 'home', label: 'Home', icon: 'home' },
          { id: 'tutors', label: 'Tutors', icon: 'search' },
          { id: 'sessions', label: 'Sessions', icon: 'calendar' },
          { id: 'messages', label: 'Messages', icon: 'msg' },
          { id: 'profile', label: 'Profile', icon: 'profile' },
        ]}
        activeId={activeTab}
        onSelect={onTabSelect}
      />
    </MobileShell>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 999,
        border: `1.5px solid ${active ? '#BDB0F5' : '#E6E3E8'}`,
        background: active ? '#ECE7FC' : '#FFFFFF',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        color: active ? '#6C52E0' : '#5A5862',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function TutorCard({
  tutor,
  photoUrl,
  startPrice,
  isFeatured,
  isSelf,
  isTutorViewer,
  serviceTags,
  subjectTags,
  onClick,
  onBook,
}: {
  tutor: TutorMatch
  photoUrl: string | null
  startPrice: number | null
  isFeatured: boolean
  isSelf: boolean
  isTutorViewer: boolean
  serviceTags: string[]
  subjectTags: string[]
  onClick: () => void
  onBook: () => void
}) {
  const baseBg = isFeatured
    ? 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 60%,#C93FD8 100%)'
    : '#FFFFFF'
  const inkColor = isFeatured ? 'white' : '#1C1B1F'
  const subColor = isFeatured ? 'rgba(255,255,255,0.75)' : '#5A5862'
  const muteColor = isFeatured ? 'rgba(255,255,255,0.65)' : '#8A8792'
  const hairColor = isFeatured ? 'rgba(255,255,255,0.18)' : '#E6E3E8'
  const tagBg = isFeatured ? 'rgba(255,255,255,0.2)' : '#F6F3FE'
  const tagFg = isFeatured ? 'white' : '#6C52E0'
  const tagBgSec = isFeatured ? 'rgba(255,255,255,0.12)' : '#F1EFE9'
  const tagFgSec = isFeatured ? 'rgba(255,255,255,0.85)' : '#5A5862'

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        background: baseBg,
        color: inkColor,
        borderRadius: 18,
        padding: 16,
        boxShadow: MOBILE_SH2,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {isFeatured && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: 'white',
            width: 'fit-content',
            marginBottom: -4,
          }}
        >
          <Sparkles size={12} /> {isSelf ? 'Your Profile' : 'Top Match'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 16,
              background: isFeatured ? 'rgba(255,255,255,0.25)' : getAvatarColor(tutor.userId),
            }}
          >
            {getInitials(tutor.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: inkColor }}>{tutor.name}</div>
          <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {tutor.college}
            {tutor.major && ` · ${tutor.major}`}
          </div>
          {tutor.score > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
              <Star size={12} color="#F5C242" fill="#F5C242" />
              <span style={{ fontSize: 12, fontWeight: 700, color: inkColor }}>
                {tutor.score >= 60 ? 'Great' : tutor.score >= 35 ? 'Good' : 'Match'}
              </span>
              <span style={{ fontSize: 11, color: muteColor }}>({tutor.score}%)</span>
            </div>
          )}
        </div>
        {startPrice !== null && (
          <div style={{ fontSize: 17, fontWeight: 700, color: inkColor, flexShrink: 0 }}>
            ${startPrice}
            <span style={{ fontSize: 11, color: muteColor, fontWeight: 500 }}>/hr</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {serviceTags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: i === 0 ? tagBg : tagBgSec,
              color: i === 0 ? tagFg : tagFgSec,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {tag}
          </span>
        ))}
        {subjectTags.map((tag) => (
          <span
            key={tag}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: tagBgSec,
              color: tagFgSec,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {(tutor.teachingStyle || tutor.interests.length > 0) && (
        <div
          style={{
            borderTop: `1px solid ${hairColor}`,
            paddingTop: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {tutor.teachingStyle && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: subColor }}>
              <Clock size={13} color={muteColor} style={{ flexShrink: 0 }} />
              {TEACHING_STYLE_LABELS[tutor.teachingStyle] ?? tutor.teachingStyle}
            </div>
          )}
          {tutor.interests.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: subColor }}>
              <Heart size={13} color={muteColor} style={{ flexShrink: 0 }} />
              {tutor.interests.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      )}

      {!isTutorViewer ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBook()
          }}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            background: isFeatured ? 'white' : MOBILE_GRAD,
            color: isFeatured ? '#6C52E0' : 'white',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: isFeatured ? '0 6px 20px rgba(0,0,0,0.2)' : '0 6px 14px rgba(122,58,232,0.28)',
          }}
        >
          Book Now
        </button>
      ) : (
        <button
          disabled
          style={{
            width: '100%',
            height: 44,
            borderRadius: 999,
            border: 'none',
            cursor: 'not-allowed',
            background: isFeatured ? 'rgba(255,255,255,0.85)' : '#ECE7FC',
            color: isFeatured ? '#7A3AE8' : '#6C52E0',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {isSelf ? 'Your Profile' : 'Preview Only'}
        </button>
      )}
    </div>
  )
}

function EmptyMessage({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 24px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1B1F' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: '#8A8792', marginTop: 6 }}>{sub}</div>}
      {action && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 16,
            padding: '10px 22px',
            borderRadius: 999,
            border: 'none',
            background: MOBILE_GRAD,
            color: 'white',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

