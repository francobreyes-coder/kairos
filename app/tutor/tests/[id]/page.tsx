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
  passage_ids: string[] | null
  question_number: number | null
  context_lines: number[] | null
}

interface Passage {
  id: string
  exam_type: string
  subject: string
  title: string | null
  passage_number: number | null
  kind: 'single' | 'paired-A' | 'paired-B'
  body: string
  figures: { url?: string; caption: string }[]
}

// Strip a trailing answer-choice block (two or more consecutive lines like
// "F. ..." / "A. ...") from a stem — kept for legacy questions whose
// stems still have choices embedded in the text.
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

// Parse the raw "Passage:\n<title>\n\n<context>\n\n<stem>" format into
// three labeled parts. Title is the bracketed/short first line if any;
// context is everything between the title and the question stem; stem
// starts at "Question N:" / "<digits>." / falls back to the last \n\n.
function parseQuestionText(text: string): {
  title: string | null
  context: string | null
  stem: string
} {
  if (!text) return { title: null, context: null, stem: '' }
  let body = text.startsWith('Passage:')
    ? text.slice('Passage:'.length).replace(/^\s+/, '')
    : text

  let title: string | null = null
  const lines = body.split('\n')
  const firstLine = lines[0].trim()
  const bracketed = firstLine.match(/^\[(.+)\]$/)
  if (bracketed) {
    const inner = bracketed[1]
      .replace(/Passage\s+[IVXLCDM]+(\s*,\s*continued)?/gi, '')
      .replace(/Paragraph\s+\d+(\s*,\s*continued)?/gi, '')
      .replace(/^[\s—–\-,]+|[\s—–\-,]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (inner.length >= 4 && /[A-Za-z]/.test(inner) && !/^\d+$/.test(inner)) {
      title = inner
    }
    body = lines.slice(1).join('\n').replace(/^\s+/, '')
  } else {
    const inline = firstLine.match(/^PASSAGE\s+[IVXLCDM]+\s*[—–\-]\s*(.+)$/i)
    const wrap = firstLine.match(/^Passage\s*\(Passage\s+[IVXLCDM]+\s*[-–—]\s*([^)]+)\)/i)
    if (inline) {
      title = inline[1].trim()
      body = lines.slice(1).join('\n').replace(/^\s+/, '')
    } else if (wrap) {
      title = wrap[1].trim()
      body = lines.slice(1).join('\n').replace(/^\s+/, '')
    } else if (
      firstLine.length >= 5 &&
      firstLine.length <= 80 &&
      /^[A-Z]/.test(firstLine) &&
      !/[.!?]$/.test(firstLine) &&
      !/^(In|On|At|For|To|If|When|While|After|Before|This|These|That|Those|For me|Even though|Whether|Although|However|But|And|So|Yet|Such|Many|Most|Some|All|Both|Each|Every|My|Our|Your|His|Her|Their|Its)\s/i.test(firstLine)
    ) {
      title = firstLine
      body = lines.slice(1).join('\n').replace(/^\s+/, '')
    }
  }

  const qMatch = body.match(/(?:^|\n\s*\n)(Question\s+\d+\s*[:.]|\d+\.\s+(?=[A-Z]))/i)
  if (qMatch && qMatch.index !== undefined) {
    const splitAt = qMatch.index + (qMatch[0].length - qMatch[1].length)
    const context = body.slice(0, splitAt).trim()
    const stem = stripEmbeddedChoices(body.slice(splitAt).replace(/^\s*\n*/, '').trim())
    return { title, context: context || null, stem }
  }

  const lastBoundary = body.lastIndexOf('\n\n')
  if (lastBoundary < 0) {
    return { title, context: null, stem: stripEmbeddedChoices(body.trim()) }
  }
  return {
    title,
    context: body.slice(0, lastBoundary).trim() || null,
    stem: stripEmbeddedChoices(body.slice(lastBoundary + 2).trim()),
  }
}

interface PassageBlock {
  // 0 (Math), 1 (typical), or 2 (paired Reading A + B) passages.
  passages: Passage[]
  // Combined caption-deduped figures from all passages in the block.
  figures: Figure[]
  questions: Question[]
}

