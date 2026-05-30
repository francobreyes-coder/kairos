'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home as IcHome,
  Calendar as IcCal,
  DollarSign as IcDollar,
  BarChart3 as IcChart,
  MessageSquare as IcMsg,
  User as IcUser,
  Settings as IcGear,
  Bell as IcBell,
  Search as IcSearch,
  Video as IcVideo,
  Play as IcPlay,
  Send as IcSend,
  TrendingUp as IcUp,
  Pencil as IcEdit,
  Plus as IcPlus,
  Loader2,
  ExternalLink,
  AlertCircle,
  ClipboardList,
  LogOut,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { PayoutsCard } from '@/components/payouts-card'
import { SERVICE_OPTIONS, SERVICE_LABELS } from '@/lib/services'
import {
  DEFAULT_TIMEZONE,
  convertSlotToTimezone,
  isWithinSessionWindow as isWithinWindow,
} from '@/lib/timezone'
import { useViewerTimezone } from '@/lib/use-viewer-timezone'
import { TimezoneSelector } from '@/components/timezone-selector'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MobileTutorDashboard } from '@/components/mobile-tutor-dashboard'
import { getBrowserSupabase } from '@/lib/supabase-browser'

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

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

interface TutorAttempt {
  id: string
  test_id: string
  test_name: string
  exam_type: 'SAT' | 'ACT'
  student_id: string
  student_name: string | null
  correct_count: number
  total_count: number
  submitted_at: string
}

interface Conversation {
  partner_id: string
  partner_name: string
  last_message: string
  last_message_at: string
  last_message_is_mine: boolean
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  conversation_id?: string | null
}

/* ──────────────────────────────────────────────────────────────────────────
   Constants & helpers
   ────────────────────────────────────────────────────────────────────────── */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
]

// Per-service market bands for the rate slider.
const SERVICE_BANDS: Record<string, { min: number; max: number; icon: string }> = {
  essays:     { min: 0, max: 100, icon: '✍️' },
  sat:        { min: 0, max: 150, icon: '📝' },
  act:        { min: 0, max: 150, icon: '🔬' },
  activities: { min: 0, max: 100, icon: '🎯' },
}
const RATE_HARD_MAX = 500

// Stable, hash-based avatar color so the same student always renders the same shade.
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

function formatShortDate(s: DashboardSession, viewerTz: string): string {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  const utc = converted?.utc ?? new Date(s.scheduled_date + 'T00:00:00')
  return new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, month: 'short', day: 'numeric' }).format(utc)
}

function formatWhen(s: DashboardSession, viewerTz: string): string {
  const converted = convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)
  if (!converted) return `${s.scheduled_date} · ${s.time_slot}`
  const todayLocal = new Date()
  const ymdInTz = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: viewerTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  const todayStr = ymdInTz(todayLocal)
  const tomorrow = new Date(todayLocal.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStr = ymdInTz(tomorrow)
  if (converted.date === todayStr) return `Today · ${converted.time}`
  if (converted.date === tomorrowStr) return `Tomorrow · ${converted.time}`
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(converted.utc)
  return `${datePart} · ${converted.time}`
}

function isWithinSessionWindow(s: DashboardSession): boolean {
  return isWithinWindow(s.scheduled_date, s.time_slot, sessionSourceTz(s))
}

function nextSessionTeaser(sessions: DashboardSession[], viewerTz: string): string {
  if (sessions.length === 0) return 'No upcoming sessions yet.'
  const s = sessions[0]
  return `Your next one is ${formatWhen(s, viewerTz).toLowerCase()} with ${s.student_name}.`
}

