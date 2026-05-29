'use client'

import { useEffect, useState, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
} from 'lucide-react'

interface AnswerChoice {
  label: string
  text: string
}

interface Question {
  id: string
  subject: string
  question_type: string
  difficulty: string
  question_text: string
  answer_choices: AnswerChoice[]
  correct_answer: string
  explanation: string | null
  figures: { url?: string; caption: string }[]
}

interface Test {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  questions: Question[]
  section_indices: number[]
  filters?: { sections?: { label: string }[] } & Record<string, unknown>
}

interface Attempt {
  id: string
  test_id: string
  student_id: string
  answers: Record<string, string>
  correct_count: number
  total_count: number
  submitted_at: string
  student_name: string | null
}

// Mirror the student runner's permissive matching so a fill-in like ".5"
// matches a stored "0.5". Duplicated here on purpose so the review page
// doesn't pull the entire test-runner module just for one helper.
function parseNumeric(s: string): number | null {
  const trimmed = s.trim()
  const fracMatch = trimmed.match(/^(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)$/)
  if (fracMatch) {
    const num = parseFloat(fracMatch[1])
    const den = parseFloat(fracMatch[2])
    if (den === 0 || !isFinite(num) || !isFinite(den)) return null
    return num / den
  }
  const n = parseFloat(trimmed)
  return isFinite(n) && /^-?\d*\.?\d+$/.test(trimmed) ? n : null
}

function answerMatches(given: string | undefined, expected: string): boolean {
  if (given == null) return false
  const a = given.trim()
  const b = expected.trim()
  if (a === '' || b === '') return false
  if (a === b) return true
  const na = parseNumeric(a)
  const nb = parseNumeric(b)
  if (na != null && nb != null && Math.abs(na - nb) < 1e-9) return true
  return false
}

function stripEmbeddedChoices(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length - 1; i++) {
    if (
      /^[A-DF-J]\.\s/.test(lines[i].trim()) &&
      /^[A-DF-J]\.\s/.test(lines[i + 1].trim())
    ) {
      return lines.slice(0, i).join('\n').replace(/\s+$/, '')
    }
  }
  return text
}

export default function TutorReviewAttemptPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>
}) {
  const { id, attemptId } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [test, setTest] = useState<Test | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    Promise.all([
      fetch(`/api/tests/${id}`).then((r) => r.json()),
      fetch(`/api/tests/${id}/attempts/${attemptId}`).then((r) => r.json()),
    ])
      .then(([testData, attemptData]) => {
        if (cancelled) return
        if (testData.error) throw new Error(testData.error)
        if (attemptData.error) throw new Error(attemptData.error)
        setTest(testData.test)
        setAttempt(attemptData.attempt)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, id, attemptId])

  if (status === 'loading' || loading) {
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

  if (error || !test || !attempt) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-4xl text-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error ?? 'Attempt not found'}</p>
            <Link href="/tutor/dashboard" className="text-accent hover:text-accent/80 text-sm font-medium">
              Back to Dashboard
            </Link>
          </div>
        </main>
      </>
    )
  }

  const pct =
    attempt.total_count > 0
      ? Math.round((attempt.correct_count / attempt.total_count) * 100)
      : 0

  const sectionFilters = test.filters?.sections ?? []
  const showSectionHeaders = sectionFilters.length > 1
  const sectionIdx = test.section_indices ?? test.questions.map(() => 0)
  const grouped = new Map<number, { i: number; q: Question }[]>()
  const order: number[] = []
  test.questions.forEach((q, i) => {
    const idx = sectionIdx[i] ?? 0
    if (!grouped.has(idx)) {
      grouped.set(idx, [])
      order.push(idx)
    }
    grouped.get(idx)!.push({ i, q })
  })

  const submittedAt = new Date(attempt.submitted_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

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
            <Link href={`/tutor/tests/${test.id}`} className="hover:text-foreground transition-colors">
              {test.name}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Submission</span>
          </div>

          {/* Header card */}
          <div className="rounded-2xl border border-border bg-card p-6 mb-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {attempt.student_name ?? 'Student'}
                </h1>
                <div className="text-sm text-muted-foreground">
                  Finished <strong>{test.name}</strong> · {submittedAt}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-accent leading-none">{pct}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {attempt.correct_count} / {attempt.total_count} correct
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-8">
            {order.map((sIdx) => {
              const sectionQs = grouped.get(sIdx) ?? []
              const sectionLabel = sectionFilters[sIdx]?.label ?? `Section ${sIdx + 1}`
              return (
                <div key={`sec-${sIdx}`} className="space-y-4">
                  {showSectionHeaders && (
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <span className="text-xs font-bold uppercase tracking-wide text-accent">
                        Section {sIdx + 1}
                      </span>
                      <span className="text-base font-semibold text-foreground">
                        {sectionLabel}
                      </span>
                    </div>
                  )}
                  <div className="space-y-4">
                    {sectionQs.map(({ i, q }) => {
                      const given = attempt.answers[q.id]
                      const isCorrect = answerMatches(given, q.correct_answer)
                      const isSkipped = !given || given.trim() === ''
                      const isFillIn = !q.answer_choices || q.answer_choices.length === 0
                      return (
                        <div
                          key={q.id}
                          className="rounded-2xl border border-border bg-card p-5"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <span
                              className={`w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center flex-shrink-0 ${
                                isSkipped
                                  ? 'bg-secondary text-muted-foreground'
                                  : isCorrect
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isSkipped ? '—' : isCorrect ? <Check size={14} /> : <X size={14} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                                Question {i + 1}
                              </div>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {stripEmbeddedChoices(q.question_text)}
                              </p>
                            </div>
                          </div>

                          {isFillIn ? (
                            <div className="pl-11 space-y-1.5">
                              <div
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm border ${
                                  isSkipped
                                    ? 'bg-secondary/40 border-border text-muted-foreground'
                                    : isCorrect
                                      ? 'bg-green-50 border-green-200 text-green-800'
                                      : 'bg-red-50 border-red-200 text-red-800'
                                }`}
                              >
                                <span className="font-semibold min-w-[6rem]">Student</span>
                                <span>{isSkipped ? '— (skipped)' : given}</span>
                              </div>
                              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-green-50 border border-green-200 text-green-800">
                                <span className="font-semibold min-w-[6rem]">Correct</span>
                                <span>{q.correct_answer}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="pl-11 space-y-1.5">
                              {q.answer_choices.map((c) => {
                                const isG = given === c.label
                                const isC = q.correct_answer === c.label
                                let cls = 'bg-secondary/40 text-foreground border-border'
                                if (isC) cls = 'bg-green-50 text-green-800 border-green-200'
                                else if (isG && !isC) cls = 'bg-red-50 text-red-800 border-red-200'
                                return (
                                  <div
                                    key={c.label}
                                    className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm border ${cls}`}
                                  >
                                    <span className="font-semibold mt-0.5 w-5">{c.label}</span>
                                    <span className="flex-1">{c.text}</span>
                                    {isC && (
                                      <span className="text-[10px] font-bold text-green-700 mt-0.5">
                                        ✓ Correct
                                      </span>
                                    )}
                                    {isG && !isC && (
                                      <span className="text-[10px] font-bold text-red-700 mt-0.5">
                                        Their answer
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {q.explanation && (
                            <div className="mt-3 ml-11 px-4 py-3 rounded-lg bg-accent/5 text-sm text-foreground/80 leading-relaxed">
                              <strong>Explanation:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-8">
            <Link
              href="/tutor/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
