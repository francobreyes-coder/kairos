'use client'

import { useState, useEffect } from 'react'
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
  Hash,
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowLeft,
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
}

type Step = 'filters' | 'preview' | 'save'

export default function CreateTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Filter state
  const [examType, setExamType] = useState<'SAT' | 'ACT'>('SAT')
  const [subjects, setSubjects] = useState<string[]>([])
  const [questionTypes, setQuestionTypes] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [questionCount, setQuestionCount] = useState(20)
  const [availableCount, setAvailableCount] = useState<number | null>(null)

  // Generation state
  const [step, setStep] = useState<Step>('filters')
  const [questions, setQuestions] = useState<Question[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testName, setTestName] = useState('')
  const [savedTestId, setSavedTestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  // Load subjects when exam type changes
  useEffect(() => {
    setSelectedSubject('')
    setSelectedType('')
    fetch(`/api/tests?action=subjects&exam_type=${examType}`)
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects ?? []))
  }, [examType])

  // Load question types when subject changes
  useEffect(() => {
    setSelectedType('')
    if (!selectedSubject) {
      setQuestionTypes([])
      return
    }
    fetch(`/api/tests?action=question_types&exam_type=${examType}&subject=${encodeURIComponent(selectedSubject)}`)
      .then((r) => r.json())
      .then((d) => setQuestionTypes(d.question_types ?? []))
  }, [examType, selectedSubject])

  // Count available questions when filters change
  useEffect(() => {
    const params = new URLSearchParams({ action: 'count', exam_type: examType })
    if (selectedSubject) params.set('subject', selectedSubject)
    if (selectedType) params.set('question_type', selectedType)
    if (selectedDifficulty) params.set('difficulty', selectedDifficulty)

    fetch(`/api/tests?${params}`)
      .then((r) => r.json())
      .then((d) => setAvailableCount(d.count ?? 0))
  }, [examType, selectedSubject, selectedType, selectedDifficulty])

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const filters: Record<string, any> = {
        exam_type: examType,
        limit: questionCount,
      }
      if (selectedSubject) filters.subject = selectedSubject
      if (selectedType) filters.question_type = selectedType
      if (selectedDifficulty) filters.difficulty = selectedDifficulty

      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', filters }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setQuestions(data.questions)
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
      const filters: Record<string, any> = { exam_type: examType }
      if (selectedSubject) filters.subject = selectedSubject
      if (selectedType) filters.question_type = selectedType
      if (selectedDifficulty) filters.difficulty = selectedDifficulty
      filters.limit = questionCount

      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          name: testName.trim(),
          exam_type: examType,
          filters,
          question_ids: questions.map((q) => q.id),
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
            Select filters, set the number of questions, and generate a randomized test.
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

              {/* Exam Type */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Filters
                  </h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Exam */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Exam Type
                    </label>
                    <div className="flex gap-2">
                      {(['SAT', 'ACT'] as const).map((e) => (
                        <button
                          key={e}
                          onClick={() => setExamType(e)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            examType === e
                              ? 'bg-accent text-accent-foreground shadow-sm'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Subject
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Question Type */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Question Type
                    </label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      disabled={!selectedSubject}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                    >
                      <option value="">All Types</option>
                      {questionTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Difficulty
                    </label>
                    <select
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Question Count */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Number of Questions
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={5}
                    max={Math.min(100, availableCount ?? 100)}
                    step={1}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min={1}
                    max={availableCount ?? 999}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 h-10 px-3 rounded-xl bg-secondary border border-border text-foreground text-sm text-center outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                {availableCount !== null && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {availableCount} questions available with current filters
                    {questionCount > availableCount && (
                      <span className="text-amber-600 ml-1">
                        (only {availableCount} will be included)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || availableCount === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shuffle className="w-4 h-4" />
                )}
                {generating ? 'Generating...' : 'Generate Test'}
              </button>
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
                  Back to Filters
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:border-accent/30 hover:text-foreground transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Re-Shuffle
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview ({questions.length} questions)
                  </h2>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {questions.map((q, i) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-border/50 p-4 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                            {q.question_text}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {q.subject}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {q.question_type}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              q.difficulty === 'easy'
                                ? 'bg-green-100 text-green-700'
                                : q.difficulty === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              {q.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    placeholder="e.g. SAT Math — Algebra Focus"
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
                &ldquo;{testName}&rdquo; with {questions.length} questions has been saved.
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
                    setQuestions([])
                    setTestName('')
                    setSavedTestId(null)
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
