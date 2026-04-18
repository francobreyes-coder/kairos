'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import { Upload, X, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { submitApplication } from '@/app/actions'

const SERVICES = [
  { id: 'essays', label: 'Essay Writing' },
  { id: 'sat-act', label: 'SAT/ACT Prep' },
  { id: 'activities', label: 'Activities List Building' },
]

const GRAD_YEARS = [2025, 2026, 2027, 2028, 2029, 2030]

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampToWords(text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length > max ? words.slice(0, max).join(' ') : text
}

// ── File upload zone ──────────────────────────────────────────────────────────
function FileUpload({
  label,
  hint,
  accept,
  required,
  value,
  onChange,
}: {
  label: string
  hint: string
  accept: string
  required?: boolean
  value: File | null
  onChange: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      <div
        onClick={() => ref.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          value
            ? 'border-accent/40 bg-accent/5'
            : 'border-border hover:border-accent/40 hover:bg-secondary/50'
        }`}
      >
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {value ? (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-sm text-foreground truncate max-w-[260px]">{value.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              className="ml-1 text-muted-foreground hover:text-foreground flex-shrink-0"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{hint}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click to browse</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const [form, setForm] = useState({
    name: '',
    dob: '',
    university: '',
    graduationYear: '',
    major: '',
    hobbies: '',
    collegeAcceptances: '',
    services: [] as string[],
    satScore: '',
    passion: '',
    whyKairos: '',
    video: null as File | null,
    resume: null as File | null,
    proof: null as File | null,
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(id)
        ? f.services.filter((s) => s !== id)
        : [...f.services, id],
    }))
  }

  // Progress — count required fields that are filled
  const checks = [
    form.name.trim().length > 0,           // 1
    form.dob.length > 0,                    // 2
    form.university.trim().length > 0,      // 3
    form.graduationYear.length > 0,         // 4
    form.major.trim().length > 0,           // 5
    form.services.length > 0,              // 6
    wordCount(form.passion) >= 10,          // 7
    wordCount(form.whyKairos) >= 10,        // 8
    form.video !== null,                    // 9
    form.resume !== null,                   // 10
    form.proof !== null,                    // 11
  ]
  const progress = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (progress < 100) return
    setSubmitting(true)
    await submitApplication({
      name: form.name,
      dob: form.dob,
      university: form.university,
      graduationYear: form.graduationYear,
      major: form.major,
      hobbies: form.hobbies,
      collegeAcceptances: form.collegeAcceptances,
      services: form.services,
      satScore: form.satScore,
      passion: form.passion,
      whyKairos: form.whyKairos,
      videoFilename: form.video?.name ?? '',
      resumeFilename: form.resume?.name ?? '',
      proofFilename: form.proof?.name ?? '',
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-3">Application Received!</h1>
            <p className="text-muted-foreground mb-8">
              {"Thank you for applying to be a Kairos tutor. We'll review your application and be in touch soon."}
            </p>
            <Link
              href="/home"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Home <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Header />

      {/* Progress bar — fixed below the header */}
      <div className="fixed top-[73px] left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border px-6 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Application Progress</span>
            <span className="text-xs font-semibold text-accent">{progress}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <main className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-2xl">

          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              Apply to Become a Tutor
            </h1>
            <p className="mt-2 text-muted-foreground">
              Share your background and help the next generation of students reach their dream schools.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Personal info ── */}
            <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide text-muted-foreground">
                Personal Information
              </h2>

              <Field label="Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </Field>

              <Field label="Date of Birth" required>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => set('dob', e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Hobbies">
                <input
                  type="text"
                  value={form.hobbies}
                  onChange={(e) => set('hobbies', e.target.value)}
                  placeholder="e.g. Photography, hiking, chess"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Academic info ── */}
            <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Academic Background
              </h2>

              <Field label="University" required>
                <input
                  type="text"
                  value={form.university}
                  onChange={(e) => set('university', e.target.value)}
                  placeholder="e.g. Harvard University"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Graduation Year" required>
                  <select
                    value={form.graduationYear}
                    onChange={(e) => set('graduationYear', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select year</option>
                    {GRAD_YEARS.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Major" required>
                  <input
                    type="text"
                    value={form.major}
                    onChange={(e) => set('major', e.target.value)}
                    placeholder="e.g. Computer Science"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="College Acceptances">
                <input
                  type="text"
                  value={form.collegeAcceptances}
                  onChange={(e) => set('collegeAcceptances', e.target.value)}
                  placeholder="e.g. Harvard, MIT, Stanford (comma separated)"
                  className={inputCls}
                />
              </Field>

              <Field label="SAT/ACT Score (if applicable)">
                <input
                  type="text"
                  value={form.satScore}
                  onChange={(e) => set('satScore', e.target.value)}
                  placeholder="e.g. 1550 SAT or 35 ACT"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* ── Tutoring services ── */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Services
              </h2>
              <p className="text-sm font-medium text-foreground mb-3">
                Which services would you like to offer?
                <span className="text-accent ml-1">*</span>
                <span className="text-muted-foreground font-normal ml-1">(Select all that apply)</span>
              </p>
              <div className="space-y-3">
                {SERVICES.map((s) => {
                  const checked = form.services.includes(s.id)
                  return (
                    <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => toggleService(s.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                          checked
                            ? 'bg-accent border-accent'
                            : 'border-border group-hover:border-accent/50'
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span onClick={() => toggleService(s.id)} className="text-sm text-foreground">
                        {s.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* ── Short answers ── */}
            <div className="rounded-2xl bg-card border border-border p-6 space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Short Answers
              </h2>

              {/* Passion */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tell us briefly about something you are passionate about.
                  <span className="text-accent ml-1">*</span>
                </label>
                <textarea
                  value={form.passion}
                  onChange={(e) => set('passion', clampToWords(e.target.value, 150))}
                  rows={5}
                  placeholder="Share what drives you..."
                  className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                />
                <div className={`text-xs mt-1 text-right tabular-nums ${wordCount(form.passion) >= 140 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                  {wordCount(form.passion)} / 150 words
                </div>
              </div>

              {/* Why Kairos */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Why do you want to become a Kairos tutor?
                  <span className="text-accent ml-1">*</span>
                </label>
                <textarea
                  value={form.whyKairos}
                  onChange={(e) => set('whyKairos', clampToWords(e.target.value, 150))}
                  rows={5}
                  placeholder="What motivates you to help high school students?"
                  className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                />
                <div className={`text-xs mt-1 text-right tabular-nums ${wordCount(form.whyKairos) >= 140 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                  {wordCount(form.whyKairos)} / 150 words
                </div>
              </div>
            </div>

            {/* ── File uploads ── */}
            <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Attachments
              </h2>

              <FileUpload
                label="One-Minute Video Introduction"
                hint="Upload a ~1 minute video telling us about yourself"
                accept="video/*"
                required
                value={form.video}
                onChange={(f) => set('video', f)}
              />

              <FileUpload
                label="Resume"
                hint="PDF or Word document (.pdf, .doc, .docx)"
                accept=".pdf,.doc,.docx"
                required
                value={form.resume}
                onChange={(f) => set('resume', f)}
              />

              <FileUpload
                label="Proof of Admission"
                hint="Student ID, Canvas screenshot, or acceptance letter"
                accept="image/*,.pdf"
                required
                value={form.proof}
                onChange={(f) => set('proof', f)}
              />
            </div>

            {/* ── Submit ── */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={progress < 100 || submitting}
                className="w-full h-12 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit Application
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {progress < 100 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Complete all required fields to submit ({progress}% done).
                </p>
              )}
            </div>

          </form>
        </div>
      </main>
    </>
  )
}
