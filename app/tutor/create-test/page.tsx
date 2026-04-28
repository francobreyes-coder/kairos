'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  ChevronRight,
  Shuffle,
  Save,
  ClipboardList,
  Filter,
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react'

interface Question {
  id: string
  exam_type: string
  subject: string
  question_type: string
  difficulty: string
  question_text: string
  answer_choices: { label: string; text: string }[]
  correct_answer: string
  figures: { url: string; caption: string }[]
}

type Step = 'filters' | 'preview' | 'save'

interface Section {
  // Local-only id so React can key list rows.
  uid: string
  // Optional human label; if blank we synthesize "SAT <subject>" at save time.
  label: string
  subject: string
  question_type: string
  difficulty: '' | 'easy' | 'medium' | 'hard'
  limit: number
  // Cached count of available questions matching this section's filters.
  available: number | null
  // Cached question_type options for this subject.
  questionTypeOptions: string[]
}

function makeSection(): Section {
  return {
    uid: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    subject: '',
    question_type: '',
    difficulty: '',
    limit: 10,
    available: null,
    questionTypeOptions: [],
  }
}

function defaultLabel(s: Section): string {
  if (s.label.trim()) return s.label.trim()
  if (s.subject) return `SAT ${s.subject}`
  return 'SAT Section'
}

interface PreviewSection {
  label: string
  questions: Question[]
}

