'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════
//  Design tokens (scoped to dashboard via :root override on the wrapper)
// ═══════════════════════════════════════════════════════════════════════
const DASH_VARS: CSSProperties = {
  // Purples
  ['--p900' as string]: '#2A1B6B',
  ['--p700' as string]: '#4B38B3',
  ['--p600' as string]: '#6C52E0',
  ['--p500' as string]: '#7A62EA',
  ['--p400' as string]: '#9B86F0',
  ['--p300' as string]: '#BDB0F5',
  ['--p200' as string]: '#D9D0FA',
  ['--p100' as string]: '#ECE7FC',
  ['--p050' as string]: '#F6F3FE',
  // Neutrals
  ['--ink' as string]: '#1C1B1F',
  ['--ink2' as string]: '#2E2C34',
  ['--graphite' as string]: '#5A5862',
  ['--mute' as string]: '#8A8792',
  ['--hair' as string]: '#E6E3E8',
  ['--s2' as string]: '#F1EFE9',
  ['--s1' as string]: '#F7F5F0',
  ['--s0' as string]: '#FFFFFF',
  // Status
  ['--amber' as string]: '#F5C242',
  ['--success' as string]: '#2FA46A',
  // Gradients
  ['--grad' as string]: 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)',
  ['--gradsoft' as string]: 'linear-gradient(135deg,#82AAEE 0%,#B47AE8 52%,#E882CC 100%)',
  ['--sh1' as string]: '0 1px 2px rgba(28,27,31,.04),0 2px 6px rgba(28,27,31,.05)',
  ['--sh2' as string]: '0 2px 4px rgba(28,27,31,.04),0 8px 20px rgba(28,27,31,.07)',
  ['--ease' as string]: 'cubic-bezier(.2,.0,.0,1)',
}

// ═══════════════════════════════════════════════════════════════════════
//  Icons (re-rendered each call to avoid React key warnings on reuse)
// ═══════════════════════════════════════════════════════════════════════
const Icon = {
  home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  essay: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
  testing: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  activities: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  messages: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
  discover: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  video: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
  ),
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

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--hair)', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', borderRadius: 999, background: 'var(--grad)', width: `${pct}%`, transition: 'width 0.8s var(--ease)' }} />
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
//  Mock data (matching the handoff prototype)
// ═══════════════════════════════════════════════════════════════════════
type Status = 'upcoming' | 'past'
interface SessionItem {
  id: number
  initials: string
  name: string
  school: string
  topic: string
  when: string
  status: Status
  color: string
}

const SESSION_DATA: { essays: SessionItem[]; testing: SessionItem[]; activities: SessionItem[] } = {
  essays: [
    { id: 1, initials: 'MH', name: 'Michael Haskins', school: "Michigan '29", topic: 'Common App Essay Review', when: 'Tomorrow · 4:30 PM', status: 'upcoming', color: '#7A62EA' },
    { id: 2, initials: 'EM', name: 'Ella McIlwain',   school: "UF '29",       topic: 'Personal Statement Draft', when: 'May 2 · 3:00 PM',  status: 'upcoming', color: '#8177C9' },
    { id: 3, initials: 'MH', name: 'Michael Haskins', school: "Michigan '29", topic: 'Essay Outline Session',    when: 'Apr 18',           status: 'past',     color: '#7A62EA' },
    { id: 4, initials: 'EM', name: 'Ella McIlwain',   school: "UF '29",       topic: 'Hook & Introduction',      when: 'Apr 10',           status: 'past',     color: '#8177C9' },
  ],
  testing: [
    { id: 5, initials: 'BP', name: 'Ben Pinero', school: "Duke '29", topic: 'SAT Math Strategies', when: 'Sat · 11:00 AM',  status: 'upcoming', color: '#B47AE8' },
    { id: 6, initials: 'AS', name: 'Alex Sokol', school: "Yale '29", topic: 'ACT Science Review',  when: 'May 3 · 1:00 PM', status: 'upcoming', color: '#7A3AE8' },
    { id: 7, initials: 'BP', name: 'Ben Pinero', school: "Duke '29", topic: 'SAT Practice Review', when: 'Apr 15',          status: 'past',     color: '#B47AE8' },
    { id: 8, initials: 'AS', name: 'Alex Sokol', school: "Yale '29", topic: 'ACT Reading Drill',   when: 'Apr 8',           status: 'past',     color: '#7A3AE8' },
  ],
  activities: [
    { id: 9,  initials: 'DR', name: 'Diyah Rahaman', school: "Cornell '29", topic: 'Activities List Strategy', when: 'Fri · 2:00 PM',   status: 'upcoming', color: '#9B86F0' },
    { id: 10, initials: 'KF', name: 'Khady Fall',    school: "Cornell '29", topic: 'Extracurricular Framing',  when: 'May 5 · 4:00 PM', status: 'upcoming', color: '#BDB0F5' },
    { id: 11, initials: 'DR', name: 'Diyah Rahaman', school: "Cornell '29", topic: 'Activities Brainstorm',    when: 'Apr 10',          status: 'past',     color: '#9B86F0' },
  ],
}

