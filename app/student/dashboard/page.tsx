'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { StudentSidebar, type SidebarItemId } from '@/components/student-sidebar'
import { PhotoCropModal } from '@/components/photo-crop-modal'
import { DEFAULT_TIMEZONE, convertSlotToTimezone } from '@/lib/timezone'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { TimezoneSelector } from '@/components/timezone-selector'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MobileStudentDashboard } from '@/components/mobile-student-dashboard'
import { getBrowserSupabase } from '@/lib/supabase-browser'

// ═══════════════════════════════════════════════════════════════════════
//  Design tokens (scoped to dashboard via :root override on the wrapper)
// ═══════════════════════════════════════════════════════════════════════
const DASH_VARS: CSSProperties = {
  ['--p900' as string]: '#2A1B6B',
  ['--p700' as string]: '#4B38B3',
  ['--p600' as string]: '#6C52E0',
  ['--p500' as string]: '#7A62EA',
  ['--p400' as string]: '#9B86F0',
  ['--p300' as string]: '#BDB0F5',
  ['--p200' as string]: '#D9D0FA',
  ['--p100' as string]: '#ECE7FC',
  ['--p050' as string]: '#F6F3FE',
  ['--ink' as string]: '#1C1B1F',
  ['--ink2' as string]: '#2E2C34',
  ['--graphite' as string]: '#5A5862',
  ['--mute' as string]: '#8A8792',
  ['--hair' as string]: '#E6E3E8',
  ['--s2' as string]: '#F1EFE9',
  ['--s1' as string]: '#F7F5F0',
  ['--s0' as string]: '#FFFFFF',
  ['--amber' as string]: '#F5C242',
  ['--success' as string]: '#2FA46A',
  ['--grad' as string]: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
  ['--gradsoft' as string]: 'linear-gradient(135deg,#82AAEE 0%,#B47AE8 52%,#E882CC 100%)',
  ['--sh1' as string]: '0 1px 2px rgba(28,27,31,.04),0 2px 6px rgba(28,27,31,.05)',
  ['--sh2' as string]: '0 2px 4px rgba(28,27,31,.04),0 8px 20px rgba(28,27,31,.07)',
  ['--ease' as string]: 'cubic-bezier(.2,.0,.0,1)',
}

// ═══════════════════════════════════════════════════════════════════════
//  Icons
// ═══════════════════════════════════════════════════════════════════════
const Icon = {
  cal: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: 'middle' }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  play: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
  ),
  bell: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  ),
  search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
}

// ═══════════════════════════════════════════════════════════════════════
//  Shared building blocks
// ═══════════════════════════════════════════════════════════════════════
const AVATAR_PALETTE = ['#6C52E0', '#7A62EA', '#9B86F0', '#B47AE8', '#8177C9', '#7A3AE8', '#BDB0F5', '#5B24CC']

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ initials, color, size = 44 }: { initials: string; color?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color || '#7A62EA', color: 'white',
      display: 'grid', placeItems: 'center',
      fontWeight: 700, fontSize: size * 0.32,
    }}>{initials}</div>
  )
}

type PillColor = 'purple' | 'green' | 'amber' | 'mute' | 'pink'
function Pill({ children, color = 'purple' }: { children: ReactNode; color?: PillColor }) {
  const styles: Record<PillColor, { bg: string; fg: string }> = {
    purple: { bg: 'var(--p100)', fg: 'var(--p600)' },
    green:  { bg: '#D6F5E8',    fg: '#1E7A4F' },
    amber:  { bg: '#FEF3CD',    fg: '#A06B00' },
    mute:   { bg: 'var(--s2)',  fg: 'var(--graphite)' },
    pink:   { bg: '#FCE7F8',    fg: '#A0219E' },
  }
  const s = styles[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg,
    }}>{children}</span>
  )
}

function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--s0)', borderRadius: 16, padding: 20,
      boxShadow: 'var(--sh1)', ...style,
    }}>{children}</div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</div>
      {action && (
        <span onClick={onAction} style={{ fontSize: 12, fontWeight: 600, color: 'var(--p500)', cursor: 'pointer' }}>{action}</span>
      )}
    </div>
  )
}

function BtnPrimary({ children, onClick, style = {} }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
      background: 'var(--grad)', color: 'white',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      boxShadow: '0 4px 14px rgba(122,58,232,0.3)',
      transition: 'opacity .12s', fontFamily: 'inherit', ...style,
    }}>{children}</button>
  )
}

function BtnOutline({ children, onClick, style = {} }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 999,
      border: '1.5px solid var(--hair)', background: 'transparent', cursor: 'pointer',
      fontSize: 12, fontWeight: 600, color: 'var(--graphite)',
      transition: 'border-color .15s, color .15s', fontFamily: 'inherit', ...style,
    }}>{children}</button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Real data types
// ═══════════════════════════════════════════════════════════════════════
interface AssignedTest {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  created_at: string
  tutor_name: string | null
  last_attempt: {
    id: string
    correct_count: number
    total_count: number
    submitted_at: string
  } | null
  attempt_count: number
}

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

