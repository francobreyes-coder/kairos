'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  ChevronRight,
  ArrowLeft,
  Hash,
  Calendar,
  ClipboardList,
  AlertCircle,
} from 'lucide-react'

interface Figure {
  url: string
  caption: string
}

interface Question {
  id: string
  subject: string
  question_type: string
  difficulty: string
  question_text: string
  answer_choices: { label: string; text: string }[]
  correct_answer: string
  figures: Figure[]
}

interface Test {
  id: string
  name: string
  exam_type: string
  question_count: number
  created_at: string
  questions: Question[]
}

export default function ViewTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch(`/api/tests/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setTest(d.test)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status, id])

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

  if (error || !test) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-4xl text-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error ?? 'Test not found'}</p>
            <Link href="/tutor/tests" className="text-accent hover:text-accent/80 text-sm font-medium">
              Back to My Tests
            </Link>
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
            <span className="text-foreground font-medium truncate max-w-[200px]">{test.name}</span>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{test.name}</h1>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent">
                  {test.exam_type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  {test.questions.length} questions
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(test.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:border-accent/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAnswers ? 'Hide Answers' : 'Show Answers'}
            </button>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {test.questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-wrap">
                      {q.question_text}
                    </p>

                    {q.figures && q.figures.length > 0 && (
                      <div className="space-y-3 mb-3">
                        {q.figures.map((fig, fi) => (
                          <figure
                            key={fi}
                            className="rounded-xl border border-border bg-secondary/30 p-3"
                          >
                            <img
                              src={fig.url}
                              alt={fig.caption || `Figure ${fi + 1}`}
                              className="w-full max-w-xl mx-auto rounded-lg bg-white"
                            />
                            {fig.caption && (
                              <figcaption className="text-xs text-muted-foreground mt-2 text-center">
                                {fig.caption}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                    )}

                    {q.answer_choices.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {q.answer_choices.map((c) => (
                          <div
                            key={c.label}
                            className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
                              showAnswers && c.label === q.correct_answer
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-secondary/50'
                            }`}
                          >
                            <span className="font-semibold text-xs mt-0.5 w-5 flex-shrink-0">
                              {c.label})
                            </span>
                            <span>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
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
                      {showAnswers && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                          Answer: {q.correct_answer}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link
              href="/tutor/tests"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to My Tests
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
