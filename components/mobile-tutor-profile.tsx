'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Pencil, ExternalLink, MessageCircle, Trash2, CheckCircle } from 'lucide-react'
import { SERVICE_OPTIONS, SERVICE_LABELS } from '@/lib/services'
import { MOBILE_GRAD, MOBILE_SH1 } from './mobile-shell'

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
  qa: Array<{ question: string; answer: string }>
}

interface QaEntry {
  question: string
  answer: string
}

const SERVICE_TUTOR_NOUN: Record<string, string> = {
  essays: 'essay writing tutor',
  sat: 'SAT tutor',
  act: 'ACT tutor',
  activities: 'activities list coach',
}
const STATIC_SUGGESTED_QUESTIONS = [
  'What other schools did you get into?',
  "What's your favorite food?",
  'What are your plans post-grad?',
  'Do you offer a free consultation?',
]
function buildSuggestedQuestions(services: string[]): string[] {
  const tenureQs = services
    .map((s) => SERVICE_TUTOR_NOUN[s])
    .filter(Boolean)
    .map((noun) => `How long have you been a${/^[aeiou]/i.test(noun) ? 'n' : ''} ${noun}?`)
  if (tenureQs.length === 0) tenureQs.push('How long have you been a tutor?')
  return [...tenureQs, ...STATIC_SUGGESTED_QUESTIONS]
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
]

const SERVICE_BANDS: Record<string, { min: number; max: number; icon: string }> = {
  essays: { min: 0, max: 100, icon: '✍️' },
  sat: { min: 0, max: 150, icon: '📝' },
  act: { min: 0, max: 150, icon: '🔬' },
  activities: { min: 0, max: 100, icon: '🎯' },
}
const RATE_HARD_MAX = 500

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

function tierFor(rate: number, min: number, max: number) {
  const t = (rate - min) / Math.max(max - min, 1)
  if (t <= 0.34) return { label: 'Low', bg: '#D6F5E8', fg: '#1E7A4F' }
  if (t <= 0.67) return { label: 'Standard', bg: '#ECE7FC', fg: '#6C52E0' }
  return { label: 'High', bg: '#FEF3CD', fg: '#A06B00' }
}

