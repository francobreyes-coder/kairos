'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { PhotoCropModal } from '@/components/photo-crop-modal'
import { MOBILE_GRAD, MOBILE_SH1 } from './mobile-shell'

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function MobileStudentProfile({
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
    return () => {
      cancelled = true
    }
  }, [sessionName])

  function flash() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  async function persist(patch: Partial<StudentProfileForm>): Promise<boolean> {
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
    const previous = data.profilePhoto || ''
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
        if (previous && previous !== path) {
          fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: previous }),
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
      <div style={{ padding: '0 16px' }}>
        <Card>
          <div style={{ padding: 32, textAlign: 'center', color: '#8A8792', fontSize: 13 }}>
            <Loader2 size={20} className="animate-spin" style={{ marginBottom: 8 }} color="#7A3AE8" />
            <div>Loading profile…</div>
          </div>
        </Card>
      </div>
    )
  }

  const initials = initialsOf(data.name || 'You')
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 14px',
    borderRadius: 12,
    border: '1.5px solid #E6E3E8',
    background: '#FFFFFF',
    fontSize: 14,
    color: '#1C1B1F',
    outline: 'none',
    fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#8A8792',
    marginBottom: 6,
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Photo */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead title="Profile photo" right={saved ? <Saved /> : null} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
          <div style={{ position: 'relative' }}>
            {data.profilePhoto ? (
              <img
                src={photoUrl(data.profilePhoto)}
                alt="Profile"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #E6E3E8',
                }}
              />
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: '#7A62EA',
                  color: 'white',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  border: '2px solid #E6E3E8',
                }}
              >
                {initials}
              </div>
            )}
            <label
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: MOBILE_GRAD,
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                cursor: photoBusy ? 'wait' : 'pointer',
                boxShadow: MOBILE_SH1,
                opacity: photoBusy ? 0.6 : 1,
              }}
            >
              <Camera size={13} />
              <input
                type="file"
                accept="image/*"
                onChange={onPhotoSelect}
                disabled={photoBusy}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#5A5862', lineHeight: 1.5 }}>
              A clear headshot helps tutors recognize you.
            </div>
            {data.profilePhoto && (
              <button
                onClick={removePhoto}
                disabled={photoBusy}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1.5px solid #E6E3E8',
                  background: 'transparent',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#5A5862',
                  cursor: photoBusy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Remove photo
              </button>
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

      {/* Personal information */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead
          title="Personal info"
          right={
            editing === 'personal' ? (
              <EditActions onCancel={cancelEdit} onSave={saveSection} saving={saving} />
            ) : (
              <SmallBtn onClick={() => startEdit('personal')}>Edit</SmallBtn>
            )
          }
        />

        {editing === 'personal' && draft ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                value={draft.dateOfBirth}
                onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Gender">
              <select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                style={inputStyle}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone number">
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="(555) 123-4567"
                style={inputStyle}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={sessionEmail}
                disabled
                style={{
                  ...inputStyle,
                  background: '#F1EFE9',
                  color: '#8A8792',
                  cursor: 'not-allowed',
                }}
              />
            </Field>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
            <ReadField label="Full name" value={data.name || '—'} />
            <ReadField label="Date of birth" value={formatDob(data.dateOfBirth)} />
            <ReadField
              label="Gender"
              value={GENDER_OPTIONS.find((o) => o.v === data.gender)?.l ?? '—'}
            />
            <ReadField label="Phone number" value={data.phone || '—'} />
            <ReadField label="Email" value={sessionEmail} />
          </div>
        )}
      </Card>

      {/* Bio */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead
          title="About me"
          right={
            editing === 'bio' ? (
              <EditActions onCancel={cancelEdit} onSave={saveSection} saving={saving} />
            ) : (
              <SmallBtn onClick={() => startEdit('bio')}>Edit</SmallBtn>
            )
          }
        />

        {editing === 'bio' && draft ? (
          <div>
            <label style={labelStyle}>Short bio</label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={5}
              maxLength={500}
              placeholder="Tell tutors a bit about yourself — what you're studying, your goals, anything that helps them prepare."
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1.5px solid #E6E3E8',
                background: '#FFFFFF',
                fontSize: 13,
                color: '#1C1B1F',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <div style={{ fontSize: 11, color: '#8A8792', textAlign: 'right', marginTop: 4 }}>
              {draft.bio.length} / 500
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: data.bio ? '#1C1B1F' : '#8A8792',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              padding: '4px 2px',
            }}
          >
            {data.bio || 'Add a short bio so tutors can get to know you.'}
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

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      {right}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#8A8792',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#8A8792',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1B1F' }}>{value}</div>
    </div>
  )
}

function SmallBtn({
  children,
  onClick,
  variant = 'outline',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'outline' | 'primary'
}) {
  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        style={{
          padding: '7px 14px',
          borderRadius: 999,
          border: 'none',
          background: MOBILE_GRAD,
          color: 'white',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        border: '1.5px solid #E6E3E8',
        background: 'transparent',
        color: '#5A5862',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function EditActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <SmallBtn onClick={onCancel}>Cancel</SmallBtn>
      <SmallBtn onClick={onSave} variant="primary">
        {saving ? 'Saving…' : 'Save'}
      </SmallBtn>
    </div>
  )
}

function Saved() {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: '#2FA46A' }}>Saved</span>
  )
}
