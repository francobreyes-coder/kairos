'use client'

import * as React from 'react'
import { TrendingUp } from 'lucide-react'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { DEFAULT_TIMEZONE, convertSlotToTimezone, isWithinSessionWindow } from '@/lib/timezone'
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
import { MobileTutorProfile } from './mobile-tutor-profile'

export type TutorPanelId = 'home' | 'sessions' | 'earnings' | 'analytics' | 'messages' | 'profile'

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
  student_sub: string
  timezone: string | null
}

interface DashboardStats {
  totalEarnings: number
  earningsPerSession: number
  earningsThisWeek: number
  pendingEarnings: number
  upcomingCount: number
  completedCount: number
  totalSessions: number
  uniqueStudents: number
  repeatRate: number
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

interface TopStudent {
  id: string
  name: string
  sub: string
  count: number
}

interface Bar {
  label: string
  val: number
}

interface DashboardData {
  profile: TutorProfile
  stats: DashboardStats
  upcoming: DashboardSession[]
  past: DashboardSession[]
  weekly: Bar[]
  monthly: Bar[]
  monthlySessions: Bar[]
  topStudents: TopStudent[]
}

const AVATAR_PALETTE = ['#7A62EA', '#9B86F0', '#B47AE8', '#6C52E0', '#8177C9', '#E882CC', '#82AAEE']
function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}
function sessionSourceTz(s: { timezone?: string | null }): string {
  return s.timezone || DEFAULT_TIMEZONE
}
function whenChip(s: DashboardSession, viewerTz: string): { day: string; time: string } {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  if (!converted) return { day: s.scheduled_date, time: s.time_slot }
  const ymdInTz = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: viewerTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const todayStr = ymdInTz(new Date())
  const tomorrowStr = ymdInTz(new Date(Date.now() + 86400000))
  let day: string
  if (converted.date === todayStr) day = 'Today'
  else if (converted.date === tomorrowStr) day = 'Tomorrow'
  else day = new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, weekday: 'short', month: 'short', day: 'numeric' }).format(converted.utc)
  return { day, time: converted.time }
}
function nextSessionSentence(sessions: DashboardSession[], viewerTz: string): string {
  if (sessions.length === 0) return 'No upcoming sessions yet.'
  const s = sessions[0]
  const { day, time } = whenChip(s, viewerTz)
  return `Next one is ${day.toLowerCase()} at ${time} with ${s.student_name}.`
}

const PANEL_TO_TAB: Record<TutorPanelId, MobileTabId> = {
  home: 'home',
  sessions: 'sessions',
  earnings: 'earnings',
  analytics: 'earnings',
  messages: 'messages',
  profile: 'profile',
}

interface Props {
  data: DashboardData
  panel: TutorPanelId
  setPanel: (p: TutorPanelId) => void
  onJoinSession: (id: string) => void
  onSaveProfile: (patch: Partial<TutorProfile>) => Promise<void>
  savingProfile: boolean
  onSavePrices: (prices: Record<string, number>) => Promise<void>
  savingPrices: boolean
  onSaveAvailability: (a: Record<string, string[]>) => Promise<void>
  savingAvailability: boolean
}

