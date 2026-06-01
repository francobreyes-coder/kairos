'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  Save,
  CheckCircle,
  X,
  Pencil,
  GraduationCap,
  Heart,
  Briefcase,
  Calendar,
  User,
  Camera,
  Trash2,
  MessageCircle,
  Plus,
} from 'lucide-react'
import { PhotoCropModal } from '@/components/photo-crop-modal'
import { getBrowserTimezone, shortTimezoneLabel } from '@/lib/timezone'

const SUBJECT_OPTIONS = [
  'English / Writing',
  'Mathematics',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Economics',
  'Computer Science',
  'Psychology',
  'Foreign Languages',
  'Political Science',
  'Art / Design',
]

const INTEREST_OPTIONS = [
  'Music',
  'Sports',
  'Gaming',
  'Art & Design',
  'Travel',
  'Cooking',
  'Photography',
  'Reading',
  'Coding',
  'Volunteering',
  'Fitness',
  'Film & TV',
  'Fashion',
  'Entrepreneurship',
  'Nature & Outdoors',
  'Debate',
]

const TEACHING_STYLES = [
  { id: 'structured', label: 'Structured & Organized', desc: 'Clear agendas, step-by-step guidance' },
  { id: 'collaborative', label: 'Collaborative', desc: 'Work through problems together' },
  { id: 'socratic', label: 'Socratic / Question-Based', desc: 'Guide through questions, not answers' },
  { id: 'flexible', label: 'Flexible & Adaptive', desc: 'Adjust to what the student needs' },
]

const SERVICE_OPTIONS = [
  { id: 'essays', label: 'Essay Writing' },
  { id: 'sat', label: 'SAT Prep' },
  { id: 'act', label: 'ACT Prep' },
  { id: 'activities', label: 'Activities List Building' },
]

// Service-specific phrasing for the "How long have you been a … tutor?"
// suggested question. Mirrors the same map in the onboarding step.
const SERVICE_TUTOR_NOUN: Record<string, string> = {
  essays: 'essay writing tutor',
  sat: 'SAT tutor',
  act: 'ACT tutor',
  activities: 'activities list coach',
}

