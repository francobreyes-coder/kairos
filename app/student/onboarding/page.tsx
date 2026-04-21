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
  Heart,
  Target,
  GraduationCap,
  Sparkles,
  X,
} from 'lucide-react'

const STEPS = [
  { label: 'Interests', icon: Heart },
  { label: 'Goals', icon: Target },
  { label: 'Colleges', icon: GraduationCap },
  { label: 'Preferences', icon: Sparkles },
]

const GRADE_OPTIONS = [
  '9th Grade (Freshman)',
  '10th Grade (Sophomore)',
  '11th Grade (Junior)',
  '12th Grade (Senior)',
]

const INTEREST_OPTIONS = [
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
  'Music',
  'Sports',
  'Debate',
  'Entrepreneurship',
]

const GOAL_OPTIONS = [
  { id: 'essay-help', label: 'Essay Writing Help', desc: 'College application essays, personal statements' },
  { id: 'test-prep', label: 'SAT / ACT Prep', desc: 'Standardized test strategy and practice' },
  { id: 'activities', label: 'Activities List Building', desc: 'Extracurriculars, leadership, volunteering' },
  { id: 'major-exploration', label: 'Major Exploration', desc: 'Figuring out what to study in college' },
  { id: 'college-list', label: 'College List Building', desc: 'Finding schools that are the right fit' },
  { id: 'interview-prep', label: 'Interview Prep', desc: 'Practice for college or scholarship interviews' },
]

const POPULAR_COLLEGES = [
  'Harvard University',
  'Stanford University',
  'MIT',
  'Yale University',
  'Princeton University',
  'Columbia University',
  'University of Pennsylvania',
  'Duke University',
  'Northwestern University',
  'Brown University',
  'Cornell University',
  'UC Berkeley',
  'UCLA',
  'University of Michigan',
  'NYU',
  'Georgetown University',
]

const TEACHING_STYLE_OPTIONS = [
  { id: 'structured', label: 'Structured & Organized', desc: 'Clear agendas and step-by-step plans' },
  { id: 'collaborative', label: 'Collaborative', desc: 'Work through things together side by side' },
  { id: 'motivational', label: 'Motivational & Encouraging', desc: 'Positive energy, lots of encouragement' },
  { id: 'flexible', label: 'Flexible & Laid Back', desc: 'Go with the flow, adapt as we go' },
]

const PERSONALITY_OPTIONS = [
  'Relatable (close in age)',
  'Academic superstar',
  'Creative thinker',
  'Good listener',
  'Funny / lighthearted',
  'Direct & honest',
  'Patient',
  'Big-picture thinker',
]

interface StudentData {
  grade: string
  interests: string[]
  intendedMajor: string
  collegesOfInterest: string[]
  goals: string[]
  preferredTeachingStyle: string
  tutorPersonality: string[]
}

const emptyStudent: StudentData = {
  grade: '',
  interests: [],
  intendedMajor: '',
  collegesOfInterest: [],
  goals: [],
  preferredTeachingStyle: '',
  tutorPersonality: [],
}

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

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