function relativeTime(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMessageStamp(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return t
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${t}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`
}

/* ──────────────────────────────────────────────────────────────────────────
   Building blocks
   ────────────────────────────────────────────────────────────────────────── */

function Avatar({
  initials,
  color,
  size = 44,
  src,
}: {
  initials: string
  color?: string
  size?: number
  src?: string | null
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: color || '#7A62EA',
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

function Pill({ children, color = 'purple' }: { children: React.ReactNode; color?: 'purple' | 'green' | 'amber' | 'mute' | 'pink' | 'red' }) {
  const map = {
    purple: { bg: '#ECE7FC', fg: '#6C52E0' },
    green:  { bg: '#D6F5E8', fg: '#1E7A4F' },
    amber:  { bg: '#FEF3CD', fg: '#A06B00' },
    mute:   { bg: '#F1EFE9', fg: '#5A5862' },
    pink:   { bg: '#FCE7F8', fg: '#A0219E' },
    red:    { bg: '#FDE7E7', fg: '#B12727' },
  }
  const s = map[color]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {children}
    </span>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 1px 2px rgba(28,27,31,.04), 0 2px 6px rgba(28,27,31,.05)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SecHead({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1B1F', letterSpacing: '-0.01em' }}>{title}</div>
      {action && (
        <button
          onClick={onAction}
          style={{ fontSize: 12, fontWeight: 600, color: '#7A62EA', cursor: onAction ? 'pointer' : 'default', background: 'none', border: 'none', padding: 0 }}
        >
          {action}
        </button>
      )}
    </div>
  )
}

function BtnPrimary({
  children,
  onClick,
  disabled,
  style = {},
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 999,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
        color: 'white',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        boxShadow: '0 4px 14px rgba(122,58,232,0.3)',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function BtnOutline({
  children,
  onClick,
  disabled,
  style = {},
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 999,
        border: '1.5px solid #E6E3E8',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: '#5A5862',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { v: T; l: string }[]
}) {
  return (
    <div style={{ display: 'inline-flex', background: '#F1EFE9', borderRadius: 12, padding: 4, marginBottom: 20 }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: '8px 20px',
            borderRadius: 9,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            background: value === o.v ? 'white' : 'transparent',
            color: value === o.v ? '#1C1B1F' : '#5A5862',
            boxShadow: value === o.v ? '0 1px 2px rgba(28,27,31,.04), 0 2px 6px rgba(28,27,31,.05)' : 'none',
            transition: 'all .15s',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function BarChart({ data, height = 120 }: { data: Bar[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.val), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          {d.val > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#6C52E0' }}>${d.val}</span>}
          <div
            style={{
              width: '100%',
              maxWidth: 36,
              borderRadius: 7,
              background: d.val > 0 ? 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)' : '#E6E3E8',
              height: `${Math.max((d.val / max) * (height - 36), d.val > 0 ? 8 : 3)}px`,
              transition: 'height .7s cubic-bezier(.2,.0,.0,1)',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 600, color: '#8A8792' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Session row
   ────────────────────────────────────────────────────────────────────────── */

function SessRow({
  s,
  past,
  onCancel,
  cancelling,
}: {
  s: DashboardSession
  past?: boolean
  onCancel?: (id: string) => void
  cancelling?: string | null
}) {
  const viewerTz = useViewerTimezone()
  // canJoin uses the session's stored source tz (via isWithinSessionWindow),
  // not the viewer's display tz — the live-window math is the same instant
  // regardless of where the tutor is currently sitting.
  const canJoin = !past && s.status === 'confirmed' && isWithinSessionWindow(s)
  const priceLabel = (parseFloat(String(s.price)) || 0) > 0 ? `+$${Math.round(parseFloat(String(s.price)))}` : ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid #E6E3E8' }}>
      <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F' }}>{s.student_name}</div>
        <div style={{ fontSize: 12, color: '#5A5862', marginTop: 2 }}>
          {s.student_sub ? `${s.student_sub} · ` : ''}{formatWhen(s, viewerTz)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {priceLabel && <span style={{ fontSize: 13, fontWeight: 700, color: '#2FA46A' }}>{priceLabel}</span>}
          {!past && s.status === 'confirmed' && (
            canJoin ? (
              <Link href={`/session/${s.id}`} style={{ textDecoration: 'none' }}>
                <BtnPrimary>
                  <IcVideo size={11} /> Join
                </BtnPrimary>
              </Link>
            ) : (
              <BtnPrimary disabled style={{ background: '#BDB0F5', boxShadow: 'none' }}>
                <IcPlay size={11} /> Start
              </BtnPrimary>
            )
          )}
          {past && (
            <Link href={`/session/${s.id}/notes`} style={{ textDecoration: 'none' }}>
              <BtnOutline>Notes</BtnOutline>
            </Link>
          )}
        </div>
        {!past && s.status === 'confirmed' && onCancel && (
          <button
            onClick={() => onCancel(s.id)}
            disabled={cancelling === s.id}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#B12727',
              background: 'none',
              border: 'none',
              cursor: cancelling === s.id ? 'not-allowed' : 'pointer',
              padding: 0,
            }}
          >
            {cancelling === s.id ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   HOME panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelHome({
  data,
  attempts,
  setPanel,
}: {
  data: DashboardData
  attempts: TutorAttempt[]
  setPanel: (p: PanelId) => void
}) {
  const { profile, stats, upcoming, weekly, topStudents } = data
  const firstName = profile.name.split(' ')[0] || 'there'
  const weekTotal = weekly.reduce((a, d) => a + d.val, 0)
  const viewerTz = useViewerTimezone()

  return (
    <div>
      {/* Hero banner */}
      <div
        style={{
          borderRadius: 20,
          padding: '28px 32px',
          background: 'linear-gradient(135deg,#82AAEE 0%,#B47AE8 52%,#E882CC 100%)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: -16,
            fontFamily: '"Shrikhand", serif',
            fontSize: 120,
            color: 'rgba(255,255,255,0.12)',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          k
        </div>
        <h1 style={{ fontFamily: '"Shrikhand", serif', fontSize: 32, color: 'white', lineHeight: 1.1, marginBottom: 6 }}>
          Welcome back, {firstName}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', maxWidth: 480, lineHeight: 1.55 }}>
          You have <strong style={{ color: 'white' }}>{stats.upcomingCount} upcoming session{stats.upcomingCount === 1 ? '' : 's'}</strong>.{' '}
          {nextSessionTeaser(upcoming, viewerTz)}
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            [String(stats.upcomingCount), 'Upcoming'],
            [formatCurrency(weekTotal), 'Week earnings'],
            [String(stats.uniqueStudents), 'Active students'],
            [String(stats.completedCount), 'Completed total'],
          ].map(([n, l]) => (
            <div
              key={l}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 12,
                padding: '12px 18px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        {/* Upcoming */}
        <Card>
          <SecHead title="Upcoming Sessions" action="View all" onAction={() => setPanel('sessions')} />
          {upcoming.length === 0 ? (
            <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
              No upcoming sessions. Students can book you from the Find Tutors page.
            </div>
          ) : (
            upcoming.slice(0, 3).map((s) => <SessRow key={s.id} s={s} />)
          )}
        </Card>

        {/* This Week's Earnings */}
        <Card>
          <SecHead title="This Week's Earnings" action="Details" onAction={() => setPanel('earnings')} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{formatCurrency(weekTotal)}</span>
            {stats.totalEarnings > 0 && (
              <span style={{ fontSize: 12, color: '#2FA46A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IcUp size={12} />
                {Math.round((weekTotal / Math.max(stats.totalEarnings - weekTotal, 1)) * 100)}% of all-time
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#8A8792', marginBottom: 16 }}>
            {formatCurrency(stats.totalEarnings)} total earned all time
          </div>
          <BarChart data={weekly} />
        </Card>

        {/* Top students (replaces fabricated reviews) */}
        <Card>
          <SecHead title="Top Students" action="Sessions" onAction={() => setPanel('sessions')} />
          {topStudents.length === 0 ? (
            <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792' }}>
              No completed sessions yet.
            </div>
          ) : (
            topStudents.slice(0, 5).map((t) => (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #E6E3E8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={initialsOf(t.name)} color={avatarColor(t.id)} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  {t.sub && <div style={{ fontSize: 11, color: '#8A8792' }}>{t.sub}</div>}
                </div>
                <Pill color="purple">{t.count} session{t.count === 1 ? '' : 's'}</Pill>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Recent practice-test submissions. Each row is a "I just finished
          their assigned test" event — clicking opens the review page so the
          tutor can see right/wrong per question. The inbox notification is
          the live ping; this card is the durable record. */}
      <div style={{ marginTop: 24 }}>
        <Card>
          <SecHead title="Recent Practice Tests" />
          {attempts.length === 0 ? (
            <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
              No submissions yet. Submissions land here as soon as a student finishes a test you assigned.
            </div>
          ) : (
            attempts.slice(0, 6).map((a) => {
              const pct = a.total_count > 0 ? Math.round((a.correct_count / a.total_count) * 100) : 0
              const pillColor: 'green' | 'amber' | 'red' = pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red'
              const name = a.student_name ?? 'Student'
              return (
                <Link
                  key={a.id}
                  href={`/tutor/tests/${a.test_id}/attempts/${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #E6E3E8' }}>
                    <Avatar initials={initialsOf(name)} color={avatarColor(a.student_id)} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F' }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 12, color: '#5A5862', marginTop: 2 }}>
                        Finished <strong>{a.test_name}</strong> · {relativeTime(a.submitted_at)} ago
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Pill color={pillColor}>
                        {a.correct_count}/{a.total_count} · {pct}%
                      </Pill>
                      <BtnOutline>Review →</BtnOutline>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </Card>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   SESSIONS panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelSessions({
  upcoming,
  past,
  onCancel,
  cancelling,
}: {
  upcoming: DashboardSession[]
  past: DashboardSession[]
  onCancel: (id: string) => void
  cancelling: string | null
}) {
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming')
  const list = tab === 'upcoming' ? upcoming : past
  const viewerTz = useViewerTimezone()

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { v: 'upcoming', l: `Upcoming (${upcoming.length})` },
          { v: 'completed', l: `Past (${past.length})` },
        ]}
      />
      <Card>
        {list.length === 0 ? (
          <div style={{ padding: '36px 0', fontSize: 14, color: '#8A8792', textAlign: 'center' }}>
            {tab === 'upcoming'
              ? 'No upcoming sessions yet. Students can book you from the Find Tutors page.'
              : 'No past sessions to show.'}
          </div>
        ) : tab === 'upcoming' ? (
          list.map((s) => <SessRow key={s.id} s={s} onCancel={onCancel} cancelling={cancelling} />)
        ) : (
          list.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid #E6E3E8' }}>
              <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.student_name}</div>
                <div style={{ fontSize: 12, color: '#5A5862', marginTop: 2 }}>
                  {s.student_sub ? `${s.student_sub} · ` : ''}{formatShortDate(s, viewerTz)} · {convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)?.time ?? s.time_slot}
                </div>
              </div>
              {s.status === 'cancelled' ? (
                <Pill color="red">
                  <XCircle size={11} style={{ marginRight: 4 }} />
                  Cancelled
                </Pill>
              ) : s.status === 'completed' ? (
                <Pill color="green">
                  <CheckCircle size={11} style={{ marginRight: 4 }} />
                  Completed
                </Pill>
              ) : (
                <Pill color="mute">Past</Pill>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                {(parseFloat(String(s.price)) || 0) > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2FA46A' }}>+${Math.round(parseFloat(String(s.price)))}</span>
                )}
              </div>
              <Link href={`/session/${s.id}/notes`} style={{ textDecoration: 'none' }}>
                <BtnOutline>Notes</BtnOutline>
              </Link>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   EARNINGS panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelEarnings({ data }: { data: DashboardData }) {
  const { stats, weekly, monthly, past } = data
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly')
  const completedTxns = past.filter((s) => s.status === 'completed')
  const viewerTz = useViewerTimezone()

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          [formatCurrency(stats.totalEarnings), 'Total Earned', true],
          [formatCurrency(stats.earningsThisWeek), 'This Week', false],
          [formatCurrency(stats.pendingEarnings), 'Pending', false],
          [formatCurrency(stats.earningsPerSession), 'Avg / Session', false],
        ].map(([n, l, grad]) => (
          <Card
            key={l as string}
            style={
              grad
                ? { background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)' }
                : {}
            }
          >
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: grad ? 'white' : '#1C1B1F' }}>{n}</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6, color: grad ? 'rgba(255,255,255,0.75)' : '#8A8792' }}>{l}</div>
          </Card>
        ))}
      </div>

      {/* Payouts setup — surfaces Stripe connect status from existing endpoint */}
      <div style={{ marginBottom: 24 }}>
        <PayoutsCard />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { v: 'weekly', l: 'This Week' },
          { v: 'monthly', l: 'By Month' },
        ]}
      />
      <Card style={{ marginBottom: 24 }}>
        <BarChart data={tab === 'weekly' ? weekly : monthly} height={160} />
      </Card>

      <Card>
        <SecHead title="Transaction History" />
        {completedTxns.length === 0 ? (
          <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
            No completed sessions yet — your earnings will appear here once sessions are marked complete.
          </div>
        ) : (
          completedTxns.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #E6E3E8' }}>
              <Avatar initials={initialsOf(s.student_name)} color={avatarColor(s.student_id)} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.student_name}</div>
                <div style={{ fontSize: 12, color: '#8A8792' }}>
                  {formatShortDate(s, viewerTz)} · {convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)?.time ?? s.time_slot}
                </div>
              </div>
              <Pill color="green">+${Math.round(parseFloat(String(s.price)) || 0)}</Pill>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   ANALYTICS panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelAnalytics({ data }: { data: DashboardData }) {
  const { stats, monthlySessions, topStudents } = data
  const totalTop = topStudents.reduce((a, t) => a + t.count, 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { n: stats.completedCount, l: 'Sessions Completed', bg: '#ECE7FC', fg: '#6C52E0' },
          { n: stats.uniqueStudents, l: 'Unique Students', bg: '#D6F5E8', fg: '#1E7A4F' },
          { n: `${stats.repeatRate}%`, l: 'Repeat Rate', bg: '#FEF3CD', fg: '#A06B00' },
          { n: formatCurrency(stats.earningsPerSession), l: 'Avg / Session', bg: '#FCE7F8', fg: '#A0219E' },
        ].map((x) => (
          <Card key={x.l}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: x.bg,
                color: x.fg,
                display: 'grid',
                placeItems: 'center',
                marginBottom: 10,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ★
            </div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{x.n}</div>
            <div style={{ fontSize: 12, color: '#8A8792', marginTop: 4 }}>{x.l}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <Card>
          <SecHead title="Top Students by Sessions" />
          {topStudents.length === 0 ? (
            <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
              No data yet — completed sessions will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topStudents.map((t) => {
                const pct = totalTop > 0 ? Math.round((t.count / totalTop) * 100) : 0
                return (
                  <div key={t.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: '#8A8792' }}>
                        {t.count} session{t.count === 1 ? '' : 's'} · {pct}%
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: '#E6E3E8', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
                          width: pct + '%',
                          transition: 'width .8s cubic-bezier(.2,.0,.0,1)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
        <Card>
          <SecHead title="Monthly Session Count" />
          <BarChart data={monthlySessions} height={150} />
        </Card>
      </div>

      <Card>
        <SecHead title="Student Reviews" />
        <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
          Reviews aren&apos;t collected yet. When students leave feedback after sessions, it&apos;ll show up here.
        </div>
      </Card>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   MESSAGES panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelMessages({ tutorPhoto }: { tutorPhoto: string | null }) {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [active, setActive] = useState<{ id: string; name: string } | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(() => {
    fetch('/api/messages')
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations ?? [])
        if (data.myIds) setMyIds(data.myIds)
        if (!active && data.conversations?.length) {
          setActive({ id: data.conversations[0].partner_id, name: data.conversations[0].partner_name })
        }
      })
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoadingConvos(false))
  }, [active])

  useEffect(() => {
    loadConversations()
    // Run only once on mount; subsequent refreshes are explicit (after send).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active) {
      setConversationId(null)
      return
    }
    setLoadingMessages(true)
    setError(null)
    fetch(`/api/messages?with=${active.id}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? [])
        if (data.myIds) setMyIds(data.myIds)
        setConversationId(data.conversationId ?? null)
      })
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoadingMessages(false))
  }, [active])

  // Live updates for the open thread. We POST-and-append locally, so realtime
  // events from this tab will be de-duped by id and only events from the
  // other side actually mutate state.
  useEffect(() => {
    if (!conversationId) return
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          const incoming = payload.payload as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        },
      )
      .subscribe((status, err) => {
        console.info('[tutor-dash messages] realtime', status, conversationId, err)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  const isMine = useCallback(
    (senderId: string) => {
      if (myIds.length > 0) return myIds.includes(senderId)
      return senderId === session?.user?.id
    },
    [myIds, session?.user?.id],
  )

  async function send() {
    if (!draft.trim() || !active || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Reuse the resolved conversation when known; receiverId-only would
        // re-run find-or-create on every send and can fork a new thread.
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          receiverId: active.id,
          content: draft.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      const { message, conversationId: newConvId } = await res.json()
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message]
      })
      if (newConvId && newConvId !== conversationId) setConversationId(newConvId)
      const sent = draft.trim()
      setDraft('')
      setConversations((prev) => {
        const next = prev.filter((c) => c.partner_id !== active.id)
        return [
          {
            partner_id: active.id,
            partner_name: active.name,
            last_message: sent,
            last_message_at: new Date().toISOString(),
            last_message_is_mine: true,
          },
          ...next,
        ]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const tutorInitials = initialsOf(session?.user?.name ?? '?')

  // Size to the parent body wrapper (which already accounts for the topbar
  // and outer padding) rather than computing against 100vh, which is brittle
  // if the topbar or padding ever changes. The header and input rows get
  // flexShrink:0 so the body can never push them out of view.
  return (
    <div
      style={{
        display: 'flex',
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(28,27,31,.04), 0 2px 6px rgba(28,27,31,.05)',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #E6E3E8', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 700, color: '#1C1B1F', borderBottom: '1px solid #E6E3E8' }}>
          Students
        </div>
        {loadingConvos ? (
          <div style={{ padding: 40, display: 'grid', placeItems: 'center' }}>
            <Loader2 size={20} className="animate-spin" color="#7A3AE8" />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: 24, fontSize: 12, color: '#8A8792', textAlign: 'center' }}>
            No conversations yet. Once a student messages you, they&apos;ll show up here.
          </div>
        ) : (
          conversations.map((c) => {
            const isActive = active?.id === c.partner_id
            return (
              <button
                key={c.partner_id}
                onClick={() => setActive({ id: c.partner_id, name: c.partner_name })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: isActive ? '#F6F3FE' : 'transparent',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Avatar initials={initialsOf(c.partner_name)} color={avatarColor(c.partner_id)} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{c.partner_name}</div>
                  <div style={{ fontSize: 12, color: '#8A8792', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.last_message_is_mine ? 'You: ' : ''}{c.last_message}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#8A8792', flexShrink: 0 }}>{relativeTime(c.last_message_at)}</span>
              </button>
            )
          })
        )}
      </div>

      {/* Thread */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#8A8792', fontSize: 13 }}>
            Select a conversation to start messaging.
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E6E3E8', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <Avatar initials={initialsOf(active.name)} color={avatarColor(active.id)} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{active.name}</div>
                <div style={{ fontSize: 12, color: '#8A8792', fontWeight: 500 }}>Student</div>
              </div>
            </div>

            <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingMessages ? (
                <div style={{ padding: 40, display: 'grid', placeItems: 'center' }}>
                  <Loader2 size={20} className="animate-spin" color="#7A3AE8" />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ fontSize: 13, color: '#8A8792', textAlign: 'center', padding: 24 }}>
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((m) => {
                  const mine = isMine(m.sender_id)
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
                      <Avatar
                        initials={mine ? tutorInitials : initialsOf(active.name)}
                        color={mine ? avatarColor(session?.user?.id ?? 'me') : avatarColor(active.id)}
                        src={mine ? tutorPhoto : null}
                        size={28}
                      />
                      <div>
                        <div
                          style={{
                            maxWidth: 400,
                            padding: '10px 14px',
                            borderRadius: 16,
                            fontSize: 13,
                            lineHeight: 1.55,
                            background: mine ? 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)' : '#F1EFE9',
                            color: mine ? 'white' : '#1C1B1F',
                            borderBottomRightRadius: mine ? 4 : 16,
                            borderBottomLeftRadius: mine ? 16 : 4,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {m.content}
                        </div>
                        <div style={{ fontSize: 10, color: '#8A8792', marginTop: 4, textAlign: mine ? 'right' : 'left' }}>
                          {formatMessageStamp(m.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {error && (
              <div style={{ margin: '0 16px 8px', padding: 8, background: '#FDE7E7', color: '#B12727', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <div style={{ padding: '12px 16px', borderTop: '1px solid #E6E3E8', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, background: 'white' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={`Message ${active.name.split(' ')[0]}…`}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  border: '1.5px solid #E6E3E8',
                  background: '#F7F5F0',
                  padding: '0 14px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: '#1C1B1F',
                  outline: 'none',
                }}
              />
              <button
                onClick={send}
                disabled={!draft.trim() || sending}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: 'none',
                  cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
                  color: 'white',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 4px 12px rgba(122,58,232,0.3)',
                  opacity: !draft.trim() || sending ? 0.5 : 1,
                }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <IcSend size={14} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   PROFILE panel
   ────────────────────────────────────────────────────────────────────────── */

function PanelProfile({
  profile,
  onSaveProfile,
  savingProfile,
  onSavePrices,
  savingPrices,
  onSaveAvailability,
  savingAvailability,
}: {
  profile: TutorProfile
  onSaveProfile: (patch: Partial<TutorProfile>) => Promise<void>
  savingProfile: boolean
  onSavePrices: (prices: Record<string, number>) => Promise<void>
  savingPrices: boolean
  onSaveAvailability: (a: Record<string, string[]>) => Promise<void>
  savingAvailability: boolean
}) {
  const [bio, setBio] = useState(profile.bio || '')
  const [editBio, setEditBio] = useState(false)
  const [avail, setAvail] = useState<Record<string, string[]>>(profile.availability || {})
  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [draftPrices, setDraftPrices] = useState<Record<string, number>>(profile.service_prices || {})

  useEffect(() => { setBio(profile.bio || '') }, [profile.bio])
  useEffect(() => { setAvail(profile.availability || {}) }, [profile.availability])
  useEffect(() => { setDraftPrices(profile.service_prices || {}) }, [profile.service_prices])

  const activeServices = profile.services ?? []
  const expertiseLabels = activeServices.map((id) => SERVICE_LABELS[id] ?? id)

  const tierFor = (rate: number, min: number, max: number) => {
    const t = (rate - min) / Math.max(max - min, 1)
    if (t <= 0.34) return { label: 'Low',      bg: '#D6F5E8', fg: '#1E7A4F' }
    if (t <= 0.67) return { label: 'Standard', bg: '#ECE7FC', fg: '#6C52E0' }
    return                { label: 'High',     bg: '#FEF3CD', fg: '#A06B00' }
  }

  function updateRate(id: string, v: string | number) {
    const num = Math.max(0, Math.min(RATE_HARD_MAX, Number(v) || 0))
    setDraftPrices((prev) => ({ ...prev, [id]: num }))
  }

  function removeSlot(day: string, time: string) {
    const next = { ...avail, [day]: (avail[day] ?? []).filter((t) => t !== time) }
    setAvail(next)
    onSaveAvailability(next)
  }

  function addSlot(day: string, time: string) {
    const existing = avail[day] ?? []
    if (existing.includes(time)) return
    const next = { ...avail, [day]: [...existing, time].sort() }
    setAvail(next)
    setOpenPicker(null)
    onSaveAvailability(next)
  }

  const avgRate =
    activeServices.length > 0
      ? Math.round(
          activeServices.reduce((sum, id) => sum + (draftPrices[id] ?? 0), 0) /
            activeServices.length,
        )
      : 0

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Public Profile */}
      <Card style={{ marginBottom: 20 }}>
        <SecHead title="Public Profile" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #E6E3E8' }}>
          <Avatar
            initials={initialsOf(profile.name)}
            color={avatarColor(profile.name)}
            src={profile.profile_photo}
            size={72}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{profile.name}</div>
            <div style={{ fontSize: 13, color: '#5A5862', marginBottom: 8 }}>
              {[profile.college, profile.major].filter(Boolean).join(' · ') || 'College student'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {expertiseLabels.length === 0 ? (
                <span style={{ fontSize: 12, color: '#8A8792' }}>No services configured yet.</span>
              ) : (
                expertiseLabels.map((e) => (
                  <Pill key={e} color="purple">{e}</Pill>
                ))
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Link href="/tutor/profile" style={{ textDecoration: 'none' }}>
              <BtnOutline>
                <IcEdit size={12} /> Full Editor
              </BtnOutline>
            </Link>
            <Link href="/find-tutors" style={{ textDecoration: 'none' }}>
              <BtnOutline>
                <ExternalLink size={12} /> Preview Profile
              </BtnOutline>
            </Link>
          </div>
        </div>

        <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Bio</span>
          <button
            onClick={() => {
              if (editBio) {
                onSaveProfile({ bio })
              }
              setEditBio(!editBio)
            }}
            disabled={savingProfile}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#7A62EA',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {savingProfile ? <Loader2 size={12} className="animate-spin" /> : <IcEdit size={12} />}
            {editBio ? 'Save' : 'Edit'}
          </button>
        </div>
        {editBio ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{
              width: '100%',
              minHeight: 100,
              borderRadius: 10,
              border: '1.5px solid #BDB0F5',
              background: '#F6F3FE',
              padding: '10px 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#1C1B1F',
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.6,
            }}
          />
        ) : (
          <p
            style={{
              fontSize: 13,
              color: '#5A5862',
              lineHeight: 1.7,
              background: '#F7F5F0',
              borderRadius: 10,
              padding: '10px 14px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {bio || 'No bio yet. Click Edit to add one.'}
          </p>
        )}
      </Card>

      {/* Rates by service */}
      <Card style={{ marginBottom: 20 }}>
        <SecHead title="Rates by Service" />
        <p style={{ fontSize: 12, color: '#8A8792', marginTop: -8, marginBottom: 18, lineHeight: 1.5 }}>
          Set your hourly rate for each service you offer. Tier shows where your price sits relative to the typical band.
        </p>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            padding: '10px 14px',
            background: '#F7F5F0',
            borderRadius: 10,
            marginBottom: 18,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {[
            ['Low', '#1E7A4F', '#D6F5E8'],
            ['Standard', '#6C52E0', '#ECE7FC'],
            ['High', '#A06B00', '#FEF3CD'],
          ].map(([l, fg, bg]) => (
            <div key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 10, borderRadius: 3, background: bg, border: `1.5px solid ${fg}`, opacity: 0.7 }} />
              <span style={{ color: fg }}>{l}</span>
            </div>
          ))}
        </div>

        {activeServices.length === 0 ? (
          <div style={{ padding: '24px 0', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
            You don&apos;t have any approved services yet. Once an admin approves a service on your application, you can set a rate here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {activeServices.map((id) => {
              const opt = SERVICE_OPTIONS.find((o) => o.id === id)
              const label = opt?.label ?? SERVICE_LABELS[id] ?? id
              const band = SERVICE_BANDS[id] ?? { min: 0, max: 200, icon: '📚' }
              const rate = draftPrices[id] ?? 0
              const visualRate = Math.max(band.min, Math.min(band.max, rate))
              const tier = tierFor(visualRate, band.min, band.max)
              const pct = ((visualRate - band.min) / Math.max(band.max - band.min, 1)) * 100
              return (
                <div key={id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px', gap: 18, alignItems: 'center' }}>
                  {/* Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F7F5F0', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>
                      {band.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A8792' }}>${band.min}–${band.max} /hr</div>
                    </div>
                  </div>

                  {/* Band slider */}
                  <div style={{ position: 'relative', height: 36 }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 14,
                        left: 0,
                        right: 0,
                        height: 8,
                        borderRadius: 999,
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div style={{ flex: 1, background: 'linear-gradient(90deg, #BFE9D2 0%, #D6F5E8 100%)' }} />
                      <div style={{ flex: 1, background: 'linear-gradient(90deg, #ECE7FC 0%, #D9D0FA 100%)' }} />
                      <div style={{ flex: 1, background: 'linear-gradient(90deg, #FEF3CD 0%, #FBE49A 100%)' }} />
                    </div>
                    {[33.33, 66.67].map((p) => (
                      <div
                        key={p}
                        style={{
                          position: 'absolute',
                          top: 11,
                          height: 14,
                          width: 2,
                          left: `${p}%`,
                          background: 'white',
                          borderRadius: 1,
                          opacity: 0.9,
                        }}
                      />
                    ))}
                    <input
                      type="range"
                      min={band.min}
                      max={band.max}
                      step={1}
                      value={visualRate}
                      onChange={(e) => updateRate(id, e.target.value)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: -8,
                        right: -8,
                        width: 'calc(100% + 16px)',
                        height: 36,
                        opacity: 0,
                        cursor: 'pointer',
                        margin: 0,
                        zIndex: 2,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: `calc(${pct}% - 11px)`,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'white',
                        border: `3px solid ${tier.fg}`,
                        boxShadow: '0 2px 6px rgba(28,27,31,0.18), 0 0 0 4px rgba(255,255,255,0.6)',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: -2, left: 0, fontSize: 9, color: '#8A8792', fontWeight: 600 }}>${band.min}</div>
                    <div style={{ position: 'absolute', bottom: -2, right: 0, fontSize: 9, color: '#8A8792', fontWeight: 600 }}>${band.max}</div>
                  </div>

                  {/* Rate input + tier */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
                      <span style={{ fontSize: 11, color: '#8A8792', fontWeight: 600 }}>$</span>
                      <input
                        type="number"
                        value={rate}
                        min={0}
                        max={RATE_HARD_MAX}
                        onChange={(e) => updateRate(id, e.target.value)}
                        style={{
                          width: 56,
                          fontFamily: 'inherit',
                          fontSize: 18,
                          fontWeight: 700,
                          color: '#1C1B1F',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'right',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#8A8792', fontWeight: 600 }}>/hr</span>
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 9px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: tier.bg,
                        color: tier.fg,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {tier.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeServices.length > 0 && (
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: '1px solid #E6E3E8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: '#5A5862' }}>
              <span style={{ fontWeight: 600, color: '#1C1B1F' }}>Average rate:</span> ${avgRate}/hr across {activeServices.length} service
              {activeServices.length === 1 ? '' : 's'}
            </div>
            <BtnPrimary onClick={() => onSavePrices(draftPrices)} disabled={savingPrices}>
              {savingPrices ? <Loader2 size={12} className="animate-spin" /> : null}
              Save Rates
            </BtnPrimary>
          </div>
        )}
      </Card>

      {/* Weekly Availability */}
      <Card>
        <SecHead title="Weekly Availability" />
        <p style={{ fontSize: 12, color: '#8A8792', marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
          Each pill is a 1-hour slot bookable by students. Changes save automatically.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {DAYS.map((day) => {
            const slots = (avail[day] ?? []).slice().sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b))
            const free = TIME_SLOTS.filter((t) => !slots.includes(t))
            const pickerOpen = openPicker === day
            return (
              <div
                key={day}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '14px 0',
                  borderBottom: '1px solid #E6E3E8',
                  position: 'relative',
                }}
              >
                <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: slots.length > 0 ? '#2FA46A' : '#E6E3E8',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: slots.length > 0 ? '#1C1B1F' : '#8A8792' }}>
                    {day}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {slots.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#8A8792', fontStyle: 'italic' }}>No availability</span>
                  ) : (
                    slots.map((slot) => (
                      <div
                        key={slot}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          borderRadius: 999,
                          background: '#F6F3FE',
                          border: '1.5px solid #D9D0FA',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#6C52E0',
                        }}
                      >
                        {slot}
                        <button
                          onClick={() => removeSlot(day, slot)}
                          disabled={savingAvailability}
                          aria-label={`Remove ${slot}`}
                          style={{
                            cursor: 'pointer',
                            color: '#9B86F0',
                            lineHeight: 1,
                            fontSize: 14,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}

                  {free.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setOpenPicker(pickerOpen ? null : day)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: '1.5px dashed #E6E3E8',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#8A8792',
                        }}
                      >
                        <IcPlus size={12} /> Add
                      </button>
                      {pickerOpen && (
                        <>
                          <div onClick={() => setOpenPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 6px)',
                              left: 0,
                              background: 'white',
                              borderRadius: 10,
                              boxShadow: '0 8px 24px rgba(28,27,31,0.12)',
                              padding: 6,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 4,
                              zIndex: 50,
                              maxHeight: 240,
                              overflowY: 'auto',
                              minWidth: 200,
                            }}
                          >
                            {free.map((t) => (
                              <button
                                key={t}
                                onClick={() => addSlot(day, t)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: 'transparent',
                                  border: '1px solid #E6E3E8',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  color: '#1C1B1F',
                                  textAlign: 'left',
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   APP SHELL
   ────────────────────────────────────────────────────────────────────────── */

type PanelId = 'home' | 'sessions' | 'earnings' | 'analytics' | 'messages' | 'profile'

const NAV: { id: PanelId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'home',      label: 'Home',      icon: IcHome },
  { id: 'sessions',  label: 'Sessions',  icon: IcCal },
  { id: 'earnings',  label: 'Earnings',  icon: IcDollar },
  { id: 'analytics', label: 'Analytics', icon: IcChart },
  { id: 'messages',  label: 'Messages',  icon: IcMsg },
  { id: 'profile',   label: 'Profile',   icon: IcUser },
]

const META: Record<PanelId, [string, string]> = {
  home:      ['Dashboard',  ''],
  sessions:  ['Sessions',   'Upcoming & completed'],
  earnings:  ['Earnings',   'Payments & history'],
  analytics: ['Analytics',  'Performance overview'],
  messages:  ['Messages',   'Talk to your students'],
  profile:   ['Profile & Availability', 'Edit your public listing'],
}

export default function TutorDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [attempts, setAttempts] = useState<TutorAttempt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<'general' | 'no-profile' | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [panel, setPanel] = useState<PanelId>('home')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const viewerTz = useViewerTimezone()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  const fetchDashboard = useCallback(() => {
    setLoading(true)
    setError(null)
    setErrorKind(null)
    fetch('/api/tutor/dashboard')
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 403) {
            const body = await r.json().catch(() => null)
            if (body?.status === 'suspended' || body?.status === 'banned') {
              router.replace('/tutor/suspended')
              throw new Error('INACTIVE')
            }
          }
          if (r.status === 404) {
            setErrorKind('no-profile')
            throw new Error('NO_PROFILE')
          }
          throw new Error('Failed to load dashboard')
        }
        return r.json()
      })
      .then((d) => setData(d))
      .catch((err) => {
        if (err.message === 'INACTIVE' || err.message === 'NO_PROFILE') return
        setErrorKind('general')
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchDashboard()
  }, [status, fetchDashboard])

  useEffect(() => {
    if (status !== 'authenticated') return
    // Side-load practice-test submissions so the recent-attempts card on
    // Home can render. The main dashboard endpoint doesn't include these
    // because they're tutor-wide rather than per-profile and we'd rather
    // not block the rest of the dashboard on a third roundtrip.
    fetch('/api/tutor/attempts')
      .then((r) => (r.ok ? r.json() : { attempts: [] }))
      .then((d) => setAttempts(d.attempts ?? []))
      .catch(() => setAttempts([]))
  }, [status])

  async function cancelSession(sessionId: string) {
    setCancelling(sessionId)
    try {
      const res = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Failed to cancel')
      // Refresh so all aggregates (stats, pending, charts) stay consistent.
      fetchDashboard()
    } catch {
      setError('Failed to cancel session')
    } finally {
      setCancelling(null)
    }
  }

  async function saveAvailability(a: Record<string, string[]>) {
    setSavingAvailability(true)
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: a }),
      })
      if (!res.ok) throw new Error('Failed to save availability')
      setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, availability: a } } : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingAvailability(false)
    }
  }

  async function saveServicePrices(prices: Record<string, number>) {
    setSavingPrices(true)
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicePrices: prices }),
      })
      if (!res.ok) throw new Error('Failed to save prices')
      setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, service_prices: prices } } : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingPrices(false)
    }
  }

  async function saveProfilePatch(patch: Partial<TutorProfile>) {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Failed to save profile')
      setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...patch } } : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingProfile(false)
    }
  }

  const filteredSessions = useMemo(() => {
    if (!data || !search.trim()) return null
    const q = search.trim().toLowerCase()
    const all = [...data.upcoming, ...data.past]
    return all.filter(
      (s) => s.student_name.toLowerCase().includes(q) || s.time_slot.toLowerCase().includes(q),
    )
  }, [data, search])

  // Hook must run unconditionally (Rules of Hooks) — the mobile branch sits
  // below the loading/error early returns, but the hook call cannot.
  const isMobile = useIsMobile()

  /* ── Loading / error states keep the same access logic as before ──────── */

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <FullPageMessage>
        <Loader2 className="animate-spin" size={32} color="#7A3AE8" />
        <p style={{ marginTop: 12, color: '#5A5862', fontSize: 14 }}>Loading your dashboard…</p>
      </FullPageMessage>
    )
  }

  if (errorKind === 'no-profile') {
    return (
      <FullPageMessage>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F6F3FE', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
          <IcUser size={28} color="#7A3AE8" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1C1B1F', marginBottom: 8 }}>Complete your profile</h1>
        <p style={{ color: '#5A5862', fontSize: 14, marginBottom: 20, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
          You need an approved application and a completed tutor profile to access the dashboard.
        </p>
        <Link
          href="/tutor/onboarding"
          style={{
            padding: '10px 20px',
            borderRadius: 999,
            background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Set up profile
        </Link>
      </FullPageMessage>
    )
  }

  if (errorKind === 'general' || !data) {
    return (
      <FullPageMessage>
        <AlertCircle size={32} color="#B12727" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1C1B1F', marginTop: 12, marginBottom: 6 }}>Something went wrong</h1>
        <p style={{ color: '#5A5862', fontSize: 13, marginBottom: 20 }}>{error ?? 'Could not load your dashboard.'}</p>
        <BtnPrimary onClick={() => { setError(null); setErrorKind(null); fetchDashboard() }}>
          Try Again
        </BtnPrimary>
      </FullPageMessage>
    )
  }

  const [title, sub] = META[panel]

  if (isMobile) {
    const onJoinSession = (id: string) => router.push(`/session/${id}`)
    return (
      <MobileTutorDashboard
        data={data}
        panel={panel}
        setPanel={setPanel}
        onJoinSession={onJoinSession}
        onSaveProfile={saveProfilePatch}
        savingProfile={savingProfile}
        onSavePrices={saveServicePrices}
        savingPrices={savingPrices}
        onSaveAvailability={saveAvailability}
        savingAvailability={savingAvailability}
      />
    )
  }

  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        body { background: #F7F5F0; }
        .kd-side-btn:hover { background: rgba(122,98,234,0.18); }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 72,
            background: '#2E2C34',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0 24px',
            flexShrink: 0,
            zIndex: 10,
            gap: 4,
          }}
        >
          <Link
            href="/home"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
              display: 'grid',
              placeItems: 'center',
              marginBottom: 28,
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontFamily: '"Shrikhand", serif', color: 'white', fontSize: 22, lineHeight: 1 }}>k</span>
          </Link>

          {NAV.map((item) => {
            const Icon = item.icon
            const active = panel === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPanel(item.id)}
                className="kd-side-btn"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: 4,
                  border: 'none',
                  background: active ? 'rgba(122,98,234,0.28)' : 'transparent',
                  color: active ? '#BDB0F5' : 'rgba(255,255,255,0.45)',
                }}
              >
                <Icon size={20} />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: active ? '#BDB0F5' : 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Link
              href="/tutor/profile"
              title="Full profile editor"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.4)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <IcGear size={18} />
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              title="Sign out"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.4)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
            </button>
            <Avatar
              initials={initialsOf(data.profile.name)}
              color={avatarColor(data.profile.name)}
              src={data.profile.profile_photo}
              size={36}
            />
          </div>
        </aside>

        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <div
            style={{
              height: 60,
              background: 'white',
              borderBottom: '1px solid #E6E3E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 32px',
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
              {sub && <div style={{ fontSize: 12, color: '#8A8792', fontWeight: 500 }}>{sub}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A8792' }}>
                  <IcSearch size={14} />
                </div>
                <input
                  placeholder="Search sessions…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(!!e.target.value) }}
                  onFocus={() => search && setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: '1.5px solid #E6E3E8',
                    background: '#F7F5F0',
                    paddingLeft: 30,
                    paddingRight: 12,
                    width: 220,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    color: '#1C1B1F',
                    outline: 'none',
                  }}
                />
                {searchOpen && filteredSessions && filteredSessions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'white',
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(28,27,31,0.12)',
                      padding: 6,
                      zIndex: 30,
                      maxHeight: 320,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredSessions.slice(0, 8).map((s) => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => { e.preventDefault(); setPanel('sessions'); setSearch(''); setSearchOpen(false) }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        <strong>{s.student_name}</strong> · {formatShortDate(s, viewerTz)} · {convertSlotToTimezone(s.scheduled_date, s.time_slot, sessionSourceTz(s), viewerTz)?.time ?? s.time_slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Link
                href="/tutor/tests"
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1.5px solid #E6E3E8',
                  background: '#F7F5F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#5A5862',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ClipboardList size={14} /> My Tests
              </Link>
              <TimezoneSelector />
              <Link
                href="/sessions"
                title="Notifications"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1.5px solid #E6E3E8',
                  background: '#F7F5F0',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#5A5862',
                  position: 'relative',
                  textDecoration: 'none',
                }}
              >
                <IcBell size={16} />
                {data.stats.upcomingCount > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#E882CC',
                      border: '1.5px solid #F7F5F0',
                    }}
                  />
                )}
              </Link>
            </div>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
            {panel === 'home' && <PanelHome data={data} attempts={attempts} setPanel={setPanel} />}
            {panel === 'sessions' && (
              <PanelSessions
                upcoming={data.upcoming}
                past={data.past}
                onCancel={cancelSession}
                cancelling={cancelling}
              />
            )}
            {panel === 'earnings' && <PanelEarnings data={data} />}
            {panel === 'analytics' && <PanelAnalytics data={data} />}
            {panel === 'messages' && <PanelMessages tutorPhoto={data.profile.profile_photo} />}
            {panel === 'profile' && (
              <PanelProfile
                profile={data.profile}
                onSaveProfile={saveProfilePatch}
                savingProfile={savingProfile}
                onSavePrices={saveServicePrices}
                savingPrices={savingPrices}
                onSaveAvailability={saveAvailability}
                savingAvailability={savingAvailability}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { height: 100%; }`}</style>
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          background: '#F7F5F0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {children}
      </div>
    </>
  )
}