export function MobileTutorProfile({
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
  const [qa, setQa] = useState<QaEntry[]>(profile.qa ?? [])
  const [editQa, setEditQa] = useState(false)
  const [savingQa, setSavingQa] = useState(false)

  useEffect(() => setBio(profile.bio || ''), [profile.bio])
  useEffect(() => setAvail(profile.availability || {}), [profile.availability])
  useEffect(() => setDraftPrices(profile.service_prices || {}), [profile.service_prices])
  useEffect(() => { if (!editQa) setQa(profile.qa ?? []) }, [profile.qa, editQa])

  const activeServices = profile.services ?? []
  const expertiseLabels = activeServices.map((id) => SERVICE_LABELS[id] ?? id)
  const photoSrc = profile.profile_photo
    ? profile.profile_photo.startsWith('/api/') || profile.profile_photo.startsWith('http')
      ? profile.profile_photo
      : `/api/storage?path=${encodeURIComponent(profile.profile_photo)}`
    : null

  function updateRate(id: string, v: string | number) {
    const num = Math.max(0, Math.min(RATE_HARD_MAX, Number(v) || 0))
    setDraftPrices((prev) => ({ ...prev, [id]: num }))
  }
  function bump(id: string, delta: number) {
    updateRate(id, (draftPrices[id] ?? 0) + delta)
  }

  function removeSlot(day: string, time: string) {
    const next = { ...avail, [day]: (avail[day] ?? []).filter((t) => t !== time) }
    setAvail(next)
    onSaveAvailability(next)
  }
  function addSlot(day: string, time: string) {
    const existing = avail[day] ?? []
    if (existing.includes(time)) return
    const next = { ...avail, [day]: [...existing, time].sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b)) }
    setAvail(next)
    setOpenPicker(null)
    onSaveAvailability(next)
  }

  const ratesDirty =
    JSON.stringify(draftPrices) !== JSON.stringify(profile.service_prices || {})

  function addQa(question: string) {
    setQa((prev) => [...prev, { question, answer: '' }])
  }
  function updateQaField(i: number, key: 'question' | 'answer', value: string) {
    setQa((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)))
  }
  function removeQa(i: number) {
    setQa((prev) => prev.filter((_, idx) => idx !== i))
  }
  async function saveQa() {
    const cleaned = qa
      .map((e) => ({ question: e.question.trim(), answer: e.answer.trim() }))
      .filter((e) => e.question && e.answer)
    setSavingQa(true)
    try {
      await onSaveProfile({ qa: cleaned })
      setQa(cleaned)
      setEditQa(false)
    } finally {
      setSavingQa(false)
    }
  }
  function cancelQa() {
    setQa(profile.qa ?? [])
    setEditQa(false)
  }
  const suggestedQa = buildSuggestedQuestions(profile.services ?? [])
  const usedQa = new Set(qa.map((e) => e.question.trim()))

  return (
    <div style={{ padding: '0 16px' }}>
      {/* PUBLIC PROFILE CARD */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          {photoSrc ? (
            <img
              src={photoSrc}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: avatarColor(profile.name),
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {initialsOf(profile.name)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1B1F' }}>{profile.name}</div>
            <div style={{ fontSize: 12, color: '#5A5862', marginTop: 2 }}>
              {[profile.college, profile.major].filter(Boolean).join(' · ') || 'College student'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {expertiseLabels.length === 0 ? (
            <span style={{ fontSize: 12, color: '#8A8792' }}>No services configured yet.</span>
          ) : (
            expertiseLabels.map((e) => (
              <span
                key={e}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#ECE7FC',
                  color: '#6C52E0',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {e}
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <Link
            href="/tutor/profile"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1.5px solid #E6E3E8',
              background: '#FFFFFF',
              color: '#5A5862',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Pencil size={12} /> Full editor
          </Link>
          <Link
            href="/find-tutors"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1.5px solid #E6E3E8',
              background: '#FFFFFF',
              color: '#5A5862',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ExternalLink size={12} /> Preview
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>Bio</div>
          <button
            onClick={() => {
              if (editBio) onSaveProfile({ bio })
              setEditBio(!editBio)
            }}
            disabled={savingProfile}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#7A62EA',
              background: 'none',
              border: 'none',
              cursor: savingProfile ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            {savingProfile ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
            {editBio ? 'Save' : 'Edit'}
          </button>
        </div>
        {editBio ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1.5px solid #BDB0F5',
              background: '#F6F3FE',
              padding: 12,
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#1C1B1F',
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.55,
            }}
          />
        ) : (
          <p
            style={{
              fontSize: 13,
              color: '#5A5862',
              lineHeight: 1.6,
              background: '#F7F5F0',
              borderRadius: 12,
              padding: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {bio || 'No bio yet. Tap Edit to add one.'}
          </p>
        )}
      </Card>

      {/* RATES */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead title="Rates by service" />
        <p style={{ fontSize: 12, color: '#8A8792', lineHeight: 1.45, marginBottom: 14 }}>
          Set an hourly rate for each approved service.
        </p>

        {activeServices.length === 0 ? (
          <div style={{ padding: '12px 0', fontSize: 12, color: '#8A8792', textAlign: 'center' }}>
            No approved services yet. An admin needs to approve one on your application first.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeServices.map((id) => {
              const opt = SERVICE_OPTIONS.find((o) => o.id === id)
              const label = opt?.label ?? SERVICE_LABELS[id] ?? id
              const band = SERVICE_BANDS[id] ?? { min: 0, max: 200, icon: '📚' }
              const rate = draftPrices[id] ?? 0
              const visualRate = Math.max(band.min, Math.min(band.max, rate))
              const tier = tierFor(visualRate, band.min, band.max)
              return (
                <div
                  key={id}
                  style={{
                    background: '#F7F5F0',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: '#FFFFFF',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {band.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#8A8792' }}>
                        Band ${band.min}–${band.max} /hr
                      </div>
                    </div>
                    <span
                      style={{
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stepper onClick={() => bump(id, -5)} ariaLabel={`Decrease ${label} rate`}>−</Stepper>
                    <div
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'baseline',
                        justifyContent: 'center',
                        gap: 2,
                        height: 44,
                        borderRadius: 12,
                        background: '#FFFFFF',
                        border: '1.5px solid #E6E3E8',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#8A8792', fontWeight: 600 }}>$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={rate}
                        min={0}
                        max={RATE_HARD_MAX}
                        onChange={(e) => updateRate(id, e.target.value)}
                        style={{
                          width: 80,
                          fontFamily: 'inherit',
                          fontSize: 20,
                          fontWeight: 700,
                          color: '#1C1B1F',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'center',
                          outline: 'none',
                          padding: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, color: '#8A8792', fontWeight: 600 }}>/hr</span>
                    </div>
                    <Stepper onClick={() => bump(id, 5)} ariaLabel={`Increase ${label} rate`}>+</Stepper>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeServices.length > 0 && (
          <button
            onClick={() => onSavePrices(draftPrices)}
            disabled={savingPrices || !ratesDirty}
            style={{
              marginTop: 16,
              width: '100%',
              height: 46,
              borderRadius: 999,
              border: 'none',
              background: ratesDirty ? MOBILE_GRAD : '#ECE7FC',
              color: ratesDirty ? 'white' : '#6C52E0',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: savingPrices ? 'wait' : ratesDirty ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: ratesDirty ? '0 6px 14px rgba(122,58,232,0.28)' : 'none',
            }}
          >
            {savingPrices && <Loader2 size={14} className="animate-spin" />}
            {ratesDirty ? 'Save rates' : 'Saved'}
          </button>
        )}
      </Card>

      {/* AVAILABILITY */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead title="Weekly availability" />
        <p style={{ fontSize: 12, color: '#8A8792', lineHeight: 1.45, marginBottom: 14 }}>
          Tap a chip to remove a slot. Tap Add to open new bookable times. Changes save automatically.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DAYS.map((day) => {
            const slots = (avail[day] ?? [])
              .slice()
              .sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b))
            const free = TIME_SLOTS.filter((t) => !slots.includes(t))
            const pickerOpen = openPicker === day
            return (
              <div
                key={day}
                style={{
                  borderRadius: 12,
                  background: slots.length > 0 ? '#FFFFFF' : '#F7F5F0',
                  border: '1px solid #E6E3E8',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: slots.length > 0 ? '#2FA46A' : '#BDB0B0',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B1F' }}>{day}</span>
                  <span style={{ fontSize: 11, color: '#8A8792', marginLeft: 'auto' }}>
                    {slots.length} slot{slots.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {slots.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#8A8792', fontStyle: 'italic', padding: '4px 0' }}>
                      No availability
                    </span>
                  ) : (
                    slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => removeSlot(day, slot)}
                        disabled={savingAvailability}
                        aria-label={`Remove ${slot}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          borderRadius: 999,
                          background: '#F6F3FE',
                          border: '1.5px solid #D9D0FA',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#6C52E0',
                          cursor: savingAvailability ? 'wait' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {slot}
                        <span style={{ color: '#9B86F0', fontSize: 14, lineHeight: 1 }}>×</span>
                      </button>
                    ))
                  )}

                  {free.length > 0 && (
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
                        fontFamily: 'inherit',
                      }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>

                {pickerOpen && free.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      paddingTop: 6,
                      borderTop: '1px solid #E6E3E8',
                    }}
                  >
                    {free.map((t) => (
                      <button
                        key={t}
                        onClick={() => addSlot(day, t)}
                        style={{
                          padding: '8px 6px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#FFFFFF',
                          border: '1px solid #E6E3E8',
                          borderRadius: 10,
                          cursor: 'pointer',
                          color: '#1C1B1F',
                          fontFamily: 'inherit',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* GET TO KNOW ME Q&A */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={14} color="#7A62EA" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F', letterSpacing: '-0.01em' }}>
              Get to know me
            </div>
          </div>
          {editQa ? (
            <div style={{ display: 'inline-flex', gap: 10 }}>
              <button
                onClick={cancelQa}
                disabled={savingQa}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#5A5862',
                  background: 'none',
                  border: 'none',
                  cursor: savingQa ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveQa}
                disabled={savingQa}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#7A62EA',
                  background: 'none',
                  border: 'none',
                  cursor: savingQa ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                {savingQa && <Loader2 size={12} className="animate-spin" />} Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditQa(true)}
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
                fontFamily: 'inherit',
              }}
            >
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#8A8792', lineHeight: 1.45, marginBottom: 12 }}>
          Optional Q&amp;A shown on your public profile so students can get a feel for who you are.
        </p>

        {editQa ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {qa.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {qa.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #E6E3E8',
                      borderRadius: 12,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <input
                        type="text"
                        value={entry.question}
                        onChange={(e) => updateQaField(i, 'question', e.target.value)}
                        placeholder="Your question"
                        maxLength={200}
                        style={{
                          flex: 1,
                          height: 36,
                          borderRadius: 8,
                          border: '1.5px solid #E6E3E8',
                          background: '#F7F5F0',
                          padding: '0 10px',
                          fontFamily: 'inherit',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1C1B1F',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeQa(i)}
                        aria-label="Remove question"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: '#8A8792',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      value={entry.answer}
                      onChange={(e) => updateQaField(i, 'answer', e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Your answer"
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        border: '1.5px solid #E6E3E8',
                        background: '#F7F5F0',
                        padding: '8px 10px',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        color: '#1C1B1F',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.5,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#8A8792',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Suggested — tap to add
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggestedQa.map((q) => {
                  const already = usedQa.has(q)
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={already}
                      onClick={() => addQa(q)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1.5px solid #E6E3E8',
                        background: already ? '#F1EFE9' : 'white',
                        color: already ? '#8A8792' : '#1C1B1F',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: already ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      {already ? <CheckCircle size={11} /> : <Plus size={11} />}
                      {q}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => addQa('')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1.5px dashed #BDB0F5',
                    background: 'transparent',
                    color: '#7A62EA',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <Plus size={11} /> Write your own question
                </button>
              </div>
            </div>
          </div>
        ) : qa.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8A8792', fontStyle: 'italic', padding: '8px 0' }}>
            No questions added yet. Tap Edit to add a few.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {qa.map((entry, i) => (
              <div key={i} style={{ padding: '10px 12px', background: '#F7F5F0', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F', marginBottom: 4 }}>{entry.question}</div>
                <div style={{ fontSize: 13, color: '#5A5862', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{entry.answer}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        boxShadow: MOBILE_SH1,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F', letterSpacing: '-0.01em', marginBottom: 8 }}>
      {title}
    </div>
  )
}

function Stepper({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick: () => void; ariaLabel: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        border: '1.5px solid #E6E3E8',
        background: '#FFFFFF',
        fontFamily: 'inherit',
        fontSize: 18,
        fontWeight: 700,
        color: '#5A5862',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