interface ApiConversation {
  partner_id: string
  partner_name: string
  last_message: string
  last_message_at: string
  last_message_is_mine: boolean
}

interface ApiMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  conversation_id?: string | null
}

function shortTutorName(name: string | null): string {
  if (!name) return 'a tutor'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function emojiForExam(exam: 'SAT' | 'ACT'): string {
  return exam === 'SAT' ? '📝' : '🔬'
}

function sessionSourceTz(s: ApiSession): string {
  return s.timezone || DEFAULT_TIMEZONE
}

// Returns the session's start instant (UTC) or null if the slot can't be parsed.
function sessionStartUtc(s: ApiSession): Date | null {
  return convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), 'UTC')?.utc ?? null
}

function isUpcoming(s: ApiSession): boolean {
  if (s.status !== 'confirmed') return false
  const start = sessionStartUtc(s)
  if (!start) return false
  // Keep upcoming until the session's full hour has elapsed.
  return start.getTime() + 60 * 60 * 1000 >= Date.now()
}

function isPast(s: ApiSession): boolean {
  if (s.status !== 'confirmed') return true
  const start = sessionStartUtc(s)
  if (!start) return true
  return start.getTime() + 60 * 60 * 1000 < Date.now()
}

function formatSessionWhen(s: ApiSession, viewerTz: string): string {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  if (!converted) return `${s.scheduled_date} · ${s.time_slot}`
  const ymdInTz = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: viewerTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  const todayStr = ymdInTz(new Date())
  const tomorrowStr = ymdInTz(new Date(Date.now() + 86400000))
  if (converted.date === todayStr) return `Today · ${converted.time}`
  if (converted.date === tomorrowStr) return `Tomorrow · ${converted.time}`
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    month: 'short',
    day: 'numeric',
  }).format(converted.utc)
  return `${datePart} · ${converted.time}`
}

function formatPastWhen(s: ApiSession, viewerTz: string): string {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  if (!converted) return s.scheduled_date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    month: 'short',
    day: 'numeric',
  }).format(converted.utc)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ═══════════════════════════════════════════════════════════════════════
//  Session row
// ═══════════════════════════════════════════════════════════════════════
function SessionRow({ s, onJoin, onViewNotes }: { s: ApiSession; onJoin?: () => void; onViewNotes?: () => void }) {
  const counterpart = s.is_tutor ? s.student_name : s.tutor_name
  const upcoming = isUpcoming(s)
  const viewerTz = useViewerTimezone()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0', borderBottom: '1px solid var(--hair)',
    }}>
      <Avatar initials={initialsOf(counterpart)} color={avatarColor(s.id)} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{counterpart}</div>
        <div style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>
          {s.notes ? s.notes : (s.is_tutor ? 'Student session' : 'Tutoring session')}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--graphite)', display: 'inline-flex', alignItems: 'center' }}>
          {Icon.cal()} {upcoming ? formatSessionWhen(s, viewerTz) : formatPastWhen(s, viewerTz)}
        </span>
        {upcoming
          ? <BtnPrimary onClick={onJoin}>{Icon.play()} Join</BtnPrimary>
          : <BtnOutline onClick={onViewNotes}>View Notes</BtnOutline>}
      </div>
    </div>
  )
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '40px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--graphite)', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--mute)' }}>{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Tabs
// ═══════════════════════════════════════════════════════════════════════
function Tabs({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{
      display: 'inline-flex', background: 'var(--s2)', borderRadius: 12, padding: 4, marginBottom: 20,
    }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          background: value === o.v ? 'white' : 'transparent',
          color: value === o.v ? 'var(--ink)' : 'var(--graphite)',
          boxShadow: value === o.v ? 'var(--sh1)' : 'none',
          transition: 'all .15s', fontFamily: 'inherit',
        }}>{o.l}</button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  PANELS