interface DraftItem {
  id: number
  title: string
  status: string
  pct: number
  updated: string
  tutor: string
}
const DRAFTS: DraftItem[] = [
  { id: 1, title: 'Common App Personal Statement', status: 'In Progress', pct: 70,  updated: 'Assigned by Alex S.',  tutor: 'Michael H.' },
  { id: 2, title: 'Why Cornell Supplemental Essay', status: 'Not Started', pct: 0,   updated: 'Assigned by Alex S.',  tutor: 'Michael H.' },
  { id: 3, title: 'Common App Personal Statement', status: 'In Progress', pct: 40,  updated: 'Assigned by Alex S.',  tutor: 'Ella M.'    },
  { id: 4, title: 'Common App Personal Statement', status: 'Draft Done',  pct: 100, updated: 'Completed Apr 12',     tutor: 'Ella M.'    },
]

const ACTIVITIES_LIST = [
  { id: 1, title: 'Varsity Soccer Team',          role: 'Captain (Junior Year)',         category: 'Athletics',  status: 'finalized'   as const },
  { id: 2, title: 'Student Government',           role: 'Class Representative',          category: 'Leadership', status: 'finalized'   as const },
  { id: 3, title: 'Science Olympiad',             role: 'Team Member & Event Lead',       category: 'Academic',   status: 'needs-work'  as const },
  { id: 4, title: 'Hospital Volunteering',        role: 'Weekly Saturday Shifts',         category: 'Community',  status: 'needs-work'  as const },
  { id: 5, title: 'Independent Research Project', role: 'Computational Biology Lab, NYU', category: 'Research',   status: 'not-started' as const },
  { id: 6, title: 'Math Tutoring',                role: 'Peer Tutor, 2 hrs/week',         category: 'Service',    status: 'not-started' as const },
]

const TUTORS_ALL = [
  { initials: 'KF', name: 'Khady Fall',    school: "Cornell '29",  major: 'Global Development',   rating: 4.9, reviews: 18, price: 20, tags: ['Activities', 'Essays'],   color: '#9B86F0' },
  { initials: 'EM', name: 'Ella McIlwain', school: "UF '29",       major: 'Nutritional Sciences', rating: 5.0, reviews: 12, price: 22, tags: ['Essay Writing'],          color: '#8177C9' },
  { initials: 'AS', name: 'Alex Sokol',    school: "Yale '29",     major: 'Biomedical Eng.',      rating: 4.7, reviews: 22, price: 28, tags: ['ACT Prep', 'Test Prep'],   color: '#7A3AE8' },
  { initials: 'JT', name: 'Jordan Torres', school: "Penn '29",     major: 'Finance',              rating: 4.9, reviews: 15, price: 24, tags: ['Essays', 'Mock Interview'], color: '#BDB0F5' },
  { initials: 'SR', name: 'Sofia Reyes',   school: "Stanford '29", major: 'CS',                   rating: 5.0, reviews: 8,  price: 35, tags: ['SAT Prep', 'Test Prep'],   color: '#6C52E0' },
  { initials: 'MR', name: 'Maya Robinson', school: "Brown '29",    major: 'Psychology',           rating: 4.8, reviews: 11, price: 22, tags: ['Common App', 'Essays'],   color: '#B47AE8' },
]

