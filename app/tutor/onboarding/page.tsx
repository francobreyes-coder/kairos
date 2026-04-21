'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  User,
  GraduationCap,
  Heart,
  Briefcase,
  Calendar,
  Eye,
  X,
  Camera,
  Trash2,
} from 'lucide-react'

const STEPS = [
  { label: 'Basic Info', icon: User },
  { label: 'Academic', icon: GraduationCap },
  { label: 'Interests', icon: Heart },
  { label: 'Services', icon: Briefcase },
  { label: 'Availability', icon: Calendar },
  { label: 'Preview', icon: Eye },
]

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
  profilePhoto: string
  subjects: string[]
  college: string
  major: string
  interests: string[]
  teachingStyle: string
  availability: Record<string, string[]>
  services: string[]
}

const emptyProfile: ProfileData = {
  bio: '',
  profilePhoto: '',
  subjects: [],
  college: '',
  major: '',
  interests: [],
  teachingStyle: '',
  availability: {},
  services: [],
}

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (val: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${
              active
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card border-border text-foreground hover:border-accent/50'
            }`}
          >
            {opt}
            {active && <X className="w-3 h-3 ml-1.5 inline" />}
          </button>
        )
      })}
    </div>
  )
}

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approvedServices, setApprovedServices] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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

        const approved = application.services_approved ?? []
        setApprovedServices(approved)

        if (existing?.profile_completed) {
          router.push('/home')
          return
        }

        setProfile((prev) => ({
          ...prev,
          college: existing?.college || application.university || '',
          major: existing?.major || application.major || '',
          services: existing?.services?.length ? existing.services : approved,
          bio: existing?.bio || '',
          profilePhoto: existing?.profile_photo || '',
          subjects: existing?.subjects || [],
          interests: existing?.interests || [],
          teachingStyle: existing?.teaching_style || '',
          availability: existing?.availability || {},
        }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, router])

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  function toggleArray(key: 'subjects' | 'interests' | 'services', value: string) {
    setProfile((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }))
  }

  function toggleAvailability(day: string, slot: string) {
    setProfile((p) => {
      const daySlots = p.availability[day] ?? []
      const updated = daySlots.includes(slot)
        ? daySlots.filter((s) => s !== slot)
        : [...daySlots, slot]
      return { ...p, availability: { ...p.availability, [day]: updated } }
    })
  }

  function getPhotoUrl(path: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/application-files/${path}`
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const form = new FormData()
    form.append('file', file)
    form.append('fileType', 'profile-photo')
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { path } = await res.json()
    if (path) update('profilePhoto', path)
    setUploadingPhoto(false)
  }

  async function removePhoto() {
    if (!profile.profilePhoto) return
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: profile.profilePhoto }),
    })
    update('profilePhoto', '')
  }

  async function saveProgress() {
    await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, profileCompleted: false }),
    })
  }

  async function handleComplete() {
    setSaving(true)
    await fetch('/api/tutor/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, profileCompleted: true }),
    })
    setSaving(false)
    router.push('/home')
  }

  function nextStep() {
    saveProgress()
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0))
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return profile.bio.trim().length >= 10
      case 1: return profile.college.trim().length > 0 && profile.major.trim().length > 0 && profile.subjects.length > 0
      case 2: return profile.interests.length > 0 && profile.teachingStyle.length > 0
      case 3: return profile.services.length > 0
      case 4: return Object.values(profile.availability).some((slots) => slots.length > 0)
      default: return true
    }
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

  const totalSlots = Object.values(profile.availability).reduce((sum, s) => sum + s.length, 0)

  return (
    <>
      <Header />

      <main className="pt-28 pb-24 px-6">
        <div className="mx-auto max-w-2xl">

          {/* Progress stepper */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const done = i < step
                const active = i === step
                return (
                  <div key={s.label} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        done
                          ? 'bg-accent text-accent-foreground'
                          : active
                            ? 'bg-accent/15 text-accent border-2 border-accent'
                            : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs ${active ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8 min-h-[400px]">

            {/* Step 0: Basic Info */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Tell us about yourself</h2>
                  <p className="text-sm text-muted-foreground">This will be shown to students browsing tutors.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Profile Photo
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload a semi-professional headshot from the shoulders up — this is the first thing students see.
                  </p>
                  <div className="flex items-center gap-5">
                    {profile.profilePhoto ? (
                      <div className="relative group">
                        <img
                          src={getPhotoUrl(profile.profilePhoto)}
                          alt="Profile"
                          className="w-24 h-24 rounded-2xl object-cover border-2 border-border"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-secondary/50">
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
                          onChange={handlePhotoUpload}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                      </label>
                    )}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Tips for a great photo:</p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        <li>Shoulders up, good lighting</li>
                        <li>Friendly, natural expression</li>
                        <li>Plain or simple background</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Bio <span className="text-accent">*</span>
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => update('bio', e.target.value)}
                    rows={5}
                    maxLength={500}
                    placeholder="Share a bit about who you are, your background, and what makes you a great tutor..."
                    className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    {profile.bio.length} / 500
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Academic Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Academic Background</h2>
                  <p className="text-sm text-muted-foreground">Pre-filled from your application — update if needed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    College / University <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.college}
                    onChange={(e) => update('college', e.target.value)}
                    placeholder="e.g. Harvard University"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Major <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.major}
                    onChange={(e) => update('major', e.target.value)}
                    placeholder="e.g. Computer Science"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Subjects you can tutor <span className="text-accent">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
                  <ChipSelect
                    options={SUBJECT_OPTIONS}
                    selected={profile.subjects}
                    onToggle={(v) => toggleArray('subjects', v)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Interests & Personality */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Interests & Personality</h2>
                  <p className="text-sm text-muted-foreground">Help students find a tutor they connect with.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Your interests <span className="text-accent">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Pick at least 3</p>
                  <ChipSelect
                    options={INTEREST_OPTIONS}
                    selected={profile.interests}
                    onToggle={(v) => toggleArray('interests', v)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Teaching style <span className="text-accent">*</span>
                  </label>
                  <div className="space-y-3">
                    {TEACHING_STYLES.map((ts) => (
                      <label
                        key={ts.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                          profile.teachingStyle === ts.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="teachingStyle"
                          value={ts.id}
                          checked={profile.teachingStyle === ts.id}
                          onChange={() => update('teachingStyle', ts.id)}
                          className="mt-0.5 accent-accent"
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground">{ts.label}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{ts.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Services Offered */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Services You Offer</h2>
                  <p className="text-sm text-muted-foreground">
                    You were approved for the services below. Deselect any you{"'"}d prefer not to offer right now.
                  </p>
                </div>

                <div className="space-y-3">
                  {SERVICE_OPTIONS.filter((s) => approvedServices.includes(s.id)).map((s) => {
                    const checked = profile.services.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                          checked ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                        }`}
                      >
                        <div
                          onClick={() => toggleArray('services', s.id)}
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

                {approvedServices.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No specific services were approved. Contact support if this seems wrong.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Availability */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Your Availability</h2>
                  <p className="text-sm text-muted-foreground">
                    Tap the time slots when you{"'"}re available. You can update this later.
                  </p>
                </div>

                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="min-w-[600px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-1 mb-1">
                      <div className="text-xs text-muted-foreground p-1" />
                      {DAYS.map((d) => (
                        <div key={d} className="text-xs font-medium text-center text-foreground p-1">
                          {d.slice(0, 3)}
                        </div>
                      ))}
                    </div>

                    {/* Grid */}
                    {TIME_SLOTS.map((slot) => (
                      <div key={slot} className="grid grid-cols-8 gap-1 mb-1">
                        <div className="text-xs text-muted-foreground p-1 flex items-center">
                          {slot}
                        </div>
                        {DAYS.map((day) => {
                          const active = (profile.availability[day] ?? []).includes(slot)
                          return (
                            <button
                              key={`${day}-${slot}`}
                              type="button"
                              onClick={() => toggleAvailability(day, slot)}
                              className={`h-8 rounded transition-colors ${
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

                <p className="text-xs text-muted-foreground text-center">
                  {totalSlots} slot{totalSlots !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            {/* Step 5: Preview */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Profile Preview</h2>
                  <p className="text-sm text-muted-foreground">Review your profile before going live.</p>
                </div>

                <div className="space-y-5">
                  {profile.profilePhoto && (
                    <div className="flex justify-center">
                      <img
                        src={getPhotoUrl(profile.profilePhoto)}
                        alt="Profile"
                        className="w-28 h-28 rounded-2xl object-cover border-2 border-border"
                      />
                    </div>
                  )}

                  <PreviewSection title="Bio">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{profile.bio || '—'}</p>
                  </PreviewSection>

                  <PreviewSection title="Academic">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">College:</span>{' '}
                        <span className="text-foreground">{profile.college || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Major:</span>{' '}
                        <span className="text-foreground">{profile.major || '—'}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Subjects:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile.subjects.map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  </PreviewSection>

                  <PreviewSection title="Interests & Style">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profile.interests.map((i) => (
                        <span key={i} className="px-2.5 py-1 bg-secondary text-foreground text-xs rounded-full">{i}</span>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Teaching style:{' '}
                      <span className="text-foreground">
                        {TEACHING_STYLES.find((ts) => ts.id === profile.teachingStyle)?.label || '—'}
                      </span>
                    </p>
                  </PreviewSection>

                  <PreviewSection title="Services">
                    <div className="flex flex-wrap gap-1.5">
                      {profile.services.map((s) => (
                        <span key={s} className="px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full">
                          {SERVICE_OPTIONS.find((o) => o.id === s)?.label ?? s}
                        </span>
                      ))}
                    </div>
                  </PreviewSection>

                  <PreviewSection title="Availability">
                    <div className="space-y-1.5">
                      {DAYS.filter((d) => (profile.availability[d] ?? []).length > 0).map((d) => (
                        <div key={d} className="text-sm">
                          <span className="font-medium text-foreground w-20 inline-block">{d}</span>
                          <span className="text-muted-foreground">
                            {(profile.availability[d] ?? []).sort().join(', ')}
                          </span>
                        </div>
                      ))}
                      {!Object.values(profile.availability).some((s) => s.length > 0) && (
                        <p className="text-sm text-muted-foreground italic">No availability set</p>
                      )}
                    </div>
                  </PreviewSection>
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canAdvance()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium transition-colors hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    Complete Profile <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </main>
    </>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-secondary/50 border border-border">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  )
}