export default function StudentOnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [student, setStudent] = useState<StudentData>(emptyStudent)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collegeInput, setCollegeInput] = useState('')
  const [collegeSuggestions, setCollegeSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }
    if (status !== 'authenticated') return

    // Only high school students should access this onboarding
    if (session?.user?.role && session.user.role !== 'high_school') {
      router.push('/home')
      return
    }

    fetch('/api/student/profile')
      .then((r) => r.json())
      .then(({ student: existing }) => {
        if (existing?.onboarding_completed) {
          router.push('/find-tutors')
          return
        }
        if (existing) {
          setStudent({
            grade: existing.grade || '',
            interests: existing.interests || [],
            intendedMajor: existing.intended_major || '',
            collegesOfInterest: existing.colleges_of_interest || [],
            goals: existing.goals || [],
            preferredTeachingStyle: existing.preferred_teaching_style || '',
            tutorPersonality: existing.tutor_personality || [],
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, router, session])

  function update<K extends keyof StudentData>(key: K, value: StudentData[K]) {
    setStudent((p) => ({ ...p, [key]: value }))
  }

  function toggleArray(key: 'interests' | 'goals' | 'tutorPersonality', value: string) {
    setStudent((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }))
  }

  function addCollege(college: string) {
    const trimmed = college.trim()
    if (!trimmed || student.collegesOfInterest.includes(trimmed)) return
    update('collegesOfInterest', [...student.collegesOfInterest, trimmed])
    setCollegeInput('')
    setCollegeSuggestions([])
  }

  function removeCollege(college: string) {
    update('collegesOfInterest', student.collegesOfInterest.filter((c) => c !== college))
  }

  function handleCollegeInput(value: string) {
    setCollegeInput(value)
    if (value.trim().length < 2) {
      setCollegeSuggestions([])
      return
    }
    const lower = value.toLowerCase()
    setCollegeSuggestions(
      POPULAR_COLLEGES.filter(
        (c) => c.toLowerCase().includes(lower) && !student.collegesOfInterest.includes(c)
      ).slice(0, 5)
    )
  }

  async function saveProgress() {
    await fetch('/api/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...student, onboardingCompleted: false }),
    })
  }

  async function handleComplete() {
    setSaving(true)
    await fetch('/api/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...student, onboardingCompleted: true }),
    })
    setSaving(false)
    router.push('/find-tutors')
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
      case 0: return student.grade.length > 0 && student.interests.length >= 2
      case 1: return student.goals.length >= 1
      case 2: return true // colleges are optional
      case 3: return true // preferences are optional
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

            {/* Step 0: Interests */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Tell us about yourself</h2>
                  <p className="text-sm text-muted-foreground">{"We'll use this to match you with the best tutors."}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    What grade are you in? <span className="text-accent">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GRADE_OPTIONS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update('grade', g)}
                        className={`px-3 py-2.5 rounded-xl text-sm transition-colors border-2 ${
                          student.grade === g
                            ? 'border-accent bg-accent/5 text-foreground'
                            : 'border-border hover:border-accent/30 text-foreground'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    What subjects interest you? <span className="text-accent">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Pick at least 2</p>
                  <ChipSelect
                    options={INTEREST_OPTIONS}
                    selected={student.interests}
                    onToggle={(v) => toggleArray('interests', v)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Intended major (if you have one)
                  </label>
                  <input
                    type="text"
                    value={student.intendedMajor}
                    onChange={(e) => update('intendedMajor', e.target.value)}
                    placeholder="e.g. Computer Science, Undecided..."
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* Step 1: Goals */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">What are your goals?</h2>
                  <p className="text-sm text-muted-foreground">Select everything you want help with.</p>
                </div>

                <div className="space-y-3">
                  {GOAL_OPTIONS.map((g) => {
                    const checked = student.goals.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleArray('goals', g.id)}
                        className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                          checked ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 mt-0.5 ${
                            checked ? 'bg-accent border-accent' : 'border-border'
                          }`}
                        >
                          {checked && (
                            <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{g.label}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Colleges of Interest */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Colleges of interest</h2>
                  <p className="text-sm text-muted-foreground">
                    {"We'll try to match you with tutors from these schools. This is optional."}
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={collegeInput}
                    onChange={(e) => handleCollegeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCollege(collegeInput)
                      }
                    }}
                    placeholder="Type a college name and press Enter..."
                    className={inputCls}
                  />
                  {collegeSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1">
                      {collegeSuggestions.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => addCollege(c)}
                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {student.collegesOfInterest.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {student.collegesOfInterest.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm"
                      >
                        {c}
                        <button type="button" onClick={() => removeCollege(c)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {student.collegesOfInterest.length === 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Or pick from popular schools:</p>
                    <ChipSelect
                      options={POPULAR_COLLEGES.slice(0, 12)}
                      selected={student.collegesOfInterest}
                      onToggle={(c) =>
                        student.collegesOfInterest.includes(c) ? removeCollege(c) : addCollege(c)
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Tutor preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Optional — helps us find the best personality match.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    What teaching style do you prefer?
                  </label>
                  <div className="space-y-3">
                    {TEACHING_STYLE_OPTIONS.map((ts) => (
                      <label
                        key={ts.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                          student.preferredTeachingStyle === ts.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="teachingStyle"
                          value={ts.id}
                          checked={student.preferredTeachingStyle === ts.id}
                          onChange={() => update('preferredTeachingStyle', ts.id)}
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

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    What kind of tutor personality appeals to you?
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Pick as many as you like</p>
                  <ChipSelect
                    options={PERSONALITY_OPTIONS}
                    selected={student.tutorPersonality}
                    onToggle={(v) => toggleArray('tutorPersonality', v)}
                  />
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
                    Find My Tutors <ArrowRight className="w-4 h-4" />
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