function normalizeCaption(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Walk questions in order; bundle consecutive questions whose passage_ids
// overlap into one block. Standalone questions (Math: passage_ids empty)
// each become their own block. Paired Reading questions reference both
// the A and B passages; siblings sharing either id stay together.
function groupByPassageIds(
  questions: Question[],
  passageMap: Map<string, Passage>,
): PassageBlock[] {
  const blocks: PassageBlock[] = []
  for (const q of questions) {
    const ids = q.passage_ids ?? []
    const last = blocks[blocks.length - 1]
    const lastIds = last
      ? new Set(last.questions.flatMap((qq) => qq.passage_ids ?? []))
      : new Set<string>()
    const overlaps = ids.length > 0 && ids.some((id) => lastIds.has(id))
    if (last && overlaps) {
      last.questions.push(q)
      for (const id of ids) {
        if (!last.passages.some((p) => p.id === id)) {
          const p = passageMap.get(id)
          if (p) last.passages.push(p)
        }
      }
    } else {
      const passages = ids
        .map((id) => passageMap.get(id))
        .filter(Boolean) as Passage[]
      blocks.push({ passages, questions: [q], figures: [] })
    }
  }

  // Build the figure list per block: figures attached to the passage
  // record (these are shared by everyone in the block) plus question
  // figures that appear on 2+ siblings (caption-dedup).
  for (const block of blocks) {
    const seen = new Set<string>()
    const figs: Figure[] = []
    for (const p of block.passages) {
      for (const f of p.figures ?? []) {
        const key = normalizeCaption(f.caption)
        if (!key || seen.has(key)) continue
        seen.add(key)
        if (f.url) figs.push({ url: f.url, caption: f.caption })
      }
    }
    block.figures = figs
  }

  return blocks
}

// Convert ^N markers in a passage body into superscript references so
// readers can find the spot a question is asking about. Renders inline,
// preserving paragraph breaks via whitespace-pre-wrap on the parent.
function renderPassageBody(body: string) {
  const parts = body.split(/(\^\d+)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\^(\d+)$/)
    if (m) {
      return (
        <sup
          key={i}
          className="text-[10px] font-semibold text-accent mx-0.5 align-super"
        >
          {m[1]}
        </sup>
      )
    }
    return <span key={i}>{p}</span>
  })
}

function formatContextRef(lines: number[] | null | undefined): string | null {
  if (!lines || lines.length === 0) return null
  if (lines.length === 1) return `Line ${lines[0]}`
  if (lines.length === 2) return `Lines ${lines[0]}–${lines[1]}`
  return `Lines ${lines.join(', ')}`
}

interface SectionFilter {
  label: string
  subject?: string
  question_type?: string
  difficulty?: string
  limit?: number
}

interface Test {
  id: string
  name: string
  exam_type: string
  question_count: number
  created_at: string
  questions: Question[]
  passages: Passage[]
  // Parallel array — section_index per question, in `questions` order.
  section_indices: number[]
  filters?: { sections?: SectionFilter[] } & Record<string, any>
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

          {/* Questions, optionally grouped by section (newer tests) and within
              each section grouped by shared passage. Each passage-block renders
              its passage(s) + figures once at the top, then per-question stems. */}
          <div className="space-y-8">
            {(() => {
              const passageMap = new Map<string, Passage>()
              for (const p of test.passages ?? []) passageMap.set(p.id, p)

              // Slice questions into sections using the parallel section_indices
              // array. Legacy tests (all zeros, no filters.sections) collapse
              // into a single unlabeled group so the header is hidden.
              const sectionIdx = test.section_indices ?? test.questions.map(() => 0)
              const groups = new Map<number, Question[]>()
              const order: number[] = []
              test.questions.forEach((q, i) => {
                const idx = sectionIdx[i] ?? 0
                if (!groups.has(idx)) {
                  groups.set(idx, [])
                  order.push(idx)
                }
                groups.get(idx)!.push(q)
              })

              const sectionFilters = test.filters?.sections ?? []
              const showSectionHeaders = sectionFilters.length > 1

              let qNum = 0
              return order.map((sIdx) => {
                const sectionQs = groups.get(sIdx) ?? []
                const blocks = groupByPassageIds(sectionQs, passageMap)
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
                        <span className="text-xs text-muted-foreground">
                          · {sectionQs.length} questions
                        </span>
                      </div>
                    )}
                    <div className="space-y-6">
              {blocks.map((block, bi) => {
                const hasPassage = block.passages.length > 0 || block.figures.length > 0
                return (
                  <div key={bi} className="space-y-3">
                    {hasPassage && (
                      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
                        {block.passages.map((p) => (
                          <div key={p.id}>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-accent mb-2">
                              {p.kind === 'paired-A'
                                ? 'Passage A'
                                : p.kind === 'paired-B'
                                  ? 'Passage B'
                                  : 'Passage'}
                              {p.title ? `: ${p.title}` : ''}
                            </div>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                              {renderPassageBody(p.body)}
                            </p>
                          </div>
                        ))}
                        {block.figures.length > 0 && (
                          <div className="space-y-3">
                            {block.figures.map((fig, fi) => (
                              <figure
                                key={fi}
                                className="rounded-xl border border-border bg-card p-3"
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
                      </div>
                    )}

                    {block.questions.map((q) => {
                      qNum++
                      const ctxRef = formatContextRef(q.context_lines)
                      return (
                        <div
                          key={q.id}
                          className="rounded-2xl border border-border bg-card p-5"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent text-sm font-bold flex items-center justify-center flex-shrink-0">
                              {qNum}
                            </span>
                            <div className="flex-1 min-w-0">
                              {ctxRef && (
                                <p className="text-[11px] font-medium uppercase tracking-wide text-accent/80 mb-2">
                                  → {ctxRef}
                                </p>
                              )}
                              <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-wrap">
                                {stripEmbeddedChoices(q.question_text)}
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
                      )
                    })}
                  </div>
                )
              })}
                    </div>
                  </div>
                )
              })
            })()}
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
