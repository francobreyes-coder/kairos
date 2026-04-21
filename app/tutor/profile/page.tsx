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
} from 'lucide-react'

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
  { id: 'sat-act', label: 'SAT/ACT Prep' },
  { id: 'activities', label: 'Activities List Building' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
]

interface ProfileData {
  bio: string
  subjects: string[]
  college: string
  major: string
  interests: string[]
  teachingStyle: string
  availability: Record<string, string[]>
  services: string[]
}

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

type Section = 'bio' | 'academic' | 'interests' | 'services' | 'availability' | null

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
          subjects: existing.subjects ?? [],
          college: existing.college ?? '',
          major: existing.major ?? '',
          interests: existing.interests ?? [],
          teachingStyle: existing.teaching_style ?? '',
          availability: existing.availability ?? {},
          services: existing.services ?? [],
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
    await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editDraft, profileCompleted: true }),
    })
    setProfile(editDraft)
    setEditing(null)
    setEditDraft(null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map((opt) => {
                        const active = editDraft.interests.includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleDraftArray('interests', opt)}
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
                    </div>
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
