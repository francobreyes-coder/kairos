'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { DEFAULT_TIMEZONE, convertSlotToTimezone } from '@/lib/timezone'
import {
  MobileShell,
  MobileAppBar,
  MobileTabBar,
  MOBILE_GRAD,
  MOBILE_GRAD_SOFT,
  MOBILE_SH1,
  type MobileTabId,
} from './mobile-shell'
import { MobileMessages } from './mobile-messages'
import { MobileStudentProfile } from './mobile-student-profile'
import { MessagesErrorBoundary } from './messages-error-boundary'

// Mirror just enough of the dashboard's data shapes to render the screen.
interface ApiSession {
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

interface AssignedTest {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  created_at: string
  tutor_name: string | null
  // Newer endpoints decorate each test with the student's latest attempt so
  // the card can show the score and route to review instead of restart.
  // Optional so older callers (and the not-yet-attempted case) still type-check.
  last_attempt?: {
    id: string
    correct_count: number
    total_count: number
    submitted_at: string
  } | null
  attempt_count?: number
}

interface ApiConversation {
  partner_id: string
  partner_name: string
  last_message: string
  last_message_at: string
  last_message_is_mine: boolean
}

const AVATAR_PALETTE = ['#6C52E0', '#7A62EA', '#9B86F0', '#B47AE8', '#8177C9', '#7A3AE8', '#BDB0F5', '#5B24CC']
function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function sessionSourceTz(s: ApiSession): string {
  return s.timezone || DEFAULT_TIMEZONE
}
function sessionStartUtc(s: ApiSession): Date | null {
  return convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), 'UTC')?.utc ?? null
}
function isUpcoming(s: ApiSession): boolean {
  if (s.status !== 'confirmed') return false
  const start = sessionStartUtc(s)
  if (!start) return false
  return start.getTime() + 60 * 60 * 1000 >= Date.now()
}
function isPast(s: ApiSession): boolean {
  if (s.status !== 'confirmed') return true
  const start = sessionStartUtc(s)
  if (!start) return true
  return start.getTime() + 60 * 60 * 1000 < Date.now()
}

function whenChip(s: ApiSession, viewerTz: string): { day: string; time: string } {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  if (!converted) return { day: s.scheduled_date, time: s.time_slot }
  const ymdInTz = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: viewerTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const todayStr = ymdInTz(new Date())
  const tomorrowStr = ymdInTz(new Date(Date.now() + 86400000))
  let day: string
  if (converted.date === todayStr) day = 'Today'
  else if (converted.date === tomorrowStr) day = 'Tomorrow'
  else day = new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, weekday: 'short' }).format(converted.utc)
  return { day, time: converted.time }
}

function whenSentence(s: ApiSession, viewerTz: string): string {
  const { day, time } = whenChip(s, viewerTz)
  if (day === 'Today' || day === 'Tomorrow') return `${day.toLowerCase()} at ${time}`
  return `${day} at ${time}`
}

interface Props {
  firstName: string
  fullName: string
  email: string
  profilePhoto: string
  pendingPartnerId: string | null
  panel: 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'settings' | 'profile'
  setPanel: (p: 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'settings' | 'profile') => void
  tests: AssignedTest[]
  sessions: ApiSession[]
  conversations: ApiConversation[]
  onStartTest: (id: string) => void
  onJoinSession: (id: string) => void
  onPhotoChange: (path: string) => void
  onNameChange: (name: string) => void
}

const PANEL_TO_TAB: Record<Props['panel'], MobileTabId> = {
  home: 'home',
  essays: 'sessions',
  testing: 'sessions',
  activities: 'sessions',
  messages: 'messages',
  settings: 'profile',
  profile: 'profile',
}