export function MobileTutorDashboard({
  data,
  panel,
  setPanel,
  onJoinSession,
  onSaveProfile,
  savingProfile,
  onSavePrices,
  savingPrices,
  onSaveAvailability,
  savingAvailability,
}: Props) {
  const viewerTz = useViewerTimezone()
  const activeTab: MobileTabId = PANEL_TO_TAB[panel] ?? 'home'
  const onTabSelect = (id: MobileTabId) => {
    if (id === 'home') setPanel('home')
    else if (id === 'sessions') setPanel('sessions')
    else if (id === 'earnings') setPanel('earnings')
    else if (id === 'messages') setPanel('messages')
    else if (id === 'profile') setPanel('profile')
  }

  return (
    <MobileShell>
      <MobileAppBar hasNotifDot={data.stats.upcomingCount > 0} />

      {activeTab === 'home' && (
        <HomeBody data={data} viewerTz={viewerTz} onJoinSession={onJoinSession} setPanel={setPanel} />
      )}

      {activeTab === 'sessions' && (
        <SessionsBody upcoming={data.upcoming} past={data.past} viewerTz={viewerTz} onJoinSession={onJoinSession} />
      )}

      {activeTab === 'earnings' && (
        <EarningsBody data={data} />
      )}

      {activeTab === 'messages' && (
        <MobileMessages
          myFullName={data.profile.name}
          myPhoto={data.profile.profile_photo}
          partnerLabel="Students"
        />
      )}

      {activeTab === 'profile' && (
        <MobileTutorProfile
          profile={data.profile}
          onSaveProfile={onSaveProfile}
          savingProfile={savingProfile}
          onSavePrices={onSavePrices}
          savingPrices={savingPrices}
          onSaveAvailability={onSaveAvailability}
          savingAvailability={savingAvailability}
        />
      )}

      <MobileTabBar
        items={[
          { id: 'home', label: 'Home', icon: 'home' },
          { id: 'sessions', label: 'Sessions', icon: 'calendar' },
          { id: 'earnings', label: 'Earnings', icon: 'dollar' },
          { id: 'messages', label: 'Messages', icon: 'msg' },
          { id: 'profile', label: 'Profile', icon: 'profile' },
        ]}
        activeId={activeTab}
        onSelect={onTabSelect}
      />
    </MobileShell>
  )
}

function HomeBody({
  data,
  viewerTz,
  onJoinSession,
  setPanel,
}: {
  data: DashboardData
  viewerTz: string
  onJoinSession: (id: string) => void
  setPanel: (p: TutorPanelId) => void
}) {
  const { profile, stats, upcoming, weekly, topStudents } = data
  const firstName = profile.name.split(' ')[0] || 'there'
  const weekTotal = weekly.reduce((a, d) => a + d.val, 0)
  const allTime = stats.totalEarnings
  const pctDelta = allTime - weekTotal > 0 ? Math.round((weekTotal / (allTime - weekTotal)) * 100) : null

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
          Welcome back
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
          Hey, {firstName}
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.9)', maxWidth: 280, position: 'relative' }}>
          You have <strong style={{ color: 'white' }}>{stats.upcomingCount} session{stats.upcomingCount === 1 ? '' : 's'}</strong> this week. {nextSessionSentence(upcoming, viewerTz)}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 20,
            position: 'relative',
          }}
        >
          <Stat n={String(stats.upcomingCount)} l="This week" />
          <Stat n={formatCurrency(weekTotal)} l="Earnings" />
          <Stat n={String(stats.uniqueStudents)} l="Students" />
        </div>
      </section>

      {/* UPCOMING SESSIONS */}
      <SectionContainer>
        <SectionHead title="Upcoming sessions" action={upcoming.length > 0 ? 'View all' : undefined} onAction={() => setPanel('sessions')} />
        <Card>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming sessions" sub="Students can book you from Find Tutors." />
          ) : (
            upcoming.slice(0, 3).map((s) => {
              const chip = whenChip(s, viewerTz)
              const canStart = isWithinSessionWindow(s.scheduled_date, s.time_slot, sessionSourceTz(s))
              const earn = parseFloat(String(s.price)) || 0
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
                  <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{s.student_name}</div>
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
                      {s.notes || (s.student_sub ? s.student_sub : 'Tutoring session')}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5A5862' }}>
                      {chip.day} · {chip.time}
                    </span>
                    {canStart ? (
                      <button
                        onClick={() => onJoinSession(s.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: 'none',
                          background: MOBILE_GRAD,
                          color: 'white',
                          fontFamily: 'inherit',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21" />
                        </svg>
                        Start
                      </button>
                    ) : earn > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2FA46A' }}>+${Math.round(earn)}</span>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </SectionContainer>

      {/* EARNINGS */}
      <SectionContainer>
        <SectionHead title="This week's earnings" action="Details" onAction={() => setPanel('earnings')} />
        <Card padded>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 0 10px' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1B1F' }}>{formatCurrency(weekTotal)}</div>
              <div style={{ fontSize: 11, color: '#8A8792', marginTop: 2 }}>{formatCurrency(allTime)} earned all time</div>
            </div>
            {pctDelta !== null && (
              <div style={{ fontSize: 11, fontWeight: 600, color: '#2FA46A', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <TrendingUp size={12} /> +{pctDelta}%
              </div>
            )}
          </div>
          <Bars data={weekly} />
        </Card>
      </SectionContainer>

      {/* TOP STUDENTS (in place of reviews — we don't store reviews) */}
      <SectionContainer>
        <SectionHead title="Top students" action={topStudents.length > 0 ? 'See all' : undefined} onAction={() => setPanel('sessions')} />
        <Card padded>
          {topStudents.length === 0 ? (
            <EmptyState title="No completed sessions yet" sub="Your top students will appear here." />
          ) : (
            topStudents.slice(0, 4).map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #E6E3E8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Avatar initials={initialsOf(t.name)} color={avatarColor(t.id)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{t.name}</div>
                  {t.sub && <div style={{ fontSize: 11, color: '#8A8792' }}>{t.sub}</div>}
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#ECE7FC',
                    color: '#6C52E0',
                  }}
                >
                  {t.count} session{t.count === 1 ? '' : 's'}
                </span>
              </div>
            ))
          )}
        </Card>
      </SectionContainer>
    </>
  )
}

