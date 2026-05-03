'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import { StudentSidebar, type SidebarItemId } from '@/components/student-sidebar'

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

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function isUpcoming(s: ApiSession): boolean {
  return s.status === 'confirmed' && s.scheduled_date >= todayISO()
}

function isPast(s: ApiSession): boolean {
  return s.status !== 'confirmed' || s.scheduled_date < todayISO()
}

function formatSessionWhen(s: ApiSession): string {
  const date = new Date(s.scheduled_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86400000)
  const sameDay = date.toDateString() === today.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()
  if (sameDay) return `Today · ${s.time_slot}`
  if (isTomorrow) return `Tomorrow · ${s.time_slot}`
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  return `${month} ${date.getDate()} · ${s.time_slot}`
}

function formatPastWhen(s: ApiSession): string {
  const date = new Date(s.scheduled_date + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          {Icon.cal()} {upcoming ? formatSessionWhen(s) : formatPastWhen(s)}
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
  firstName,
  tests,
  sessions,
  conversations,
  onStartTest,
  onJoinSession,
}: {
  setPanel: (p: PanelKey) => void
  firstName: string
  tests: AssignedTest[]
  sessions: ApiSession[]
  conversations: ApiConversation[]
  onStartTest: (id: string) => void
  onJoinSession: (id: string) => void
}) {
  const upcoming = sessions.filter(isUpcoming)
  const past = sessions.filter(isPast)
  const nextSession = upcoming[0]

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
            ? <>Your next session with <strong style={{ color: 'white' }}>{nextSession.is_tutor ? nextSession.student_name : nextSession.tutor_name}</strong> is {formatSessionWhen(nextSession).toLowerCase()}.</>
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
            tests.slice(0, 3).map((t) => (
              <div key={t.id} onClick={() => onStartTest(t.id)} style={{
                padding: '10px 0', borderBottom: '1px solid var(--hair)', cursor: 'pointer', transition: 'background .15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{t.name}</div>
                  <Pill color="purple">{t.exam_type}</Pill>
                </div>
                <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 3 }}>
                  Assigned by {shortTutorName(t.tutor_name)} · {t.question_count} questions
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <SectionHeader title="Messages" action="Open" onAction={() => setPanel('messages')} />
          {conversations.length === 0 ? (
            <EmptyState title="No conversations yet" />
          ) : (
            conversations.slice(0, 4).map((c) => (
              <div key={c.partner_id} onClick={() => setPanel('messages')} style={{
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Essay drafts coming soon</div>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>Your tutor will be able to assign drafts here for you to work on.</div>
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
  onJoinSession,
  onViewSessionNotes,
}: {
  tests: AssignedTest[]
  loading: boolean
  sessions: ApiSession[]
  onStartTest: (id: string) => void
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
            {tests.map((t) => (
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
                  </div>
                  <Pill color="mute">Not Started</Pill>
                </div>
                <div style={{ marginTop: 14 }}>
                  <BtnPrimary style={{ fontSize: 11 }} onClick={() => onStartTest(t.id)}>Start Test</BtnPrimary>
                </div>
              </Card>
            ))}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Activities list coming soon</div>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>Build out your Common App activities list with help from your tutor.</div>
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
}: {
  conversations: ApiConversation[]
  myInitials: string
  myFullName: string
}) {
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.partner_id ?? null)
  const [msgs, setMsgs] = useState<ApiMessage[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].partner_id)
    }
  }, [conversations, activeId])

  useEffect(() => {
    if (!activeId) {
      setMsgs([])
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
      })
      .catch(() => {
        if (!cancelled) setMsgs([])
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false)
      })
    return () => { cancelled = true }
  }, [activeId])

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
      const { message } = await res.json()
      if (message) setMsgs((prev) => [...prev, message])
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
            <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

function PanelSettings({
  name,
  email,
  sessionCount,
}: {
  name: string
  email: string
  sessionCount: number
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
          <BtnOutline style={{ marginLeft: 'auto' }}>Edit Profile</BtnOutline>
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
type PanelKey = 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'settings'

const PANEL_META: Record<PanelKey, [string, string]> = {
  home:       ['', ''],
  essays:     ['Essays',          'Drafts & sessions'],
  testing:    ['Testing',         'Practice tests & sessions'],
  activities: ['Activities',      'Activities list & sessions'],
  messages:   ['Messages',        ''],
  settings:   ['Settings',        'Account & notifications'],
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

const VALID_PANELS: PanelKey[] = ['home', 'essays', 'testing', 'activities', 'messages', 'settings']

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

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

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
  }, [status])

  const fullName = session?.user?.name ?? ''
  const firstName = useMemo(() => fullName.split(/\s+/)[0] || 'there', [fullName])
  const myInitials = useMemo(() => initialsOf(fullName || 'You'), [fullName])

  const onStartTest = (id: string) => router.push(`/student/tests/${id}`)
  const onJoinSession = (id: string) => router.push(`/session/${id}`)
  const onViewSessionNotes = (id: string) => router.push(`/session/${id}/notes`)

  const onSidebarSelect = (id: SidebarItemId) => {
    if (id === 'discover') {
      router.push('/find-tutors')
    } else {
      setPanel(id)
    }
  }

  const upcomingCount = sessions.filter(isUpcoming).length

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
        activeId={panel === 'settings' ? 'settings' : (panel as SidebarItemId)}
        initials={myInitials}
        onSelect={onSidebarSelect}
        onSettingsClick={() => setPanel('settings')}
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
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--hair)', background: 'var(--s1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--graphite)' }}>
              {Icon.bell()}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
          {panel === 'home' && (
            <PanelHome
              setPanel={setPanel}
              firstName={firstName}
              tests={tests}
              sessions={sessions}
              conversations={conversations}
              onStartTest={onStartTest}
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
            />
          )}
          {panel === 'settings' && (
            <PanelSettings
              name={fullName || 'Student'}
              email={session?.user?.email ?? ''}
              sessionCount={sessions.length}
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