// ═══════════════════════════════════════════════════════════════════════
function PanelHome({
  setPanel,
  openConversation,
  firstName,
  tests,
  sessions,
  conversations,
  onStartTest,
  onReviewAttempt,
  onJoinSession,
}: {
  setPanel: (p: PanelKey) => void
  openConversation: (partnerId: string) => void
  firstName: string
  tests: AssignedTest[]
  sessions: ApiSession[]
  conversations: ApiConversation[]
  onStartTest: (id: string) => void
  onReviewAttempt: (testId: string, attemptId: string) => void
  onJoinSession: (id: string) => void
}) {
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)
  const nextSession = upcoming[0]
  const viewerTz = useViewerTimezone()

  return (
    <div>
      <div style={{
        borderRadius: 20, padding: '28px 32px', background: 'var(--gradsoft)',
        position: 'relative', overflow: 'hidden', marginBottom: 24,
      }}>
        <div style={{
          position: 'absolute', right: 24, bottom: -16,
          fontFamily: '"Shrikhand",serif', fontSize: 120, color: 'rgba(255,255,255,0.12)',
          lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
        }}>k</div>
        <h1 style={{ fontFamily: '"Shrikhand",serif', fontSize: 32, color: 'white', lineHeight: 1.1, marginBottom: 6 }}>
          Ready to move forward, {firstName}?
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', maxWidth: 380, lineHeight: 1.55 }}>
          {nextSession
            ? <>Your next session with <strong style={{ color: 'white' }}>{nextSession.is_tutor ? nextSession.student_name : nextSession.tutor_name}</strong> is {formatSessionWhen(nextSession, viewerTz).toLowerCase()}.</>
            : <>No upcoming sessions yet — find a tutor to get started.</>}
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            [String(upcoming.length), 'Upcoming sessions'],
            [String(past.length),     'Sessions done'],
            [String(tests.length),    'Practice tests'],
            [String(conversations.length), 'Conversations'],
          ].map(([n, l]) => (
            <div key={l} style={{
              background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 12, padding: '12px 18px', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 20, alignItems: 'start' }}>
        <Card>
          <SectionHeader title="Upcoming Sessions" action="View all" onAction={() => setPanel('essays')} />
          {upcoming.length === 0
            ? <EmptyState title="No upcoming sessions" sub="Book one from Discover." />
            : upcoming.slice(0, 3).map((s) => (
                <SessionRow key={s.id} s={s} onJoin={() => onJoinSession(s.id)} />
              ))}
        </Card>

        <Card>
          <SectionHeader title="Assignments" action="View all" onAction={() => setPanel('testing')} />
          {tests.length === 0 ? (
            <EmptyState title="No practice tests assigned yet" />
          ) : (
            tests.slice(0, 3).map((t) => {
              const la = t.last_attempt
              const pct = la && la.total_count > 0
                ? Math.round((la.correct_count / la.total_count) * 100)
                : null
              const onClick = () =>
                la ? onReviewAttempt(t.id, la.id) : onStartTest(t.id)
              return (
                <div key={t.id} onClick={onClick} style={{
                  padding: '10px 0', borderBottom: '1px solid var(--hair)', cursor: 'pointer', transition: 'background .15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{t.name}</div>
                    {pct !== null
                      ? <Pill color={pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'pink'}>{pct}%</Pill>
                      : <Pill color="purple">{t.exam_type}</Pill>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 3 }}>
                    {la
                      ? `${la.correct_count}/${la.total_count} correct · tap to review`
                      : `Assigned by ${shortTutorName(t.tutor_name)} · ${t.question_count} questions`}
                  </div>
                </div>
              )
            })
          )}
        </Card>

        <Card>
          <SectionHeader title="Messages" action="Open" onAction={() => setPanel('messages')} />
          {conversations.length === 0 ? (
            <EmptyState title="No conversations yet" />
          ) : (
            conversations.slice(0, 4).map((c) => (
              <div key={c.partner_id} onClick={() => openConversation(c.partner_id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                transition: 'background .15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar initials={initialsOf(c.partner_name)} color={avatarColor(c.partner_id)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{c.partner_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last_message}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--mute)' }}>{relativeTime(c.last_message_at)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

function PanelEssays({
  sessions,
  onJoinSession,
  onViewSessionNotes,
}: {
  sessions: ApiSession[]
  onJoinSession: (id: string) => void
  onViewSessionNotes: (id: string) => void
}) {
  const [tab, setTab] = useState('drafts')
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)

  return (
    <div>
      <Tabs value={tab} onChange={setTab} options={[{ v: 'drafts', l: 'My Drafts' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'drafts' && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✍️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>You haven't uploaded any essay drafts yet</div>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>Upload them here to get feedback.</div>
        </Card>
      )}
      {tab === 'sessions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upcoming</div>
          <Card style={{ marginBottom: 20 }}>
            {upcoming.length === 0
              ? <EmptyState title="No upcoming sessions" />
              : upcoming.map((s) => (
                  <SessionRow key={s.id} s={s} onJoin={() => onJoinSession(s.id)} />
                ))}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {past.length === 0
              ? <EmptyState title="No past sessions" />
              : past.map((s) => (
                  <SessionRow key={s.id} s={s} onViewNotes={() => onViewSessionNotes(s.id)} />
                ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function PanelTesting({
  tests,
  loading,
  sessions,
  onStartTest,
  onReviewAttempt,
  onJoinSession,
  onViewSessionNotes,
}: {
  tests: AssignedTest[]
  loading: boolean
  sessions: ApiSession[]
  onStartTest: (id: string) => void
  onReviewAttempt: (testId: string, attemptId: string) => void
  onJoinSession: (id: string) => void
  onViewSessionNotes: (id: string) => void
}) {
  const [tab, setTab] = useState('tests')
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)

  return (
    <div>
      <Tabs value={tab} onChange={setTab} options={[{ v: 'tests', l: 'Practice Tests' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'tests' && (
        loading ? (
          <Card style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', fontSize: 13 }}>
            Loading practice tests…
          </Card>
        ) : tests.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>No practice tests yet</div>
            <div style={{ fontSize: 12, color: 'var(--mute)' }}>Your tutor will assign practice tests for you to take here.</div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {tests.map((t) => {
              const la = t.last_attempt
              const pct = la && la.total_count > 0
                ? Math.round((la.correct_count / la.total_count) * 100)
                : null
              const statusColor: PillColor = la
                ? pct !== null && pct >= 80 ? 'green' : pct !== null && pct >= 60 ? 'amber' : 'pink'
                : 'mute'
              const statusLabel = la
                ? `${la.correct_count}/${la.total_count} · ${pct}%`
                : 'Not Started'
              return (
                <Card key={t.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: t.exam_type === 'SAT' ? 'var(--p100)' : '#FCE7F8',
                      display: 'grid', placeItems: 'center', fontSize: 20,
                    }}>{emojiForExam(t.exam_type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>
                        {t.question_count} questions · Assigned by {shortTutorName(t.tutor_name)}
                      </div>
                      {la && (
                        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                          Last submitted {relativeTime(la.submitted_at)} ago
                          {t.attempt_count > 1 ? ` · ${t.attempt_count} attempts` : ''}
                        </div>
                      )}
                    </div>
                    <Pill color={statusColor}>{statusLabel}</Pill>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    {la ? (
                      <>
                        <BtnPrimary
                          style={{ fontSize: 11 }}
                          onClick={() => onReviewAttempt(t.id, la.id)}
                        >
                          Review Results
                        </BtnPrimary>
                        <BtnOutline
                          style={{ fontSize: 11 }}
                          onClick={() => onStartTest(t.id)}
                        >
                          Retake
                        </BtnOutline>
                      </>
                    ) : (
                      <BtnPrimary style={{ fontSize: 11 }} onClick={() => onStartTest(t.id)}>Start Test</BtnPrimary>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
      {tab === 'sessions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upcoming</div>
          <Card style={{ marginBottom: 20 }}>
            {upcoming.length === 0
              ? <EmptyState title="No upcoming sessions" />
              : upcoming.map((s) => (
                  <SessionRow key={s.id} s={s} onJoin={() => onJoinSession(s.id)} />
                ))}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {past.length === 0
              ? <EmptyState title="No past sessions" />
              : past.map((s) => (
                  <SessionRow key={s.id} s={s} onViewNotes={() => onViewSessionNotes(s.id)} />
                ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function PanelActivities({
  sessions,
  onJoinSession,
  onViewSessionNotes,
}: {
  sessions: ApiSession[]
  onJoinSession: (id: string) => void
  onViewSessionNotes: (id: string) => void
}) {
  const [tab, setTab] = useState('list')
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)

  return (
    <div>
      <Tabs value={tab} onChange={setTab} options={[{ v: 'list', l: 'Activities List' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'list' && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>You haven't uploaded any activities yet</div>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>Build out your activities list with help from your tutor.</div>
        </Card>
      )}
      {tab === 'sessions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upcoming</div>
          <Card style={{ marginBottom: 20 }}>
            {upcoming.length === 0
              ? <EmptyState title="No upcoming sessions" />
              : upcoming.map((s) => (
                  <SessionRow key={s.id} s={s} onJoin={() => onJoinSession(s.id)} />
                ))}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {past.length === 0
              ? <EmptyState title="No past sessions" />
              : past.map((s) => (
                  <SessionRow key={s.id} s={s} onViewNotes={() => onViewSessionNotes(s.id)} />
                ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function PanelMessages({
  conversations,
  myInitials,
  myFullName,
  initialPartnerId,
}: {
  conversations: ApiConversation[]
  myInitials: string
  myFullName: string
  initialPartnerId: string | null
}) {
  const [activeId, setActiveId] = useState<string | null>(
    initialPartnerId ?? conversations[0]?.partner_id ?? null,
  )
  const [msgs, setMsgs] = useState<ApiMessage[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // If a specific conversation was requested (e.g. clicking a preview on
  // home), switch to it whenever that prop changes.
  useEffect(() => {
    if (initialPartnerId) setActiveId(initialPartnerId)
  }, [initialPartnerId])

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].partner_id)
    }
  }, [conversations, activeId])

  useEffect(() => {
    if (!activeId) {
      setMsgs([])
      setConversationId(null)
      return
    }
    let cancelled = false
    setLoadingThread(true)
    fetch(`/api/messages?with=${encodeURIComponent(activeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setMsgs(data.messages ?? [])
        setMyIds(data.myIds ?? [])
        setConversationId(data.conversationId ?? null)
      })
      .catch(() => {
        if (!cancelled) setMsgs([])
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false)
      })
    return () => { cancelled = true }
  }, [activeId])

  // Live updates for the open thread. Sender already appended via the POST
  // response so we de-dupe by id. Deps are intentionally just conversationId:
  // myIds/activeId are read through refs so a new fetch's array reference
  // doesn't tear down and re-subscribe the channel mid-mount.
  useEffect(() => {
    if (!conversationId) return
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ApiMessage
          setMsgs((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [msgs])

  async function send() {
    const content = input.trim()
    if (!content || !activeId) return
    setInput('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activeId, content }),
      })
      if (!res.ok) return
      const { message, conversationId: newConvId } = await res.json()
      if (message) {
        setMsgs((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
      }
      if (newConvId && newConvId !== conversationId) setConversationId(newConvId)
    } catch {
      // best-effort
    }
  }

  const activePartner = conversations.find((c) => c.partner_id === activeId)
  const myIdSet = new Set(myIds)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '260px 1fr',
      background: 'var(--s0)', borderRadius: 16, boxShadow: 'var(--sh1)',
      overflow: 'hidden', height: 'calc(100vh - 168px)',
    }}>
      <div style={{ borderRight: '1px solid var(--hair)', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink)', borderBottom: '1px solid var(--hair)' }}>Conversations</div>
        {conversations.length === 0 ? (
          <EmptyState title="No conversations" sub="Book a session to start chatting with a tutor." />
        ) : conversations.map((c) => {
          const isActive = c.partner_id === activeId
          return (
            <div key={c.partner_id} onClick={() => setActiveId(c.partner_id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
              background: isActive ? 'var(--p050)' : 'transparent', transition: 'background .15s',
            }}>
              <Avatar initials={initialsOf(c.partner_name)} color={avatarColor(c.partner_id)} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{c.partner_name}</div>
                <div style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last_message}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>{relativeTime(c.last_message_at)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {activePartner ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials={initialsOf(activePartner.partner_name)} color={avatarColor(activePartner.partner_id)} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{activePartner.partner_name}</div>
              </div>
            </div>
            <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingThread ? (
                <div style={{ textAlign: 'center', color: 'var(--mute)', fontSize: 13, paddingTop: 24 }}>Loading…</div>
              ) : msgs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mute)', fontSize: 13, paddingTop: 24 }}>
                  No messages yet. Say hi!
                </div>
              ) : msgs.map((m) => {
                const me = myIdSet.has(m.sender_id)
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: me ? 'row-reverse' : 'row' }}>
                    <Avatar
                      initials={me ? myInitials : initialsOf(activePartner.partner_name)}
                      color={me ? avatarColor(myFullName || 'me') : avatarColor(activePartner.partner_id)}
                      size={28}
                    />
                    <div>
                      <div style={{
                        maxWidth: 400, padding: '10px 14px', borderRadius: 16, fontSize: 13, lineHeight: 1.55,
                        background: me ? 'var(--grad)' : 'var(--s2)',
                        color: me ? 'white' : 'var(--ink)',
                        borderBottomRightRadius: me ? 4 : 16,
                        borderBottomLeftRadius: me ? 16 : 4,
                      }}>{m.content}</div>
                      <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 4, textAlign: me ? 'right' : 'left' }}>{relativeTime(m.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--hair)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                placeholder={`Message ${activePartner.partner_name.split(' ')[0]}…`}
                style={{
                  flex: 1, height: 40, borderRadius: 12, border: '1.5px solid var(--hair)',
                  background: 'var(--s1)', padding: '0 14px',
                  fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none',
                }}
              />
              <button onClick={send} style={{
                width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'var(--grad)', color: 'white', display: 'grid', placeItems: 'center',
                boxShadow: '0 4px 12px rgba(122,58,232,0.3)',
              }}>{Icon.send()}</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--mute)', fontSize: 13 }}>
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Profile editor
// ═══════════════════════════════════════════════════════════════════════
interface StudentProfileForm {
  name: string
  bio: string
  dateOfBirth: string
  gender: string
  phone: string
  profilePhoto: string
}

const GENDER_OPTIONS = [
  { v: '', l: 'Prefer not to say' },
  { v: 'female', l: 'Female' },
  { v: 'male', l: 'Male' },
  { v: 'non-binary', l: 'Non-binary' },
  { v: 'other', l: 'Other' },
]

function photoUrl(path: string): string {
  return `/api/storage?path=${encodeURIComponent(path)}`
}

function formatDob(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function PanelProfile({
  sessionName,
  sessionEmail,
  onPhotoChange,
  onNameChange,
}: {
  sessionName: string
  sessionEmail: string
  onPhotoChange: (path: string) => void
  onNameChange: (name: string) => void
}) {
  const [data, setData] = useState<StudentProfileForm | null>(null)
  const [draft, setDraft] = useState<StudentProfileForm | null>(null)
  const [editing, setEditing] = useState<'personal' | 'bio' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/profile')
      .then((r) => r.json())
      .then(({ student }) => {
        if (cancelled) return
        setData({
          name: student?.name || sessionName,
          bio: student?.bio || '',
          dateOfBirth: student?.date_of_birth || '',
          gender: student?.gender || '',
          phone: student?.phone || '',
          profilePhoto: student?.profile_photo || '',
        })
      })
      .catch(() => {
        if (cancelled) return
        setData({ name: sessionName, bio: '', dateOfBirth: '', gender: '', phone: '', profilePhoto: '' })
      })
    return () => { cancelled = true }
  }, [sessionName])

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  async function persist(patch: Partial<StudentProfileForm>) {
    setSaving(true)
    const body: Record<string, unknown> = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.bio !== undefined) body.bio = patch.bio
    if (patch.dateOfBirth !== undefined) body.dateOfBirth = patch.dateOfBirth
    if (patch.gender !== undefined) body.gender = patch.gender
    if (patch.phone !== undefined) body.phone = patch.phone
    if (patch.profilePhoto !== undefined) body.profilePhoto = patch.profilePhoto
    const res = await fetch('/api/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) return false
    flash()
    return true
  }

  function startEdit(section: 'personal' | 'bio') {
    if (!data) return
    setEditing(section)
    setDraft({ ...data })
  }

  function cancelEdit() {
    setEditing(null)
    setDraft(null)
  }

  async function saveSection() {
    if (!draft || !data) return
    const ok = await persist({
      name: draft.name,
      bio: draft.bio,
      dateOfBirth: draft.dateOfBirth,
      gender: draft.gender,
      phone: draft.phone,
    })
    if (!ok) return
    const next = { ...data, ...draft }
    setData(next)
    if (next.name !== data.name) onNameChange(next.name)
    setEditing(null)
    setDraft(null)
  }

  function onPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function onPhotoCropped(blob: Blob) {
    setCropSrc(null)
    if (!data) return
    setPhotoBusy(true)
    const previousPath = data.profilePhoto || ''
    const form = new FormData()
    form.append('file', new File([blob], `profile-${Date.now()}.png`, { type: 'image/png' }))
    form.append('fileType', 'profile-photo')
    const up = await fetch('/api/upload', { method: 'POST', body: form })
    const { path } = await up.json()
    if (path) {
      const ok = await persist({ profilePhoto: path })
      if (ok) {
        setData({ ...data, profilePhoto: path })
        onPhotoChange(path)
        if (previousPath && previousPath !== path) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: previousPath }),
          }).catch(() => {})
        }
      }
    }
    setPhotoBusy(false)
  }

  async function removePhoto() {
    if (!data?.profilePhoto) return
    setPhotoBusy(true)
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: data.profilePhoto }),
    })
    const ok = await persist({ profilePhoto: '' })
    if (ok) {
      setData({ ...data, profilePhoto: '' })
      onPhotoChange('')
    }
    setPhotoBusy(false)
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Card><EmptyState title="Loading profile…" /></Card>
      </div>
    )
  }

  const initials = initialsOf(data.name || 'You')
  const inputStyle: CSSProperties = {
    height: 40, padding: '0 12px', borderRadius: 10,
    border: '1.5px solid var(--hair)', background: 'var(--s0)',
    fontSize: 13, color: 'var(--ink)', outline: 'none',
    fontFamily: 'inherit', width: '100%',
  }
  const labelStyle: CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
    color: 'var(--mute)', marginBottom: 6,
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Photo */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Profile photo</div>
          {saved && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>Saved</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            {data.profilePhoto ? (
              <img
                src={photoUrl(data.profilePhoto)}
                alt="Profile"
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--hair)' }}
              />
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: '#7A62EA', color: 'white',
                display: 'grid', placeItems: 'center',
                fontSize: 30, fontWeight: 700,
                border: '2px solid var(--hair)',
              }}>{initials}</div>
            )}
            <label style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--grad)', color: 'white',
              display: 'grid', placeItems: 'center',
              cursor: photoBusy ? 'wait' : 'pointer',
              boxShadow: 'var(--sh1)',
              opacity: photoBusy ? 0.6 : 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*" onChange={onPhotoSelect} disabled={photoBusy} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--graphite)', lineHeight: 1.5 }}>
              A clear headshot from the shoulders up makes it easier for tutors and classmates to recognize you.
            </div>
            {data.profilePhoto && (
              <button
                onClick={removePhoto}
                disabled={photoBusy}
                style={{
                  marginTop: 10, padding: '6px 12px', borderRadius: 999,
                  border: '1.5px solid var(--hair)', background: 'transparent',
                  fontSize: 12, fontWeight: 600, color: 'var(--graphite)',
                  cursor: photoBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >Remove photo</button>
            )}
          </div>
        </div>
        {cropSrc && (
          <PhotoCropModal
            imageSrc={cropSrc}
            onCrop={onPhotoCropped}
            onCancel={() => setCropSrc(null)}
          />
        )}
      </Card>

      {/* Personal info */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Personal information</div>
          {editing === 'personal' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <BtnOutline onClick={cancelEdit}>Cancel</BtnOutline>
              <BtnPrimary onClick={saveSection}>{saving ? 'Saving…' : 'Save'}</BtnPrimary>
            </div>
          ) : (
            <BtnOutline onClick={() => startEdit('personal')}>Edit</BtnOutline>
          )}
        </div>

        {editing === 'personal' && draft ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Date of birth</label>
              <input
                type="date"
                value={draft.dateOfBirth}
                onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                style={inputStyle}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Phone number</label>
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="(555) 123-4567"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={sessionEmail}
                disabled
                style={{ ...inputStyle, background: 'var(--s2)', color: 'var(--mute)', cursor: 'not-allowed' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            <ProfileField label="Full name" value={data.name || '—'} />
            <ProfileField label="Date of birth" value={formatDob(data.dateOfBirth)} />
            <ProfileField label="Gender" value={GENDER_OPTIONS.find((o) => o.v === data.gender)?.l ?? '—'} />
            <ProfileField label="Phone number" value={data.phone || '—'} />
            <ProfileField label="Email" value={sessionEmail} />
          </div>
        )}
      </Card>

      {/* Bio */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>About me</div>
          {editing === 'bio' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <BtnOutline onClick={cancelEdit}>Cancel</BtnOutline>
              <BtnPrimary onClick={saveSection}>{saving ? 'Saving…' : 'Save'}</BtnPrimary>
            </div>
          ) : (
            <BtnOutline onClick={() => startEdit('bio')}>Edit</BtnOutline>
          )}
        </div>

        {editing === 'bio' && draft ? (
          <div>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={5}
              maxLength={500}
              placeholder="Tell tutors a bit about yourself — what you're studying, your goals, anything that helps them prepare."
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                border: '1.5px solid var(--hair)', background: 'var(--s0)',
                fontSize: 13, color: 'var(--ink)', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'right', marginTop: 4 }}>
              {draft.bio.length} / 500
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: 13, color: data.bio ? 'var(--ink)' : 'var(--mute)',
            lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 24,
          }}>
            {data.bio || 'Add a short bio so tutors can get to know you.'}
          </div>
        )}
      </Card>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mute)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}

function PanelSettings({
  name,
  email,
  sessionCount,
  onEditProfile,
}: {
  name: string
  email: string
  sessionCount: number
  onEditProfile: () => void
}) {
  const initials = initialsOf(name || 'You')
  return (
    <div style={{ maxWidth: 720 }}>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Account" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <Avatar initials={initials} color="#7A62EA" size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{name || 'Student'}</div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>{email} · High School Student</div>
          </div>
          <BtnOutline style={{ marginLeft: 'auto' }} onClick={onEditProfile}>Edit Profile</BtnOutline>
        </div>
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Sessions" />
        <div style={{ display: 'flex', gap: 24, paddingTop: 4 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{sessionCount}</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 500 }}>Total sessions</div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Notifications" />
        {[
          ['Session reminders',     'Get notified 24h and 1h before sessions'],
          ['New messages',          'Notify me when a tutor sends a message'],
          ['Assignment deadlines',  'Remind me 48h before due dates'],
        ].map(([label, sub]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--hair)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{sub}</div>
            </div>
            <div style={{
              width: 40, height: 22, borderRadius: 999, background: 'var(--grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 3px', cursor: 'pointer',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white' }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  App shell
// ═══════════════════════════════════════════════════════════════════════
type PanelKey = 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'settings' | 'profile'

const PANEL_META: Record<PanelKey, [string, string]> = {
  home:       ['', ''],
  essays:     ['Essays',          'Drafts & sessions'],
  testing:    ['Testing',         'Practice tests & sessions'],
  activities: ['Activities',      'Activities list & sessions'],
  messages:   ['Messages',        ''],
  settings:   ['Settings',        'Account & notifications'],
  profile:    ['Profile',         'Personal info & photo'],
}

function todayLabel() {
  const now = new Date()
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const VALID_PANELS: PanelKey[] = ['home', 'essays', 'testing', 'activities', 'messages', 'settings', 'profile']

function StudentDashboardInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPanel = (() => {
    const p = searchParams.get('panel') as PanelKey | null
    return p && VALID_PANELS.includes(p) ? p : 'home'
  })()

  const [panel, setPanel] = useState<PanelKey>(initialPanel)
  const [tests, setTests] = useState<AssignedTest[]>([])
  const [testsLoading, setTestsLoading] = useState(true)
  const [sessions, setSessions] = useState<ApiSession[]>([])
  const [conversations, setConversations] = useState<ApiConversation[]>([])
  const [profilePhoto, setProfilePhoto] = useState<string>('')
  const [overrideName, setOverrideName] = useState<string>('')
  const [pendingPartnerId, setPendingPartnerId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }
    // Tutors don't get a student dashboard — bounce them through the
    // server-side router so they end up on /tutor/dashboard (or onboarding).
    if (status === 'authenticated') {
      const role = (session?.user as { role?: string | null } | undefined)?.role
      if (role && role !== 'high_school') {
        router.replace('/post-login')
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/student/assigned-tests')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests([]))
      .finally(() => setTestsLoading(false))

    fetch('/api/sessions')
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))

    fetch('/api/messages')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => setConversations([]))

    fetch('/api/student/profile')
      .then((r) => r.json())
      .then(({ student }) => {
        if (student?.profile_photo) setProfilePhoto(student.profile_photo)
        if (student?.name) setOverrideName(student.name)
      })
      .catch(() => {})
  }, [status])

  const fullName = overrideName || session?.user?.name || ''
  const firstName = useMemo(() => fullName.split(/\s+/)[0] || 'there', [fullName])
  const myInitials = useMemo(() => initialsOf(fullName || 'You'), [fullName])
  const photoPathForUrl = useMemo(
    () => (profilePhoto ? `/api/storage?path=${encodeURIComponent(profilePhoto)}` : undefined),
    [profilePhoto],
  )

  const onStartTest = (id: string) => router.push(`/student/tests/${id}`)
  const onReviewAttempt = (testId: string, attemptId: string) =>
    router.push(`/student/tests/${testId}?review=${attemptId}`)
  const onJoinSession = (id: string) => router.push(`/session/${id}`)
  const onViewSessionNotes = (id: string) => router.push(`/session/${id}/notes`)
  const openConversation = (partnerId: string) => {
    setPendingPartnerId(partnerId)
    setPanel('messages')
  }

  const onSidebarSelect = (id: SidebarItemId) => {
    if (id === 'discover') {
      router.push('/find-tutors')
    } else {
      setPanel(id)
    }
  }

  const upcomingCount = sessions.filter(isUpcoming).length

  // Hook must run unconditionally (Rules of Hooks) — the mobile branch below
  // sits after the auth-loading early return, but the hook call cannot.
  const isMobile = useIsMobile()

  if (status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#F7F5F0' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '3px solid #BDB0F5', borderTopColor: 'transparent',
          animation: 'kspin 0.8s linear infinite',
        }} />
        <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const homeTitle = `${greetingFor()}, ${firstName} 👋`
  const homeSub = `${todayLabel()} · ${upcomingCount} upcoming session${upcomingCount === 1 ? '' : 's'}`
  const [titleRaw, subRaw] = PANEL_META[panel]
  const title = panel === 'home' ? homeTitle : titleRaw
  const sub = panel === 'home' ? homeSub : subRaw

  if (isMobile) {
    // Phone layout: sidebar + top bar are dropped; messages and profile use
    // dedicated mobile screens (list ↔ thread, single-column form).
    return (
      <MobileStudentDashboard
        firstName={firstName}
        fullName={fullName}
        email={session?.user?.email ?? ''}
        profilePhoto={profilePhoto}
        pendingPartnerId={pendingPartnerId}
        panel={panel}
        setPanel={setPanel}
        tests={tests}
        sessions={sessions}
        conversations={conversations}
        onStartTest={onStartTest}
        onJoinSession={onJoinSession}
        onPhotoChange={setProfilePhoto}
        onNameChange={setOverrideName}
      />
    )
  }

  return (
    <div
      style={{
        ...DASH_VARS,
        height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden',
        background: 'var(--s1)', color: 'var(--ink)',
        fontFamily: 'var(--font-montserrat), system-ui, sans-serif',
      }}
    >
      <StudentSidebar
        activeId={
          panel === 'settings' ? 'settings'
          : panel === 'profile' ? 'profile'
          : (panel as SidebarItemId)
        }
        initials={myInitials}
        onSelect={onSidebarSelect}
        onSettingsClick={() => setPanel('settings')}
        onProfileClick={() => setPanel('profile')}
        profilePhotoUrl={photoPathForUrl}
        isProfileActive={panel === 'profile'}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          height: 60, background: 'var(--s0)', borderBottom: '1px solid var(--hair)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', flexShrink: 0, width: '100%',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 500 }}>{sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }}>{Icon.search()}</div>
              <input placeholder="Search…" style={{
                height: 36, borderRadius: 10, border: '1.5px solid var(--hair)',
                background: 'var(--s1)', paddingLeft: 30, paddingRight: 12, width: 180,
                fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none',
              }} />
            </div>
            <TimezoneSelector />
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--hair)', background: 'var(--s1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--graphite)' }}>
              {Icon.bell()}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
          {panel === 'home' && (
            <PanelHome
              setPanel={setPanel}
              openConversation={openConversation}
              firstName={firstName}
              tests={tests}
              sessions={sessions}
              conversations={conversations}
              onStartTest={onStartTest}
              onReviewAttempt={onReviewAttempt}
              onJoinSession={onJoinSession}
            />
          )}
          {panel === 'essays' && (
            <PanelEssays
              sessions={sessions}
              onJoinSession={onJoinSession}
              onViewSessionNotes={onViewSessionNotes}
            />
          )}
          {panel === 'testing' && (
            <PanelTesting
              tests={tests}
              loading={testsLoading}
              sessions={sessions}
              onStartTest={onStartTest}
              onReviewAttempt={onReviewAttempt}
              onJoinSession={onJoinSession}
              onViewSessionNotes={onViewSessionNotes}
            />
          )}
          {panel === 'activities' && (
            <PanelActivities
              sessions={sessions}
              onJoinSession={onJoinSession}
              onViewSessionNotes={onViewSessionNotes}
            />
          )}
          {panel === 'messages' && (
            <PanelMessages
              conversations={conversations}
              myInitials={myInitials}
              myFullName={fullName}
              initialPartnerId={pendingPartnerId}
            />
          )}
          {panel === 'settings' && (
            <PanelSettings
              name={fullName || 'Student'}
              email={session?.user?.email ?? ''}
              sessionCount={sessions.length}
              onEditProfile={() => setPanel('profile')}
            />
          )}
          {panel === 'profile' && (
            <PanelProfile
              sessionName={fullName}
              sessionEmail={session?.user?.email ?? ''}
              onPhotoChange={setProfilePhoto}
              onNameChange={setOverrideName}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentDashboardPage() {
  return (
    <React.Suspense fallback={
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#F7F5F0' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '3px solid #BDB0F5', borderTopColor: 'transparent',
          animation: 'kspin 0.8s linear infinite',
        }} />
        <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <StudentDashboardInner />
    </React.Suspense>
  )
}