// ═══════════════════════════════════════════════════════════════════════
//  Real data: assigned practice tests
// ═══════════════════════════════════════════════════════════════════════
interface AssignedTest {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  created_at: string
  tutor_name: string | null
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

// ═══════════════════════════════════════════════════════════════════════
//  Session row (for upcoming/past meetings)
// ═══════════════════════════════════════════════════════════════════════
function SessionRow({ s }: { s: SessionItem }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0', borderBottom: '1px solid var(--hair)',
    }}>
      <Avatar initials={s.initials} color={s.color} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{s.name}</div>
        <div style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>{s.topic} · {s.school}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--graphite)', display: 'inline-flex', alignItems: 'center' }}>
          {Icon.cal()} {s.when}
        </span>
        {s.status === 'upcoming'
          ? <BtnPrimary>{Icon.play()} Join</BtnPrimary>
          : <BtnOutline>View Notes</BtnOutline>}
      </div>
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
  onStartTest,
}: {
  setPanel: (p: PanelKey) => void
  firstName: string
  tests: AssignedTest[]
  onStartTest: (id: string) => void
}) {
  const upcomingCount =
    SESSION_DATA.essays.filter((s) => s.status === 'upcoming').length +
    SESSION_DATA.testing.filter((s) => s.status === 'upcoming').length +
    SESSION_DATA.activities.filter((s) => s.status === 'upcoming').length
  const pastCount =
    SESSION_DATA.essays.filter((s) => s.status === 'past').length +
    SESSION_DATA.testing.filter((s) => s.status === 'past').length +
    SESSION_DATA.activities.filter((s) => s.status === 'past').length

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
          Your next session with <strong style={{ color: 'white' }}>Michael Haskins</strong> is tomorrow at 4:30 PM.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            [String(upcomingCount), 'Upcoming sessions'],
            ['$240', 'Total spent'],
            ['4.9', 'Avg tutor rating'],
            [String(pastCount), 'Sessions done'],
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
        {/* Upcoming */}
        <Card>
          <SectionHeader title="Upcoming Sessions" action="View all" onAction={() => setPanel('essays')} />
          {SESSION_DATA.essays.filter((s) => s.status === 'upcoming').slice(0, 2).map((s) => <SessionRow key={s.id} s={s} />)}
          {SESSION_DATA.testing.filter((s) => s.status === 'upcoming').slice(0, 1).map((s) => <SessionRow key={s.id} s={s} />)}
        </Card>

        {/* Assignments — real assigned practice tests */}
        <Card>
          <SectionHeader title="Assignments" action="View all" onAction={() => setPanel('testing')} />
          {tests.length === 0 ? (
            <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--mute)', textAlign: 'center' }}>
              No practice tests assigned yet.
            </div>
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

        {/* Messages preview */}
        <Card>
          <SectionHeader title="Messages" action="Open" onAction={() => setPanel('messages')} />
          {[
            { initials: 'MH', name: 'Michael Haskins', preview: 'Great work on the intro! Let’s…',  time: '2m', unread: true,  color: '#7A62EA' },
            { initials: 'DR', name: 'Diyah Rahaman',   preview: 'Can you send the updated draft?',  time: '1h', unread: false, color: '#9B86F0' },
            { initials: 'BP', name: 'Ben Pinero',      preview: "Here are this week's SAT tips.",   time: '3h', unread: false, color: '#B47AE8' },
          ].map((t) => (
            <div key={t.name} onClick={() => setPanel('messages')} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
              transition: 'background .15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar initials={t.initials} color={t.color} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--mute)' }}>{t.time}</span>
                {t.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--p500)' }} />}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function PanelEssays() {
  const [tab, setTab] = useState('drafts')
  const sessions = SESSION_DATA.essays

  return (
    <div>
      <Tabs value={tab} onChange={setTab} options={[{ v: 'drafts', l: 'My Drafts' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'drafts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {DRAFTS.map((d) => (
            <Card key={d.id} style={{ cursor: 'pointer', transition: 'box-shadow .2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1, marginRight: 12, lineHeight: 1.35 }}>{d.title}</div>
                <Pill color={d.pct === 100 ? 'green' : d.pct > 0 ? 'amber' : 'mute'}>{d.status}</Pill>
              </div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{d.updated} · Tutor: {d.tutor}</div>
              {d.pct > 0 && (
                <>
                  <ProgressBar pct={d.pct} />
                  <div style={{ fontSize: 11, color: 'var(--p500)', fontWeight: 600, marginTop: 5 }}>{d.pct}% complete</div>
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <BtnPrimary style={{ fontSize: 11 }}>Open Draft</BtnPrimary>
                <BtnOutline style={{ fontSize: 11 }}>Request Feedback</BtnOutline>
              </div>
            </Card>
          ))}
        </div>
      )}
      {tab === 'sessions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upcoming</div>
          <Card style={{ marginBottom: 20 }}>
            {sessions.filter((s) => s.status === 'upcoming').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {sessions.filter((s) => s.status === 'past').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
        </div>
      )}
    </div>
  )
}

function PanelTesting({
  tests,
  loading,
  onStartTest,
}: {
  tests: AssignedTest[]
  loading: boolean
  onStartTest: (id: string) => void
}) {
  const [tab, setTab] = useState('tests')
  const sessions = SESSION_DATA.testing

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
            {sessions.filter((s) => s.status === 'upcoming').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {sessions.filter((s) => s.status === 'past').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
        </div>
      )}
    </div>
  )
}

function PanelActivities() {
  const [tab, setTab] = useState('list')
  const sessions = SESSION_DATA.activities
  const statusStyle: Record<'finalized' | 'needs-work' | 'not-started', PillColor> = {
    finalized: 'green', 'needs-work': 'amber', 'not-started': 'mute',
  }
  const statusLabel = { finalized: 'Finalized', 'needs-work': 'Needs Work', 'not-started': 'Not Started' }

  return (
    <div>
      <Tabs value={tab} onChange={setTab} options={[{ v: 'list', l: 'Activities List' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ACTIVITIES_LIST.map((a, i) => (
            <Card key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'var(--p100)', color: 'var(--p600)',
                display: 'grid', placeItems: 'center',
                fontSize: 13, fontWeight: 700,
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>{a.role}</div>
              </div>
              <Pill color="mute">{a.category}</Pill>
              <Pill color={statusStyle[a.status]}>{statusLabel[a.status]}</Pill>
              <BtnOutline style={{ fontSize: 11 }}>Edit</BtnOutline>
            </Card>
          ))}
          <Card style={{ border: '2px dashed var(--hair)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', cursor: 'pointer', gap: 8 }}>
            <span style={{ fontSize: 20, color: 'var(--mute)' }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Add activity</span>
          </Card>
        </div>
      )}
      {tab === 'sessions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Upcoming</div>
          <Card style={{ marginBottom: 20 }}>
            {sessions.filter((s) => s.status === 'upcoming').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Past</div>
          <Card>
            {sessions.filter((s) => s.status === 'past').map((s) => <SessionRow key={s.id} s={s} />)}
          </Card>
        </div>
      )}
    </div>
  )
}

interface ChatMessage { me: boolean; text: string; time: string }

function PanelMessages() {
  const [msgs, setMsgs] = useState<ChatMessage[]>([
    { me: false, text: "Hey Alex! I just read through your Common App intro — solid start. The hook is really personal.", time: 'Yesterday 4:02 PM' },
    { me: true,  text: "Thanks! I wasn't sure if the opening line was too casual. Should I keep it?", time: 'Yesterday 4:18 PM' },
    { me: false, text: "Keep it! The casual voice actually works in your favor. Let's tighten the second paragraph though.", time: 'Yesterday 4:31 PM' },
    { me: true,  text: 'Perfect, thank you. See you tomorrow at 4:30!', time: 'Yesterday 4:35 PM' },
    { me: false, text: "Great work on the intro! Let's nail the conclusion tomorrow 💪", time: '2 min ago' },
  ])
  const [input, setInput] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  const send = () => {
    if (!input.trim()) return
    setMsgs((m) => [...m, { me: true, text: input.trim(), time: 'Just now' }])
    setInput('')
    setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = 9999 }, 50)
  }

  const threads = [
    { initials: 'MH', name: 'Michael Haskins', preview: 'Great work on the intro!', time: '2m',        unread: true,  color: '#7A62EA', active: true  },
    { initials: 'DR', name: 'Diyah Rahaman',   preview: 'Can you send the draft?',  time: '1h',        unread: false, color: '#9B86F0', active: false },
    { initials: 'BP', name: 'Ben Pinero',      preview: 'SAT tips inside',          time: '3h',        unread: false, color: '#B47AE8', active: false },
    { initials: 'EM', name: 'Ella McIlwain',   preview: 'See you next Tuesday!',    time: 'Yesterday', unread: false, color: '#8177C9', active: false },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '260px 1fr',
      background: 'var(--s0)', borderRadius: 16, boxShadow: 'var(--sh1)',
      overflow: 'hidden', height: 'calc(100vh - 168px)',
    }}>
      <div style={{ borderRight: '1px solid var(--hair)', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink)', borderBottom: '1px solid var(--hair)' }}>Conversations</div>
        {threads.map((t) => (
          <div key={t.name} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
            background: t.active ? 'var(--p050)' : 'transparent', transition: 'background .15s',
          }}>
            <Avatar initials={t.initials} color={t.color} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.preview}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>{t.time}</span>
              {t.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--p500)' }} />}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials="MH" color="#7A62EA" size={36} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Michael Haskins</div>
            <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>● Online now</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {[Icon.video, Icon.bell].map((Ic, i) => (
              <div key={i} style={{
                width: 34, height: 34, borderRadius: 10, border: '1.5px solid var(--hair)',
                background: 'var(--s1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--graphite)',
              }}><Ic /></div>
            ))}
          </div>
        </div>
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: m.me ? 'row-reverse' : 'row' }}>
              <Avatar initials={m.me ? 'AJ' : 'MH'} color={m.me ? '#9B86F0' : '#7A62EA'} size={28} />
              <div>
                <div style={{
                  maxWidth: 400, padding: '10px 14px', borderRadius: 16, fontSize: 13, lineHeight: 1.55,
                  background: m.me ? 'var(--grad)' : 'var(--s2)',
                  color: m.me ? 'white' : 'var(--ink)',
                  borderBottomRightRadius: m.me ? 4 : 16,
                  borderBottomLeftRadius: m.me ? 16 : 4,
                }}>{m.text}</div>
                <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 4, textAlign: m.me ? 'right' : 'left' }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--hair)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Message Michael…"
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
      </div>
    </div>
  )
}