interface QaEntry {
  question: string
  answer: string
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

interface ProfileData {
  bio: string
  profilePhoto: string
  subjects: string[]
  college: string
  major: string
  interests: string[]
  teachingStyle: string
  availability: Record<string, string[]>
  services: string[]
  timezone: string
  qa: QaEntry[]
}

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

function InterestPicker({
  options,
  selected,
  onToggle,
  onAdd,
}: {
  options: string[]
  selected: string[]
  onToggle: (val: string) => void
  onAdd: (val: string) => void
}) {
  const [draft, setDraft] = useState('')
  const baseSet = new Set(options.map((o) => o.toLowerCase()))
  const customSelected = selected.filter((s) => !baseSet.has(s.toLowerCase()))

  function commit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed.slice(0, 30))
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                active
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card border-border text-foreground hover:border-accent/50'
              }`}
            >
              {opt}
              {active && <X className="w-3 h-3 ml-1 inline" />}
            </button>
          )
        })}
        {customSelected.map((opt) => (
          <button
            key={`custom-${opt}`}
            type="button"
            onClick={() => onToggle(opt)}
            className="px-3 py-1.5 rounded-full text-xs transition-colors border bg-accent text-accent-foreground border-accent"
          >
            {opt}
            <X className="w-3 h-3 ml-1 inline" />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder="Add a custom interest…"
          maxLength={30}
          className="flex-1 h-9 px-3 rounded-full bg-card border border-border text-foreground placeholder:text-muted-foreground text-xs outline-none focus:ring-2 focus:ring-ring/30 transition"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-3 h-9 rounded-full text-xs border border-border bg-card text-foreground hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

type Section = 'photo' | 'name' | 'bio' | 'academic' | 'interests' | 'services' | 'availability' | 'qa' | null

export default function ProfileDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editDraft, setEditDraft] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState<Section>(null)
  const [approvedServices, setApprovedServices] = useState<string[]>([])
  const [tutorName, setTutorName] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }
    if (status !== 'authenticated') return

    fetch('/api/tutor/profile')
      .then((r) => r.json())
      .then(({ profile: existing, application }) => {
        if (!application) {
          router.push('/home')
          return
        }

        setApprovedServices(application.services_approved ?? [])
        setTutorName(application.name ?? session?.user?.name ?? '')

        if (!existing || !existing.profile_completed) {
          router.push('/tutor/onboarding')
          return
        }

        const loaded: ProfileData = {
          bio: existing.bio ?? '',
          profilePhoto: existing.profile_photo ?? '',
          subjects: existing.subjects ?? [],
          college: existing.college ?? '',
          major: existing.major ?? '',
          interests: existing.interests ?? [],
          teachingStyle: existing.teaching_style ?? '',
          availability: existing.availability ?? {},
          services: existing.services ?? [],
          timezone: existing.timezone ?? '',
          qa: Array.isArray(existing.qa) ? existing.qa : [],
        }
        setProfile(loaded)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, router, session])

  function startEdit(section: Section) {
    setEditing(section)
    setEditDraft({ ...profile! })
    setSaved(false)
  }

  function cancelEdit() {
    setEditing(null)
    setEditDraft(null)
  }

  async function saveEdit() {
    if (!editDraft) return
    setSaving(true)
    // Drop half-filled Q&A rows so the saved state mirrors what the server
    // will accept (the API filters empties too — keep them in sync).
    const cleanedQa = editDraft.qa
      .map((e) => ({ question: e.question.trim(), answer: e.answer.trim() }))
      .filter((e) => e.question && e.answer)
    const cleaned: ProfileData = { ...editDraft, qa: cleanedQa }
    // When saving availability, also record the browser's IANA timezone so
    // the slot strings can be interpreted as wall-clock in that tz.
    const payload: Record<string, unknown> = { ...cleaned, profileCompleted: true }
    if (editing === 'availability') {
      payload.timezone = getBrowserTimezone()
    }
    await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setProfile(cleaned)
    setEditing(null)
    setEditDraft(null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveName() {
    const trimmed = nameDraft.trim()
    if (!trimmed) return
    if (trimmed === tutorName) {
      setEditing(null)
      return
    }
    setSavingName(true)
    const res = await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setSavingName(false)
    if (res.ok) {
      setTutorName(trimmed)
      setEditing(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function updateDraft<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setEditDraft((d) => d ? { ...d, [key]: value } : d)
  }

  function toggleDraftArray(key: 'subjects' | 'interests' | 'services', value: string) {
    setEditDraft((d) => {
      if (!d) return d
      return {
        ...d,
        [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
      }
    })
  }

  function addQaEntry(question: string) {
    setEditDraft((d) => d ? { ...d, qa: [...d.qa, { question, answer: '' }] } : d)
  }

  function updateQaEntry(idx: number, key: 'question' | 'answer', value: string) {
    setEditDraft((d) => d ? {
      ...d,
      qa: d.qa.map((e, i) => i === idx ? { ...e, [key]: value } : e),
    } : d)
  }

  function removeQaEntry(idx: number) {
    setEditDraft((d) => d ? { ...d, qa: d.qa.filter((_, i) => i !== idx) } : d)
  }

  function toggleDraftAvailability(day: string, slot: string) {
    setEditDraft((d) => {
      if (!d) return d
      const daySlots = d.availability[day] ?? []
      const updated = daySlots.includes(slot)
        ? daySlots.filter((s) => s !== slot)
        : [...daySlots, slot]
      return { ...d, availability: { ...d.availability, [day]: updated } }
    })
  }

  function getPhotoUrl(path: string) {
    return `/api/storage?path=${encodeURIComponent(path)}`
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleCroppedPhoto(blob: Blob) {
    setCropSrc(null)
    setUploadingPhoto(true)
    const previousPath = profile?.profilePhoto || ''
    const form = new FormData()
    // Unique filename per upload — the storage route serves with `Cache-Control: immutable`,
    // so reusing the same path leaves stale images cached in the browser/CDN forever.
    const uniqueName = `profile-${Date.now()}.png`
    form.append('file', new File([blob], uniqueName, { type: 'image/png' }))
    form.append('fileType', 'profile-photo')
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { path } = await res.json()
    if (path) {
      const updated = { ...profile!, profilePhoto: path }
      await fetch('/api/tutor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, profileCompleted: true }),
      })
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

      if (previousPath && previousPath !== path) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: previousPath }),
        }).catch(() => {})
      }
    }
    setUploadingPhoto(false)
  }

  async function removePhoto() {
    if (!profile?.profilePhoto) return
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: profile.profilePhoto }),
    })
    const updated = { ...profile, profilePhoto: '' }
    await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, profileCompleted: true }),
    })
    setProfile(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading || status === 'loading') {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </main>
      </>
    )
  }

  if (!profile) return null

  const totalSlots = Object.values(profile.availability).reduce((sum, s) => sum + s.length, 0)

  return (
    <>
      <Header />

      <main className="pt-28 pb-24 px-6">
        <div className="mx-auto max-w-2xl">

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Your Tutor Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tutorName && `Hi, ${tutorName.split(' ')[0]}! `}Manage your profile visible to students.
              </p>
            </div>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
          </div>

          <div className="space-y-5">

            {/* Profile Photo */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile Photo</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                A semi-professional headshot from the shoulders up — this is the first thing students see.
              </p>
              <div className="flex items-center gap-5">
                {profile.profilePhoto ? (
                  <div className="relative group">
                    <img
                      src={getPhotoUrl(profile.profilePhoto)}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-border"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center cursor-pointer hover:bg-accent/90 transition-colors shadow-md">
                      <Camera className="w-3.5 h-3.5" />
                      <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-secondary/50">
                    {uploadingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                )}
                {profile.profilePhoto && (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                    <Pencil className="w-3 h-3" /> Change photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                )}
              </div>
              {cropSrc && (
                <PhotoCropModal
                  imageSrc={cropSrc}
                  onCrop={handleCroppedPhoto}
                  onCancel={() => setCropSrc(null)}
                />
              )}
            </div>

            {/* Name */}
            <DashboardCard
              icon={User}
              title="Display Name"
              editing={editing === 'name'}
              onEdit={() => { setEditing('name'); setNameDraft(tutorName); setSaved(false) }}
              onCancel={() => { setEditing(null); setNameDraft(tutorName) }}
              onSave={saveName}
              saving={savingName}
            >
              {editing === 'name' ? (
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Your full name"
                  className={inputCls}
                />
              ) : (
                <p className="text-sm text-foreground">{tutorName || '—'}</p>
              )}
            </DashboardCard>

            {/* Bio */}
            <DashboardCard
              icon={User}
              title="Bio"
              editing={editing === 'bio'}
              onEdit={() => startEdit('bio')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'bio' && editDraft ? (
                <div>
                  <textarea
                    value={editDraft.bio}
                    onChange={(e) => updateDraft('bio', e.target.value)}
                    rows={5}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    {editDraft.bio.length} / 500
                  </p>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{profile.bio || '—'}</p>
              )}
            </DashboardCard>

            {/* Academic */}
            <DashboardCard
              icon={GraduationCap}
              title="Academic Background"
              editing={editing === 'academic'}
              onEdit={() => startEdit('academic')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'academic' && editDraft ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">College / University</label>
                    <input
                      type="text"
                      value={editDraft.college}
                      onChange={(e) => updateDraft('college', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Major</label>
                    <input
                      type="text"
                      value={editDraft.major}
                      onChange={(e) => updateDraft('major', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Subjects</label>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECT_OPTIONS.map((s) => {
                        const active = editDraft.subjects.includes(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleDraftArray('subjects', s)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                              active
                                ? 'bg-accent text-accent-foreground border-accent'
                                : 'bg-card border-border text-foreground hover:border-accent/50'
                            }`}
                          >
                            {s}
                            {active && <X className="w-3 h-3 ml-1 inline" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">College:</span>{' '}
                      <span className="text-foreground">{profile.college}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Major:</span>{' '}
                      <span className="text-foreground">{profile.major}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {profile.subjects.map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </DashboardCard>

            {/* Interests & Style */}
            <DashboardCard
              icon={Heart}
              title="Interests & Teaching Style"
              editing={editing === 'interests'}
              onEdit={() => startEdit('interests')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'interests' && editDraft ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Interests</label>
                    <InterestPicker
                      options={INTEREST_OPTIONS}
                      selected={editDraft.interests}
                      onToggle={(v) => toggleDraftArray('interests', v)}
                      onAdd={(v) => {
                        setEditDraft((d) => {
                          if (!d) return d
                          if (d.interests.some((s) => s.toLowerCase() === v.toLowerCase())) return d
                          return { ...d, interests: [...d.interests, v] }
                        })
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Teaching Style</label>
                    <div className="space-y-2">
                      {TEACHING_STYLES.map((ts) => (
                        <label
                          key={ts.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                            editDraft.teachingStyle === ts.id
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="teachingStyle"
                            value={ts.id}
                            checked={editDraft.teachingStyle === ts.id}
                            onChange={() => updateDraft('teachingStyle', ts.id)}
                            className="mt-0.5 accent-accent"
                          />
                          <div>
                            <span className="text-sm font-medium text-foreground">{ts.label}</span>
                            <p className="text-xs text-muted-foreground">{ts.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((i) => (
                      <span key={i} className="px-2.5 py-1 bg-secondary text-foreground text-xs rounded-full">{i}</span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Teaching style:{' '}
                    <span className="text-foreground font-medium">
                      {TEACHING_STYLES.find((ts) => ts.id === profile.teachingStyle)?.label || '—'}
                    </span>
                  </p>
                </div>
              )}
            </DashboardCard>

            {/* Services */}
            <DashboardCard
              icon={Briefcase}
              title="Services Offered"
              editing={editing === 'services'}
              onEdit={() => startEdit('services')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'services' && editDraft ? (
                <div className="space-y-2">
                  {SERVICE_OPTIONS.filter((s) => approvedServices.includes(s.id)).map((s) => {
                    const checked = editDraft.services.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          checked ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                        }`}
                      >
                        <div
                          onClick={() => toggleDraftArray('services', s.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                            checked ? 'bg-accent border-accent' : 'border-border'
                          }`}
                        >
                          {checked && (
                            <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.services.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full">
                      {SERVICE_OPTIONS.find((o) => o.id === s)?.label ?? s}
                    </span>
                  ))}
                </div>
              )}
            </DashboardCard>

            {/* Availability */}
            <DashboardCard
              icon={Calendar}
              title="Availability"
              subtitle={`${totalSlots} slot${totalSlots !== 1 ? 's' : ''} selected`}
              editing={editing === 'availability'}
              onEdit={() => startEdit('availability')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'availability' && editDraft ? (
                <div className="overflow-x-auto -mx-2 px-2">
                  <p className="text-xs text-muted-foreground mb-3 px-1">
                    Times shown in your local timezone (<span className="font-medium text-foreground">{shortTimezoneLabel(getBrowserTimezone())}</span>).
                    Students see them in their own timezone.
                  </p>
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-8 gap-1 mb-1">
                      <div className="text-xs text-muted-foreground p-1" />
                      {DAYS.map((d) => (
                        <div key={d} className="text-xs font-medium text-center text-foreground p-1">
                          {d.slice(0, 3)}
                        </div>
                      ))}
                    </div>
                    {TIME_SLOTS.map((slot) => (
                      <div key={slot} className="grid grid-cols-8 gap-1 mb-1">
                        <div className="text-xs text-muted-foreground p-1 flex items-center">{slot}</div>
                        {DAYS.map((day) => {
                          const active = (editDraft.availability[day] ?? []).includes(slot)
                          return (
                            <button
                              key={`${day}-${slot}`}
                              type="button"
                              onClick={() => toggleDraftAvailability(day, slot)}
                              className={`h-7 rounded transition-colors ${
                                active
                                  ? 'bg-accent text-accent-foreground'
                                  : 'bg-secondary hover:bg-accent/15'
                              }`}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {profile.timezone && totalSlots > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Stored in <span className="font-medium text-foreground">{shortTimezoneLabel(profile.timezone)}</span>; students see these in their own timezone.
                    </p>
                  )}
                  {DAYS.filter((d) => (profile.availability[d] ?? []).length > 0).map((d) => (
                    <div key={d} className="text-sm">
                      <span className="font-medium text-foreground w-24 inline-block">{d}</span>
                      <span className="text-muted-foreground">
                        {(profile.availability[d] ?? []).sort().join(', ')}
                      </span>
                    </div>
                  ))}
                  {totalSlots === 0 && (
                    <p className="text-sm text-muted-foreground italic">No availability set</p>
                  )}
                </div>
              )}
            </DashboardCard>

            {/* Get to Know Me Q&A — optional, free-form list */}
            <DashboardCard
              icon={MessageCircle}
              title="Get to Know Me Q&A"
              subtitle={profile.qa.length > 0 ? `${profile.qa.length} answer${profile.qa.length === 1 ? '' : 's'}` : 'optional'}
              editing={editing === 'qa'}
              onEdit={() => startEdit('qa')}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
            >
              {editing === 'qa' && editDraft ? (
                <QaEditor
                  qa={editDraft.qa}
                  services={editDraft.services}
                  onAdd={addQaEntry}
                  onChange={updateQaEntry}
                  onRemove={removeQaEntry}
                />
              ) : profile.qa.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Add a short Q&amp;A so students can get a feel for who you are.
                </p>
              ) : (
                <div className="space-y-3">
                  {profile.qa.map((entry, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-foreground">{entry.question}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">{entry.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>

          </div>
        </div>
      </main>
    </>
  )
}

function DashboardCard({
  icon: Icon,
  title,
  subtitle,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {subtitle && <span className="text-xs text-muted-foreground ml-1">· {subtitle}</span>}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function QaEditor({
  qa,
  services,
  onAdd,
  onChange,
  onRemove,
}: {
  qa: QaEntry[]
  services: string[]
  onAdd: (question: string) => void
  onChange: (idx: number, key: 'question' | 'answer', value: string) => void
  onRemove: (idx: number) => void
}) {
  const suggested = buildSuggestedQuestions(services)
  const used = new Set(qa.map((e) => e.question.trim()))

  return (
    <div className="space-y-4">
      {qa.length > 0 && (
        <div className="space-y-3">
          {qa.map((entry, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={entry.question}
                  onChange={(e) => onChange(i, 'question', e.target.value)}
                  placeholder="Your question"
                  maxLength={200}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="flex-shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={entry.answer}
                onChange={(e) => onChange(i, 'answer', e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Your answer"
                className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Suggested — tap to add</p>
        <div className="flex flex-wrap gap-2">
          {suggested.map((q) => {
            const already = used.has(q)
            return (
              <button
                key={q}
                type="button"
                disabled={already}
                onClick={() => onAdd(q)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                  already
                    ? 'bg-secondary text-muted-foreground border-border cursor-not-allowed'
                    : 'bg-card border-border text-foreground hover:border-accent/50'
                }`}
              >
                {already ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : <Plus className="w-3 h-3 mr-1 inline" />}
                {q}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => onAdd('')}
            className="px-3 py-1.5 rounded-full text-xs transition-colors border border-dashed border-accent/50 text-accent hover:bg-accent/5"
          >
            <Plus className="w-3 h-3 mr-1 inline" />
            Write your own question
          </button>
        </div>
      </div>
    </div>
  )
}