export function MobileStudentDashboard({
  firstName,
  fullName,
  email,
  profilePhoto,
  pendingPartnerId,
  panel,
  setPanel,
  tests,
  sessions,
  conversations,
  onStartTest,
  onJoinSession,
  onPhotoChange,
  onNameChange,
}: Props) {
  const router = useRouter()
  const viewerTz = useViewerTimezone()
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)
  const nextSession = upcoming[0]
  const counterpart = (s: ApiSession) => (s.is_tutor ? s.student_name : s.tutor_name)
  const hasMessages = conversations.some((c) => !c.last_message_is_mine)

  const activeTab: MobileTabId = PANEL_TO_TAB[panel] ?? 'home'

  const onTabSelect = (id: MobileTabId) => {
    if (id === 'home') setPanel('home')
    else if (id === 'tutors') router.push('/find-tutors')
    else if (id === 'sessions') setPanel('essays')
    else if (id === 'messages') setPanel('messages')
    else if (id === 'profile') setPanel('profile')
  }

  return (
    <MobileShell>
      <MobileAppBar hasNotifDot={hasMessages || upcoming.length > 0} />

      {activeTab === 'home' && (
        <HomeBody
          firstName={firstName}
          nextSession={nextSession}
          counterpartOf={counterpart}
          viewerTz={viewerTz}
          tests={tests}
          upcoming={upcoming}
          conversations={conversations}
          onJoinSession={onJoinSession}
          onStartTest={onStartTest}
          onShowAllSessions={() => setPanel('essays')}
          onShowAllTests={() => setPanel('testing')}
        />
      )}

      {activeTab === 'sessions' && (
        <SessionsBody
          upcoming={upcoming}
          past={past}
          counterpartOf={counterpart}
          viewerTz={viewerTz}
          onJoinSession={onJoinSession}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesErrorBoundary label="messages tab">
          <MobileMessages
            myFullName={fullName}
            myPhoto={profilePhoto || null}
            partnerLabel="Conversations"
            initialPartnerId={pendingPartnerId}
          />
        </MessagesErrorBoundary>
      )}

      {activeTab === 'profile' && (
        <MobileStudentProfile
          sessionName={fullName}
          sessionEmail={email}
          onPhotoChange={onPhotoChange}
          onNameChange={onNameChange}
        />
      )}

      <MobileTabBar
        items={[
          { id: 'home', label: 'Home', icon: 'home' },
          { id: 'tutors', label: 'Tutors', icon: 'search' },
          { id: 'sessions', label: 'Sessions', icon: 'calendar' },
          { id: 'messages', label: 'Messages', icon: 'msg', badge: hasMessages },
          { id: 'profile', label: 'Profile', icon: 'profile' },
        ]}
        activeId={activeTab}
        onSelect={onTabSelect}
      />
    </MobileShell>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Home tab — mirrors mobile/Student Dashboard.html structure.
// ──────────────────────────────────────────────────────────────────────
function HomeBody({
  firstName,
  nextSession,
  counterpartOf,
  viewerTz,
  tests,
  upcoming,
  conversations,
  onJoinSession,
  onStartTest,
  onShowAllSessions,
  onShowAllTests,
}: {
  firstName: string
  nextSession: ApiSession | undefined
  counterpartOf: (s: ApiSession) => string
  viewerTz: string
  tests: AssignedTest[]
  upcoming: ApiSession[]
  conversations: ApiConversation[]
  onJoinSession: (id: string) => void
  onStartTest: (id: string) => void
  onShowAllSessions: () => void
  onShowAllTests: () => void
}) {
  return (
    <>
      {/* HERO */}
      <section
        style={{
          margin: '6px 16px 18px',
          borderRadius: 22,
          background: MOBILE_GRAD_SOFT,
          padding: '22px 22px 24px',
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -8,
            bottom: -30,
            fontFamily: '"Shrikhand",serif',
            fontSize: 160,
            color: 'rgba(255,255,255,0.13)',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          k
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.78)',
            marginBottom: 8,
          }}
        >
          Hey, {firstName}
        </div>
        <h1
          style={{
            fontFamily: '"Shrikhand",serif',
            fontSize: 30,
            lineHeight: 1.1,
            marginBottom: 8,
            color: 'white',
            position: 'relative',
          }}
        >
          Ready to move<br />
          forward?
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.9)', maxWidth: 280, position: 'relative' }}>
          {nextSession ? (
            <>
              Your next session with{' '}
              <strong style={{ color: 'white' }}>{counterpartOf(nextSession)}</strong> is{' '}
              {whenSentence(nextSession, viewerTz)}.
            </>
          ) : (
            <>No upcoming sessions yet — find a tutor to get started.</>
          )}
        </p>

        {nextSession && (
          <div
            style={{
              marginTop: 18,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 16,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
            }}
          >
            <Avatar
              initials={initialsOf(counterpartOf(nextSession))}
              color={avatarColor(nextSession.id)}
              size={42}
              border
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                {nextSession.notes || (nextSession.is_tutor ? 'Tutoring session' : 'Tutoring session')}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>
                {whenChip(nextSession, viewerTz).day} · {whenChip(nextSession, viewerTz).time}
              </div>
            </div>
            <button
              onClick={() => onJoinSession(nextSession.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: 'white',
                color: '#6C52E0',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
              Join
            </button>
          </div>
        )}
      </section>

      {/* GET HELP WITH */}
      <SectionContainer>
        <SectionHead title="Get help with" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <HelpTile
            label="Essays"
            sub={`${conversations.length} tutor${conversations.length === 1 ? '' : 's'}`}
            onClick={onShowAllSessions}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            }
          />
          <HelpTile
            label="Test Prep"
            sub={tests.length === 0 ? 'None yet' : `${tests.length} assigned`}
            onClick={onShowAllTests}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            }
          />
          <HelpTile
            label="Activities"
            sub={`${upcoming.length} upcoming`}
            onClick={onShowAllSessions}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            }
          />
        </div>
      </SectionContainer>

      {/* UPCOMING SESSIONS */}
      <SectionContainer>
        <SectionHead title="Upcoming sessions" action={upcoming.length > 0 ? 'View all' : undefined} onAction={onShowAllSessions} />
        <Card>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming sessions" sub="Book one from Find Tutors." />
          ) : (
            upcoming.slice(0, 3).map((s) => {
              const chip = whenChip(s, viewerTz)
              return (
                <div
                  key={s.id}
                  onClick={() => onJoinSession(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 0',
                    borderBottom: '1px solid #E6E3E8',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar initials={initialsOf(counterpartOf(s))} color={avatarColor(s.id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{counterpartOf(s)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#5A5862',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.notes || 'Tutoring session'}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5A5862' }}>{chip.day}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6C52E0' }}>{chip.time}</span>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </SectionContainer>

      {/* PRACTICE TESTS / ASSIGNMENTS */}
      <SectionContainer>
        <SectionHead title="Your assignments" action={tests.length > 0 ? 'View all' : undefined} onAction={onShowAllTests} />
        <Card>
          {tests.length === 0 ? (
            <EmptyState title="No assignments yet" sub="Your tutor will post practice tests here." />
          ) : (
            tests.slice(0, 3).map((t) => {
              const la = t.last_attempt ?? null
              const pct = la && la.total_count > 0
                ? Math.round((la.correct_count / la.total_count) * 100)
                : null
              const href = la
                ? `/student/tests/${t.id}?review=${la.id}`
                : `/student/tests/${t.id}`
              const badgeColor: 'green' | 'amber' | 'pink' | 'purple' = pct === null
                ? 'purple'
                : pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'pink'
              const badgeLabel = pct === null ? t.exam_type : `${pct}%`
              return (
                <a
                  key={t.id}
                  href={href}
                  style={{
                    display: 'block',
                    padding: '14px 0',
                    borderBottom: '1px solid #E6E3E8',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F', lineHeight: 1.35, flex: 1 }}>
                      {t.name}
                    </div>
                    <Pill color={badgeColor}>{badgeLabel}</Pill>
                  </div>
                  <div style={{ fontSize: 10, color: '#8A8792', marginTop: 4 }}>
                    {la
                      ? `${la.correct_count}/${la.total_count} correct · tap to review`
                      : `${t.tutor_name ? `Assigned by ${t.tutor_name}` : 'Assignment'} · ${t.question_count} questions`}
                  </div>
                </a>
              )
            })
          )}
        </Card>
      </SectionContainer>
    </>
  )
}

function SessionsBody({
  upcoming,
  past,
  counterpartOf,
  viewerTz,
  onJoinSession,
}: {
  upcoming: ApiSession[]
  past: ApiSession[]
  counterpartOf: (s: ApiSession) => string
  viewerTz: string
  onJoinSession: (id: string) => void
}) {
  return (
    <>
      <SectionContainer>
        <SectionHead title={`Upcoming · ${upcoming.length}`} />
        <Card>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming sessions" />
          ) : (
            upcoming.map((s) => {
              const chip = whenChip(s, viewerTz)
              return (
                <div
                  key={s.id}
                  onClick={() => onJoinSession(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 0',
                    borderBottom: '1px solid #E6E3E8',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar initials={initialsOf(counterpartOf(s))} color={avatarColor(s.id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{counterpartOf(s)}</div>
                    <div style={{ fontSize: 11, color: '#5A5862', marginTop: 2 }}>{s.notes || 'Tutoring session'}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5A5862' }}>{chip.day}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6C52E0' }}>{chip.time}</span>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </SectionContainer>

      <SectionContainer>
        <SectionHead title={`Past · ${past.length}`} />
        <Card>
          {past.length === 0 ? (
            <EmptyState title="No past sessions yet" />
          ) : (
            past.slice(0, 8).map((s) => {
              const chip = whenChip(s, viewerTz)
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 0',
                    borderBottom: '1px solid #E6E3E8',
                  }}
                >
                  <Avatar initials={initialsOf(counterpartOf(s))} color={avatarColor(s.id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{counterpartOf(s)}</div>
                    <div style={{ fontSize: 11, color: '#5A5862', marginTop: 2 }}>{s.notes || 'Tutoring session'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8792' }}>{chip.day}</span>
                </div>
              )
            })
          )}
        </Card>
      </SectionContainer>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Small UI primitives reused above.
// ──────────────────────────────────────────────────────────────────────
function SectionContainer({ children }: { children: React.ReactNode }) {
  return <section style={{ padding: '0 16px', marginBottom: 22 }}>{children}</section>
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
        padding: '0 2px',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1B1F', letterSpacing: '-0.01em' }}>{title}</div>
      {action && (
        <button
          onClick={onAction}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#7A62EA',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '4px 16px',
        boxShadow: MOBILE_SH1,
      }}
    >
      {children}
    </div>
  )
}

function HelpTile({ label, sub, icon, onClick }: { label: string; sub: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '14px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        boxShadow: MOBILE_SH1,
        textAlign: 'center',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: '#F6F3FE',
          color: '#6C52E0',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1B1F' }}>{label}</div>
      <div style={{ fontSize: 10, color: '#8A8792', fontWeight: 500 }}>{sub}</div>
    </button>
  )
}

function Avatar({ initials, color, size = 40, border = false }: { initials: string; color: string; size?: number; border?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: color,
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size * 0.32,
        border: border ? '2px solid rgba(255,255,255,0.35)' : undefined,
      }}
    >
      {initials}
    </div>
  )
}

type PillColor = 'purple' | 'amber' | 'green' | 'mute' | 'pink'
function Pill({ children, color = 'purple' }: { children: React.ReactNode; color?: PillColor }) {
  const palette: Record<PillColor, { bg: string; fg: string }> = {
    purple: { bg: '#ECE7FC', fg: '#6C52E0' },
    amber: { bg: '#FEF3CD', fg: '#A06B00' },
    green: { bg: '#D6F5E8', fg: '#1E7A4F' },
    mute: { bg: '#F1EFE9', fg: '#5A5862' },
    pink: { bg: '#FCE7F8', fg: '#A0219E' },
  }
  const s = palette[color]
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
      }}
    >
      {children}
    </span>
  )
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '22px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: '#8A8792', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