export default function CreateTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // ACT is locked for now — exam type is fixed to SAT.
  const examType: 'SAT' = 'SAT'
  const [subjects, setSubjects] = useState<string[]>([])

  // Sections list — at least one section always present.
  const [sections, setSections] = useState<Section[]>([makeSection()])

  // Generation state
  const [step, setStep] = useState<Step>('filters')
  const [previewSections, setPreviewSections] = useState<PreviewSection[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testName, setTestName] = useState('')
  const [savedTestId, setSavedTestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  // Load SAT subjects once on mount.
  useEffect(() => {
    fetch(`/api/tests?action=subjects&exam_type=${examType}`)
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects ?? []))
  }, [])

  function updateSection(uid: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)))
  }

  // When subject changes, reload question types and reset the question_type field.
  async function handleSubjectChange(uid: string, subject: string) {
    updateSection(uid, { subject, question_type: '', questionTypeOptions: [], available: null })
    if (!subject) return
    const res = await fetch(
      `/api/tests?action=question_types&exam_type=${examType}&subject=${encodeURIComponent(subject)}`,
    )
    const d = await res.json()
    updateSection(uid, { questionTypeOptions: d.question_types ?? [] })
  }

  // Refresh availability count any time a section's filters change.
  useEffect(() => {
    let cancelled = false
    sections.forEach(async (s) => {
      const params = new URLSearchParams({ action: 'count', exam_type: examType })
      if (s.subject) params.set('subject', s.subject)
      if (s.question_type) params.set('question_type', s.question_type)
      if (s.difficulty) params.set('difficulty', s.difficulty)
      const res = await fetch(`/api/tests?${params}`)
      const d = await res.json()
      if (cancelled) return
      setSections((prev) =>
        prev.map((x) => (x.uid === s.uid ? { ...x, available: d.count ?? 0 } : x)),
      )
    })
    return () => {
      cancelled = true
    }
    // We only refetch when the filter-affecting fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sections.map((s) => `${s.uid}|${s.subject}|${s.question_type}|${s.difficulty}`).join(','),
  ])

  function addSection() {
    setSections((prev) => [...prev, makeSection()])
  }

  function removeSection(uid: string) {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.uid !== uid)))
  }

  const totalQuestions = useMemo(
    () => sections.reduce((acc, s) => acc + Math.min(s.limit, s.available ?? s.limit), 0),
    [sections],
  )

  const canGenerate =
    sections.length > 0 &&
    sections.every((s) => s.subject && s.limit > 0 && (s.available ?? 0) > 0)

  // Convert UI sections → API payload.
  function toPayloadSections() {
    return sections.map((s) => ({
      label: defaultLabel(s),
      subject: s.subject,
      question_type: s.question_type || undefined,
      difficulty: s.difficulty || undefined,
      limit: s.limit,
    }))
  }

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          exam_type: examType,
          sections: toPayloadSections(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPreviewSections(data.sections ?? [])
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!testName.trim()) {
      setError('Please enter a test name')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const filterPayload = toPayloadSections()
      const sectionsPayload = previewSections.map((sec, i) => ({
        // Echo back filters so re-shuffling and inspection later have full context.
        ...(filterPayload[i] ?? {}),
        label: sec.label,
        question_ids: sec.questions.map((q) => q.id),
      }))

      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          name: testName.trim(),
          exam_type: examType,
          sections: sectionsPayload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSavedTestId(data.test.id)
      setStep('save')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-4xl flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <div className="mx-auto max-w-4xl">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/tutor/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/tutor/tests" className="hover:text-foreground transition-colors">
              My Tests
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Create Test</span>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">Create Custom Test</h1>
          <p className="text-muted-foreground mb-8">
            Build a test by adding one or more sections. Each section pulls a randomized set of
            questions matching its filters.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm mb-6">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step: Filters */}
          {step === 'filters' && (
            <div className="space-y-6">

              {/* Exam Type — ACT locked */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Exam
                  </h2>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent text-accent-foreground shadow-sm cursor-default"
                  >
                    SAT
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="ACT support is coming soon"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-secondary text-muted-foreground/70 cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    ACT — Coming Soon
                  </button>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                {sections.map((s, idx) => (
                  <div key={s.uid} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Section {idx + 1}
                        </h2>
                      </div>
                      {sections.length > 1 && (
                        <button
                          onClick={() => removeSection(s.uid)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Section label */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Section Label{' '}
                          <span className="text-muted-foreground/60">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder={s.subject ? `SAT ${s.subject}` : 'e.g. SAT Math — Algebra'}
                          value={s.label}
                          onChange={(e) => updateSection(s.uid, { label: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
                        />
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Subject
                        </label>
                        <select
                          value={s.subject}
                          onChange={(e) => handleSubjectChange(s.uid, e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30"
                        >
                          <option value="">Select subject…</option>
                          {subjects.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Question Type */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Question Type
                        </label>
                        <select
                          value={s.question_type}
                          onChange={(e) => updateSection(s.uid, { question_type: e.target.value })}
                          disabled={!s.subject}
                          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                        >
                          <option value="">All Types</option>
                          {s.questionTypeOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Difficulty */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Difficulty
                        </label>
                        <select
                          value={s.difficulty}
                          onChange={(e) =>
                            updateSection(s.uid, {
                              difficulty: e.target.value as Section['difficulty'],
                            })
                          }
                          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30"
                        >
                          <option value="">All Difficulties</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>

                      {/* Question Count */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Number of Questions
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={Math.max(1, Math.min(100, s.available ?? 100))}
                            step={1}
                            value={s.limit}
                            onChange={(e) =>
                              updateSection(s.uid, { limit: parseInt(e.target.value) })
                            }
                            className="flex-1 accent-accent"
                            disabled={!s.subject}
                          />
                          <input
                            type="number"
                            min={1}
                            max={s.available ?? 999}
                            value={s.limit}
                            onChange={(e) =>
                              updateSection(s.uid, {
                                limit: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-20 h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm text-center outline-none focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                      </div>
                    </div>

                    {s.subject && s.available !== null && (
                      <p className="text-xs text-muted-foreground mt-3">
                        {s.available} questions available
                        {s.limit > s.available && (
                          <span className="text-amber-600 ml-1">
                            (only {s.available} will be included)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                ))}

                <button
                  onClick={addSection}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Section
                </button>
              </div>

              {/* Generate */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {sections.length} section{sections.length !== 1 ? 's' : ''} ·{' '}
                      {totalQuestions} questions total
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each section will be drawn independently and shuffled.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !canGenerate}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shuffle className="w-4 h-4" />
                  )}
                  {generating ? 'Generating...' : 'Generate Test'}
                </button>
                {!canGenerate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Each section needs a subject and at least one matching question.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('filters')}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sections
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:border-accent/30 hover:text-foreground transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Re-Shuffle
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview ({previewSections.reduce((a, s) => a + s.questions.length, 0)} questions ·{' '}
                    {previewSections.length} section{previewSections.length !== 1 ? 's' : ''})
                  </h2>
                </div>

                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                  {previewSections.map((sec, si) => {
                    let runningIndex = 0
                    for (let i = 0; i < si; i++) runningIndex += previewSections[i].questions.length
                    return (
                      <div key={si}>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                          <span className="text-xs font-bold text-accent">
                            Section {si + 1}
                          </span>
                          <span className="text-xs text-foreground font-semibold">
                            {sec.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {sec.questions.length} questions
                          </span>
                        </div>
                        <div className="space-y-3">
                          {sec.questions.map((q, i) => (
                            <div
                              key={q.id}
                              className="rounded-xl border border-border/50 p-4 hover:bg-secondary/30 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {runningIndex + i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                                    {q.question_text}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {q.figures && q.figures.length > 0 && (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                        {q.figures.length} figure
                                        {q.figures.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                      {q.subject}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                      {q.question_type}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        q.difficulty === 'easy'
                                          ? 'bg-green-100 text-green-700'
                                          : q.difficulty === 'medium'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {q.difficulty}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Save section */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Save className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Save Test
                  </h2>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. SAT Math + Reading Mock"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="flex-1 h-11 px-4 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !testName.trim()}
                    className="inline-flex items-center gap-2 px-6 h-11 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Saved confirmation */}
          {step === 'save' && savedTestId && (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Test Saved!</h2>
              <p className="text-muted-foreground mb-6">
                &ldquo;{testName}&rdquo; with{' '}
                {previewSections.reduce((a, s) => a + s.questions.length, 0)} questions across{' '}
                {previewSections.length} section{previewSections.length !== 1 ? 's' : ''} has been
                saved.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href="/tutor/tests"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:border-accent/30 hover:text-foreground transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  View All Tests
                </Link>
                <button
                  onClick={() => {
                    setStep('filters')
                    setPreviewSections([])
                    setTestName('')
                    setSavedTestId(null)
                    setSections([makeSection()])
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