function SessionsBody({
  upcoming,
  past,
  viewerTz,
  onJoinSession,
}: {
  upcoming: DashboardSession[]
  past: DashboardSession[]
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
              const canStart = isWithinSessionWindow(s.scheduled_date, s.time_slot, sessionSourceTz(s))
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
                  <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{s.student_name}</div>
                    <div style={{ fontSize: 11, color: '#5A5862', marginTop: 2 }}>
                      {chip.day} · {chip.time}
                    </div>
                  </div>
                  {canStart && (
                    <button
                      onClick={() => onJoinSession(s.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: 'none',
                        background: MOBILE_GRAD,
                        color: 'white',
                        fontFamily: 'inherit',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Start
                    </button>
                  )}
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
              const earn = parseFloat(String(s.price)) || 0
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
                  <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{s.student_name}</div>
                    <div style={{ fontSize: 11, color: '#5A5862', marginTop: 2 }}>
                      {chip.day} · {chip.time}
                    </div>
                  </div>
                  {earn > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#2FA46A' }}>+${Math.round(earn)}</span>}
                </div>
              )
            })
          )}
        </Card>
      </SectionContainer>
    </>
  )
}

function EarningsBody({ data }: { data: DashboardData }) {
  const { stats, weekly } = data
  const weekTotal = weekly.reduce((a, d) => a + d.val, 0)
  return (
    <>
      <SectionContainer>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MiniStatCard label="Total earned" value={formatCurrency(stats.totalEarnings)} accent />
          <MiniStatCard label="This week" value={formatCurrency(weekTotal)} />
          <MiniStatCard label="Pending" value={formatCurrency(stats.pendingEarnings)} />
          <MiniStatCard label="Avg / session" value={formatCurrency(stats.earningsPerSession)} />
        </div>
      </SectionContainer>

      <SectionContainer>
        <SectionHead title="This week" />
        <Card padded>
          <Bars data={weekly} />
        </Card>
      </SectionContainer>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Primitives
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

function Card({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: padded ? 16 : '4px 16px',
        boxShadow: MOBILE_SH1,
      }}
    >
      {children}
    </div>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 12,
        padding: '10px 12px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: 'white', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.78)', marginTop: 4, fontWeight: 600, letterSpacing: '0.02em' }}>
        {l}
      </div>
    </div>
  )
}

function MiniStatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? MOBILE_GRAD : '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        boxShadow: MOBILE_SH1,
        color: accent ? 'white' : '#1C1B1F',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6, color: accent ? 'rgba(255,255,255,0.78)' : '#8A8792' }}>
        {label}
      </div>
    </div>
  )
}

function Bars({ data }: { data: Bar[] }) {
  const max = Math.max(...data.map((d) => d.val), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, paddingTop: 8 }}>
      {data.map((d, i) => {
        const pct = Math.max((d.val / max) * 100, 4)
        const empty = d.val === 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6C52E0' }}>
              {empty ? '' : `$${Math.round(d.val)}`}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 22,
                borderRadius: 6,
                background: empty ? '#E6E3E8' : MOBILE_GRAD,
                flex: 1,
                marginTop: 'auto',
                height: `${pct}%`,
              }}
            />
            <span style={{ fontSize: 9, color: '#8A8792', fontWeight: 600 }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function Avatar({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
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
      }}
    >
      {initials}
    </div>
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