function PanelDiscover() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }}>{Icon.search()}</div>
          <input placeholder="Search tutors, schools, subjects…" style={{
            width: '100%', height: 40, borderRadius: 12, border: '1.5px solid var(--hair)',
            background: 'var(--s0)', paddingLeft: 34, paddingRight: 12,
            fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none',
          }} />
        </div>
        {['Essays', 'Test Prep', 'Activities', 'Common App'].map((f, i) => (
          <button key={f} style={{
            padding: '8px 16px', borderRadius: 999,
            background: i === 0 ? 'var(--p100)' : 'var(--s0)',
            color: i === 0 ? 'var(--p600)' : 'var(--graphite)',
            border: i === 0 ? '1.5px solid var(--p300)' : '1.5px solid var(--hair)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {TUTORS_ALL.map((t) => (
          <Card key={t.name} style={{ cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Avatar initials={t.initials} color={t.color} size={50} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>{t.school} · {t.major}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={{ color: 'var(--amber)', fontSize: 13 }}>★</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{t.rating}</span>
                  <span style={{ fontSize: 11, color: 'var(--mute)' }}>({t.reviews}) · ${t.price}/hr</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {t.tags.map((tag, i) => (
                <span key={tag} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: i === 0 ? 'var(--p050)' : 'var(--s2)',
                  color: i === 0 ? 'var(--p600)' : 'var(--graphite)',
                }}>{tag}</span>
              ))}
            </div>
            <BtnPrimary style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>BOOK SESSION</BtnPrimary>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PanelSettings({ name, email }: { name: string; email: string }) {
  const txns = [
    { initials: 'MH', name: 'Michael Haskins', type: 'Essay Writing', date: 'Apr 23', amount: 20, color: '#7A62EA' },
    { initials: 'BP', name: 'Ben Pinero',      type: 'SAT Prep',      date: 'Apr 21', amount: 30, color: '#B47AE8' },
    { initials: 'DR', name: 'Diyah Rahaman',   type: 'Activities',    date: 'Apr 18', amount: 20, color: '#9B86F0' },
    { initials: 'MH', name: 'Michael Haskins', type: 'Essay Writing', date: 'Apr 15', amount: 20, color: '#7A62EA' },
    { initials: 'BP', name: 'Ben Pinero',      type: 'SAT Prep',      date: 'Apr 12', amount: 30, color: '#B47AE8' },
  ]
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AJ'
  return (
    <div style={{ maxWidth: 720 }}>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Account" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <Avatar initials={initials} color="#7A62EA" size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>{email} · High School Student</div>
          </div>
          <BtnOutline style={{ marginLeft: 'auto' }}>Edit Profile</BtnOutline>
        </div>
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Spending & Transactions" />
        <div style={{ display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--hair)' }}>
          {[['$240', 'Total spent'], ['12', 'Sessions'], ['$20', 'Avg/session']].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
        {txns.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--hair)' }}>
            <Avatar initials={t.initials} color={t.color} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)' }}>{t.type} · {t.date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>−${t.amount}</div>
          </div>
        ))}
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
type PanelKey = 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'discover' | 'settings'

const NAV_ITEMS: { id: PanelKey; label: string; icon: () => React.ReactElement; badge?: boolean }[] = [
  { id: 'home',       label: 'Home',       icon: Icon.home },
  { id: 'essays',     label: 'Essays',     icon: Icon.essay },
  { id: 'testing',    label: 'Testing',    icon: Icon.testing },
  { id: 'activities', label: 'Activities', icon: Icon.activities },
  { id: 'messages',   label: 'Messages',   icon: Icon.messages, badge: true },
  { id: 'discover',   label: 'Discover',   icon: Icon.discover },
]

const PANEL_META: Record<PanelKey, [string, string]> = {
  home:       ['', ''],
  essays:     ['Essays',          'Drafts & sessions'],
  testing:    ['Testing',         'Practice tests & sessions'],
  activities: ['Activities',      'Activities list & sessions'],
  messages:   ['Messages',        '2 unread conversations'],
  discover:   ['Discover Tutors', '200+ tutors at top universities'],
  settings:   ['Settings',        'Account, spending & notifications'],
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

export default function StudentDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [panel, setPanel] = useState<PanelKey>('home')
  const [tests, setTests] = useState<AssignedTest[]>([])
  const [testsLoading, setTestsLoading] = useState(true)

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
  }, [status])

  const fullName = session?.user?.name ?? ''
  const firstName = useMemo(() => fullName.split(/\s+/)[0] || 'there', [fullName])
  const initials = useMemo(() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'AJ'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [fullName])

  const onStartTest = (id: string) => router.push(`/student/tests/${id}`)

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

  const sidebarBg = 'var(--ink2)'
  const homeTitle = `${greetingFor()}, ${firstName} 👋`
  const homeSub = `${todayLabel()} · 3 upcoming sessions`
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
      {/* SIDEBAR */}
      <aside style={{
        width: 72, background: sidebarBg,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 0 24px', flexShrink: 0, zIndex: 10, gap: 4,
      }}>
        <Link href="/home" style={{
          width: 40, height: 40, borderRadius: 12, background: 'var(--grad)',
          display: 'grid', placeItems: 'center', marginBottom: 28, flexShrink: 0,
          cursor: 'pointer', textDecoration: 'none',
        }}>
          <span style={{ fontFamily: '"Shrikhand",serif', color: 'white', fontSize: 22, lineHeight: 1 }}>k</span>
        </Link>

        {NAV_ITEMS.map((item) => {
          const active = panel === item.id
          return (
            <button key={item.id} onClick={() => setPanel(item.id)} style={{
              width: 48, height: 48, borderRadius: 14,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', gap: 4, border: 'none', position: 'relative',
              background: active ? 'rgba(122,98,234,0.28)' : 'transparent',
              transition: 'background .15s',
            }}>
              <div style={{ color: active ? 'var(--p300)' : 'rgba(255,255,255,0.45)' }}>{item.icon()}</div>
              <span style={{ fontSize: 9, fontWeight: 600, color: active ? 'var(--p300)' : 'rgba(255,255,255,0.35)', letterSpacing: '0.03em', lineHeight: 1 }}>{item.label}</span>
              {item.badge && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#E882CC', border: `1.5px solid ${sidebarBg}` }} />}
            </button>
          )
        })}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPanel('settings')} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: panel === 'settings' ? 'rgba(122,98,234,0.28)' : 'rgba(255,255,255,0.07)',
            color: panel === 'settings' ? 'var(--p300)' : 'rgba(255,255,255,0.4)',
            display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'background .15s',
          }}>{Icon.settings()}</button>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--p500)', color: 'white',
            display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            border: '2px solid rgba(255,255,255,0.15)',
          }}>{initials}</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TOPBAR */}
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
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--hair)', background: 'var(--s1)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--graphite)', position: 'relative' }}>
              {Icon.bell()}
              <div style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#E882CC', border: '1.5px solid var(--s1)' }} />
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
          {panel === 'home' && (
            <PanelHome
              setPanel={setPanel}
              firstName={firstName}
              tests={tests}
              onStartTest={onStartTest}
            />
          )}
          {panel === 'essays' && <PanelEssays />}
          {panel === 'testing' && (
            <PanelTesting tests={tests} loading={testsLoading} onStartTest={onStartTest} />
          )}
          {panel === 'activities' && <PanelActivities />}
          {panel === 'messages' && <PanelMessages />}
          {panel === 'discover' && <PanelDiscover />}
          {panel === 'settings' && (
            <PanelSettings name={fullName || 'Student'} email={session?.user?.email ?? ''} />
          )}
        </div>
      </div>
    </div>
  )
}
