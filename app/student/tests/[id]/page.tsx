'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  use,
} from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  Flag,
  FunctionSquare,
  Highlighter,
  LayoutGrid,
  Loader2,
  X,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────
interface AnswerChoice {
  label: string
  text: string
}

interface Figure {
  url?: string
  caption: string
}

interface RawQuestion {
  id: string
  subject: string
  question_type: string
  difficulty: string
  question_text: string
  answer_choices: AnswerChoice[]
  correct_answer: string
  explanation?: string | null
  figures?: Figure[]
  passage_ids?: string[] | null
  context_lines?: number[] | null
}

interface RawPassage {
  id: string
  exam_type: string
  subject: string
  title: string | null
  passage_number: number | null
  kind: 'single' | 'paired-A' | 'paired-B'
  body: string
  figures: Figure[]
}

interface RawTest {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  created_at: string
  questions: RawQuestion[]
  passages: RawPassage[]
  section_indices: number[]
  filters?: {
    sections?: Array<{
      label: string
      subject?: string
      question_type?: string
      difficulty?: string
    }>
  } & Record<string, unknown>
}

interface AdaptedQuestion extends RawQuestion {
  // Stable key for the combined passage panel: sorted join of passage_ids,
  // or null when the question has no passage.
  passageKey: string | null
  passageIds: string[]
  // Pre-stripped stem (no embedded answer-choice block, no header line).
  cleanStem: string
}

interface AdaptedSection {
  id: string
  name: string
  moduleLabel: string
  duration: number
  hasFormula: boolean
  hasCalculator: boolean
  questions: AdaptedQuestion[]
}

interface AdaptedPassage {
  citation: string
  // Highlightable body HTML (text only). Figures are rendered separately
  // so the Selection-API highlighter doesn't have to deal with images.
  body: string
  figures: Figure[]
}

interface AdaptedTest {
  name: string
  examType: 'SAT' | 'ACT'
  sections: AdaptedSection[]
  // Keyed by passageKey (sorted-joined ids), since paired Reading questions
  // reference two passages that we render together in one panel.
  passages: Record<string, AdaptedPassage>
}

// ── Helpers ────────────────────────────────────────────────────────────
function fmtTime(s: number | null): string {
  if (s == null) return '--:--'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function timerKind(s: number | null): 'ok' | 'warn' | 'danger' {
  if (s == null) return 'ok'
  if (s < 300) return 'danger'
  if (s < 600) return 'warn'
  return 'ok'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Mirror tutor view: trailing answer-choice block (e.g. consecutive
// "A. ..." / "B. ..." lines) is stripped from legacy stems.
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

// Render the question_text, mirroring the tutor view's behavior. We only
// strip the legacy "Passage:\n[Title]\n\n…\n\nQuestion N: stem" envelope
// when the question already has a first-class passage in the side panel
// — otherwise that passage isn't shown anywhere else. Splitting on the
// last \n\n (which an earlier version did) eats the problem setup of any
// two-paragraph stem ("Solve …\n\nWhich value …" or the SAT vocab blank
// pattern), so we don't do that.
function cleanQuestionText(text: string, hasFirstClassPassage: boolean): string {
  if (!text) return ''
  let body = text
  if (hasFirstClassPassage && body.startsWith('Passage:')) {
    body = body.slice('Passage:'.length).replace(/^\s+/, '')
    const lines = body.split('\n')
    const firstLine = lines[0]?.trim() ?? ''
    if (/^\[.+\]$/.test(firstLine)) {
      body = lines.slice(1).join('\n').replace(/^\s+/, '')
    }
    const qMatch = body.match(/(?:^|\n\s*\n)(Question\s+\d+\s*[:.]|\d+\.\s+(?=[A-Z]))/i)
    if (qMatch && qMatch.index !== undefined) {
      const splitAt = qMatch.index + (qMatch[0].length - qMatch[1].length)
      body = body.slice(splitAt).replace(/^\s*\n*/, '').trim()
    }
  }
  return stripEmbeddedChoices(body)
}

// Permissive correctness check. SAT student-produced response (SPR) items
// accept several forms of the same value — "0.5", ".5", and "1/2" all match
// — so we compare numerically when both sides parse, and fall back to
// trimmed string equality otherwise (which is what choice-letter answers
// rely on).
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

// `^N` markers in a passage body are line-reference anchors. The tutor
// view renders them as superscripts; we do the same so questions citing
// "Line 3" land on something visible.
function passageBodyToHtml(citation: string, body: string): string {
  const escaped = escapeHtml(body).replace(
    /\^(\d+)/g,
    '<sup class="kt-line-ref">$1</sup>',
  )
  const paragraphs = escaped
    .split('\n\n')
    .map((para) => `<p>${para.trim()}</p>`)
    .join('')
  return `<div class="kt-passage-citation">${escapeHtml(citation)}</div>${paragraphs}`
}

function passageKeyFor(ids: string[]): string | null {
  if (!ids || ids.length === 0) return null
  return [...ids].sort().join('|')
}

function adaptTest(raw: RawTest): AdaptedTest {
  const filterSections = raw.filters?.sections ?? []

  // Group questions by section_index. Legacy tests collapse to a single
  // group (index 0).
  const grouped = new Map<number, RawQuestion[]>()
  raw.questions.forEach((q, i) => {
    const idx = raw.section_indices[i] ?? 0
    if (!grouped.has(idx)) grouped.set(idx, [])
    grouped.get(idx)!.push(q)
  })

  const sectionIdxs = [...grouped.keys()].sort((a, b) => a - b)
  const sections: AdaptedSection[] = sectionIdxs.map((idx) => {
    const qs = grouped.get(idx)!
    const def = filterSections[idx]
    const subject = def?.subject || qs[0]?.subject || ''
    const labelFromDef = def?.label
    const label =
      labelFromDef ||
      (filterSections.length > 1 ? `Section ${idx + 1}` : raw.name)
    const isMath = /math/i.test(subject)
    const noCalc =
      /no\s*calc/i.test(label) ||
      /no\s*calc/i.test(def?.question_type || '')
    return {
      id: `s-${idx}`,
      name: label,
      moduleLabel: subject ? `${raw.exam_type} · ${subject}` : raw.exam_type,
      duration: Math.max(300, qs.length * 90),
      hasFormula: isMath,
      hasCalculator: isMath && !noCalc,
      questions: qs.map((q) => {
        const ids = q.passage_ids ?? []
        return {
          ...q,
          passageIds: ids,
          passageKey: passageKeyFor(ids),
          cleanStem: cleanQuestionText(q.question_text, ids.length > 0),
        }
      }),
    }
  })

  // Combine paired passages under a single composite key so the panel can
  // render Passage A and Passage B together without a re-key on toggle.
  // Figures (graphs, tables, charts) attached to passages are kept on a
  // sibling list so the highlighter doesn't have to deal with images
  // inside its contenteditable region.
  const passages: Record<string, AdaptedPassage> = {}
  const passageById = new Map(raw.passages.map((p) => [p.id, p]))
  const seenKeys = new Set<string>()
  for (const sec of sections) {
    for (const q of sec.questions) {
      if (!q.passageKey || seenKeys.has(q.passageKey)) continue
      seenKeys.add(q.passageKey)
      const ids = [...q.passageIds].sort()
      const parts: string[] = []
      const figures: Figure[] = []
      const seenCaptions = new Set<string>()
      let citationLabel = ''
      ids.forEach((pid) => {
        const p = passageById.get(pid)
        if (!p) return
        const titlePart = p.title ? `: ${p.title}` : ''
        const kindPart =
          p.kind === 'paired-A'
            ? ' A'
            : p.kind === 'paired-B'
              ? ' B'
              : ''
        const cite = `Passage${kindPart}${titlePart}`
        if (!citationLabel) citationLabel = cite
        parts.push(passageBodyToHtml(cite, p.body))
        for (const f of p.figures ?? []) {
          if (!f.url) continue
          const key = (f.caption ?? '').trim().toLowerCase()
          if (key && seenCaptions.has(key)) continue
          if (key) seenCaptions.add(key)
          figures.push(f)
        }
      })
      passages[q.passageKey] = {
        citation: citationLabel,
        body: parts.join(''),
        figures,
      }
    }
  }

  return {
    name: raw.name,
    examType: raw.exam_type,
    sections,
    passages,
  }
}

function countCorrect(
  section: AdaptedSection,
  sectionAnswers: Record<string, string>,
): number {
  return section.questions.filter((q) =>
    answerMatches(sectionAnswers[q.id], q.correct_answer),
  ).length
}

// ── Page ──────────────────────────────────────────────────────────────
export default function StudentTakeTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [raw, setRaw] = useState<RawTest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch(`/api/tests/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setRaw(d.test)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status, id])

  return (
    <>
      <KtStyles />
      <div className="kt-app">
        {status === 'loading' || loading ? (
          <div className="kt-fullpage">
            <Loader2
              size={32}
              className="kt-spin"
              style={{ color: 'var(--kt-purple-600)' }}
            />
          </div>
        ) : error || !raw ? (
          <div className="kt-fullpage">
            <AlertCircle
              size={32}
              style={{ color: 'var(--kt-danger)', marginBottom: 14 }}
            />
            <p style={{ color: 'var(--kt-fg-2)', marginBottom: 12 }}>
              {error ?? 'Test not found'}
            </p>
            <Link href="/sessions" className="kt-link-btn">
              Back to sessions
            </Link>
          </div>
        ) : (
          <TestApp raw={raw} />
        )}
      </div>
    </>
  )
}

// ── Test runtime ──────────────────────────────────────────────────────
type Phase = 'intro' | 'section-start' | 'test' | 'break' | 'done' | 'review'

function TestApp({ raw }: { raw: RawTest }) {
  const adapted = useMemo(() => adaptTest(raw), [raw])
  const sections = adapted.sections

  const [sectionIdx, setSectionIdx] = useState(0)
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({})
  const [eliminated, setEliminated] = useState<
    Record<string, Record<string, string[]>>
  >({})
  const [flagged, setFlagged] = useState<Record<string, Set<string>>>({})
  const [passageHtmls, setPassageHtmls] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [reviewSectionId, setReviewSectionId] = useState<string | null>(null)
  const [showNav, setShowNav] = useState(false)
  const [showFormula, setShowFormula] = useState(false)
  const [elimMode, setElimMode] = useState(false)

  const section = sections[sectionIdx]

  const handleSectionEnd = useCallback(() => {
    if (sectionIdx < sections.length - 1) setPhase('break')
    else setPhase('done')
  }, [sectionIdx, sections.length])

  // Tick each second while in the test phase.
  useEffect(() => {
    if (phase !== 'test' || timeLeft == null || timeLeft <= 0) return
    const id = setTimeout(() => setTimeLeft((t) => (t == null ? t : t - 1)), 1000)
    return () => clearTimeout(id)
  }, [phase, timeLeft])

  useEffect(() => {
    if (timeLeft === 0) handleSectionEnd()
  }, [timeLeft, handleSectionEnd])

  if (sections.length === 0) {
    return (
      <div className="kt-fullpage">
        <p style={{ color: 'var(--kt-fg-2)' }}>This test has no questions.</p>
      </div>
    )
  }

  const startSection = (idx: number) => {
    setSectionIdx(idx)
    setQIdx(0)
    setElimMode(false)
    setTimeLeft(sections[idx].duration)
    setPhase('test')
  }

  const handleAnswer = (letter: string) => {
    const sid = section.id
    const qid = section.questions[qIdx].id
    setAnswers((prev) => {
      const sCur = { ...(prev[sid] || {}) }
      // For fill-in-the-blank we get a free-form string; an empty input
      // means "no answer", so clear the entry to keep nav / scoring honest.
      if (letter.trim() === '') delete sCur[qid]
      else sCur[qid] = letter
      return { ...prev, [sid]: sCur }
    })
  }

  const handleEliminate = (letter: string) => {
    const sid = section.id
    const qid = section.questions[qIdx].id
    setEliminated((prev) => {
      const sCurrent = prev[sid] || {}
      const qCurrent = sCurrent[qid] || []
      const updated = qCurrent.includes(letter)
        ? qCurrent.filter((l) => l !== letter)
        : [...qCurrent, letter]
      return { ...prev, [sid]: { ...sCurrent, [qid]: updated } }
    })
  }

  const handleFlag = (qid: string) => {
    const sid = section.id
    setFlagged((prev) => {
      const s = new Set(prev[sid] || [])
      if (s.has(qid)) s.delete(qid)
      else s.add(qid)
      return { ...prev, [sid]: s }
    })
  }

  const reset = () => {
    setSectionIdx(0)
    setQIdx(0)
    setAnswers({})
    setEliminated({})
    setFlagged({})
    setPassageHtmls({})
    setTimeLeft(null)
    setPhase('intro')
  }

  if (phase === 'intro') {
    return (
      <IntroScreen
        testName={adapted.name}
        sections={sections}
        onStart={() => {
          setSectionIdx(0)
          setPhase('section-start')
        }}
      />
    )
  }
  if (phase === 'section-start') {
    return (
      <SectionStartScreen
        section={sections[sectionIdx]}
        onBegin={() => startSection(sectionIdx)}
      />
    )
  }
  if (phase === 'break') {
    const sAnswers = answers[section.id] || {}
    return (
      <BreakScreen
        completedSection={section}
        nextSection={sections[sectionIdx + 1]}
        answeredCount={Object.keys(sAnswers).length}
        totalCount={section.questions.length}
        onNext={() => {
          setSectionIdx(sectionIdx + 1)
          setPhase('section-start')
        }}
      />
    )
  }
  if (phase === 'done') {
    return (
      <DoneScreen
        sections={sections}
        answers={answers}
        onReview={(sid) => {
          setReviewSectionId(sid)
          setPhase('review')
        }}
        onRetake={reset}
      />
    )
  }
  if (phase === 'review') {
    const rs = sections.find((s) => s.id === reviewSectionId)
    if (!rs) return null
    return (
      <ReviewScreen
        section={rs}
        sectionAnswers={answers[rs.id] || {}}
        onBack={() => setPhase('done')}
      />
    )
  }

  return (
    <>
      <TestScreen
        section={section}
        qIdx={qIdx}
        answers={answers}
        eliminated={eliminated}
        flagged={flagged}
        passages={adapted.passages}
        passageHtmls={passageHtmls}
        timeLeft={timeLeft}
        elimMode={elimMode}
        onAnswer={handleAnswer}
        onEliminate={handleEliminate}
        onFlag={handleFlag}
        onNav={(i) => setQIdx(i)}
        onPassageHtml={(key, html) =>
          setPassageHtmls((prev) => ({ ...prev, [key]: html }))
        }
        onPrev={() => setQIdx((i) => Math.max(0, i - 1))}
        onNext={() =>
          setQIdx((i) => Math.min(section.questions.length - 1, i + 1))
        }
        onSubmit={handleSectionEnd}
        onShowNav={() => setShowNav(true)}
        onShowFormula={() => setShowFormula(true)}
        onToggleElim={() => setElimMode((m) => !m)}
      />
      {showNav && (
        <NavigatorModal
          section={section}
          qIdx={qIdx}
          answers={answers}
          flagged={flagged}
          onJump={(i) => setQIdx(i)}
          onClose={() => setShowNav(false)}
        />
      )}
      {showFormula && section.hasFormula && (
        <FormulaSheet onClose={() => setShowFormula(false)} />
      )}
    </>
  )
}

// ── Intro ─────────────────────────────────────────────────────────────
function IntroScreen({
  testName,
  sections,
  onStart,
}: {
  testName: string
  sections: AdaptedSection[]
  onStart: () => void
}) {
  const totalMin = Math.round(
    sections.reduce((a, s) => a + s.duration, 0) / 60,
  )
  return (
    <div className="kt-center-screen">
      <div className="kt-logo-display">kairos</div>
      <div className="kt-center-card">
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          {testName || 'Practice Test'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--kt-fg-2)', marginBottom: 4 }}>
          Assigned by your tutor · {sections.length} section
          {sections.length === 1 ? '' : 's'} · ~{totalMin} minutes
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--kt-fg-3)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Work through each section within the time limit. You may flag
          questions to review, highlight passage text, and eliminate answer
          choices. Your answers are saved automatically.
        </div>
        <div className="kt-section-list">
          {sections.map((s, i) => (
            <div key={s.id} className="kt-section-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="kt-section-num">{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--kt-fg-3)' }}>
                    {s.moduleLabel}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--kt-fg-3)' }}>
                {s.questions.length}Q · {Math.round(s.duration / 60)}m
              </div>
            </div>
          ))}
        </div>
        <button
          className="kt-action-btn kt-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            marginTop: 24,
            fontSize: 15,
            padding: '12px 24px',
          }}
          onClick={onStart}
        >
          Begin Test <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Section start ─────────────────────────────────────────────────────
function SectionStartScreen({
  section,
  onBegin,
}: {
  section: AdaptedSection
  onBegin: () => void
}) {
  return (
    <div className="kt-center-screen">
      <div className="kt-logo-display">kairos</div>
      <div className="kt-center-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block', marginBottom: 16 }}>
          <span
            className="kt-badge"
            style={{ fontSize: 12, padding: '5px 14px' }}
          >
            {section.moduleLabel}
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {section.name}
        </div>
        <div style={{ fontSize: 14, color: 'var(--kt-fg-2)', marginBottom: 4 }}>
          {section.questions.length} questions &nbsp;·&nbsp;{' '}
          {Math.round(section.duration / 60)} minutes
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--kt-fg-3)',
            lineHeight: 1.65,
            marginTop: 12,
            marginBottom: 24,
          }}
        >
          {section.hasFormula
            ? 'A formula reference sheet is available during this section. Calculators ' +
              (section.hasCalculator ? 'are' : 'are NOT') +
              ' permitted.'
            : 'Read each passage carefully before answering the questions. You may go back to the passage at any time.'}
        </div>
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--kt-r-md)',
            background: 'var(--kt-purple-050)',
            fontSize: 13,
            color: 'var(--kt-purple-700)',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <strong>When you click Begin,</strong> the timer will start. Answer
          all questions before time runs out.
        </div>
        <button
          className="kt-action-btn kt-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '13px 24px',
            fontSize: 15,
          }}
          onClick={onBegin}
        >
          Begin Section <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Break between sections ────────────────────────────────────────────
function BreakScreen({
  completedSection,
  nextSection,
  answeredCount,
  totalCount,
  onNext,
}: {
  completedSection: AdaptedSection
  nextSection: AdaptedSection
  answeredCount: number
  totalCount: number
  onNext: () => void
}) {
  return (
    <div className="kt-center-screen">
      <div className="kt-logo-display">kairos</div>
      <div className="kt-center-card" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--kt-purple-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--kt-purple-500)',
          }}
        >
          <Check size={26} />
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 6 }}>
          {completedSection.name} complete
        </div>
        <div style={{ fontSize: 14, color: 'var(--kt-fg-2)', marginBottom: 20 }}>
          {answeredCount} of {totalCount} questions answered
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 'var(--kt-r-md)',
            background: 'var(--kt-bg-page)',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              color: 'var(--kt-fg-3)',
              marginBottom: 8,
            }}
          >
            Up next
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{nextSection.name}</div>
          <div style={{ fontSize: 13, color: 'var(--kt-fg-2)', marginTop: 2 }}>
            {nextSection.moduleLabel} · {nextSection.questions.length} questions
            · {Math.round(nextSection.duration / 60)} min
          </div>
        </div>
        <button
          className="kt-action-btn kt-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '13px 24px',
            fontSize: 15,
          }}
          onClick={onNext}
        >
          Next Section <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Done ──────────────────────────────────────────────────────────────
function DoneScreen({
  sections,
  answers,
  onReview,
  onRetake,
}: {
  sections: AdaptedSection[]
  answers: Record<string, Record<string, string>>
  onReview: (sid: string) => void
  onRetake: () => void
}) {
  const total = sections.reduce((a, s) => a + s.questions.length, 0)
  const correct = sections.reduce(
    (a, s) => a + countCorrect(s, answers[s.id] || {}),
    0,
  )
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  return (
    <div className="kt-center-screen" style={{ overflowY: 'auto' }}>
      <div className="kt-logo-display">kairos</div>
      <div className="kt-center-card" style={{ maxWidth: 580 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: 'var(--kt-purple-600)',
              lineHeight: 1,
            }}
          >
            {pct}%
          </div>
          <div style={{ fontSize: 16, color: 'var(--kt-fg-2)', marginTop: 4 }}>
            {correct} of {total} correct
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: 'var(--kt-border)',
              marginTop: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'var(--kt-gradient-accent)',
                borderRadius: 4,
                transition: 'width .8s var(--kt-ease-emph)',
              }}
            />
          </div>
        </div>
        <div className="kt-section-list">
          {sections.map((s) => {
            const c = countCorrect(s, answers[s.id] || {})
            const t = s.questions.length
            const p = t > 0 ? Math.round((c / t) * 100) : 0
            return (
              <div
                key={s.id}
                style={{
                  padding: '14px 16px',
                  background: 'var(--kt-bg-page)',
                  borderRadius: 'var(--kt-r-md)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--kt-fg-3)' }}>
                      {s.moduleLabel}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--kt-purple-600)',
                      }}
                    >
                      {c}/{t}
                    </div>
                    <button
                      className="kt-tool-btn"
                      style={{ fontSize: 11 }}
                      onClick={() => onReview(s.id)}
                    >
                      Review
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: 'var(--kt-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${p}%`,
                      background: 'var(--kt-purple-400)',
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <button
          className="kt-action-btn kt-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 20, padding: 11 }}
          onClick={onRetake}
        >
          Retake Test
        </button>
      </div>
    </div>
  )
}

// ── Review ────────────────────────────────────────────────────────────
function ReviewScreen({
  section,
  sectionAnswers,
  onBack,
}: {
  section: AdaptedSection
  sectionAnswers: Record<string, string>
  onBack: () => void
}) {
  const correct = countCorrect(section, sectionAnswers)
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--kt-bg-page)',
      }}
    >
      <div className="kt-header">
        <div className="kt-logo">kairos</div>
        <div className="kt-divider" />
        <div className="kt-section-name">Review — {section.name}</div>
        <div className="kt-badge">{section.moduleLabel}</div>
        <div className="kt-spacer" />
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--kt-purple-600)',
          }}
        >
          {correct}/{section.questions.length} correct
        </div>
        <button
          className="kt-action-btn kt-ghost"
          style={{ marginLeft: 8 }}
          onClick={onBack}
        >
          <ChevronLeft size={14} />
          Back to results
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 40px',
          maxWidth: 760,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {section.questions.map((q, i) => {
          const given = sectionAnswers[q.id]
          const isCorrect = answerMatches(given, q.correct_answer)
          const isSkipped = !given || given.trim() === ''
          const isFillIn = !q.answer_choices || q.answer_choices.length === 0
          return (
            <div
              key={q.id}
              style={{
                marginBottom: 20,
                background: 'white',
                borderRadius: 'var(--kt-r-lg)',
                padding: '20px 24px',
                boxShadow: 'var(--kt-shadow-1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  className="kt-status-icon"
                  style={{
                    background: isSkipped
                      ? 'var(--kt-surface-2)'
                      : isCorrect
                        ? '#E6F9F0'
                        : '#FDEDEC',
                    color: isSkipped
                      ? 'var(--kt-fg-3)'
                      : isCorrect
                        ? '#2FA46A'
                        : '#C9453B',
                    marginTop: 2,
                  }}
                >
                  {isSkipped ? '—' : isCorrect ? <Check size={13} /> : <X size={13} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: 'var(--kt-fg-3)',
                      marginBottom: 4,
                    }}
                  >
                    Question {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: 'var(--kt-fg-1)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {q.cleanStem}
                  </div>
                </div>
              </div>
              {isFillIn ? (
                <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--kt-r-sm)',
                      background: isSkipped
                        ? 'transparent'
                        : isCorrect
                          ? '#E6F9F0'
                          : '#FDEDEC',
                      border: `1.5px solid ${
                        isSkipped
                          ? 'var(--kt-border)'
                          : isCorrect
                            ? '#2FA46A'
                            : '#C9453B'
                      }`,
                      fontSize: 13,
                      color: isSkipped
                        ? 'var(--kt-fg-3)'
                        : isCorrect
                          ? '#1A7A50'
                          : '#9E3530',
                    }}
                  >
                    <span style={{ fontWeight: 700, minWidth: 78 }}>
                      Your answer
                    </span>
                    <span>{isSkipped ? '— (skipped)' : given}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--kt-r-sm)',
                      background: '#E6F9F0',
                      border: '1.5px solid #2FA46A',
                      fontSize: 13,
                      color: '#1A7A50',
                    }}
                  >
                    <span style={{ fontWeight: 700, minWidth: 78 }}>
                      Correct
                    </span>
                    <span>{q.correct_answer}</span>
                  </div>
                </div>
              ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  paddingLeft: 36,
                }}
              >
                {q.answer_choices.map((c) => {
                  const isG = given === c.label
                  const isC = q.correct_answer === c.label
                  let bg = 'transparent'
                  let border = 'var(--kt-border)'
                  let color: string = 'var(--kt-fg-2)'
                  if (isC) {
                    bg = '#E6F9F0'
                    border = '#2FA46A'
                    color = '#1A7A50'
                  } else if (isG && !isC) {
                    bg = '#FDEDEC'
                    border = '#C9453B'
                    color = '#9E3530'
                  }
                  return (
                    <div
                      key={c.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 'var(--kt-r-sm)',
                        background: bg,
                        border: `1.5px solid ${border}`,
                        fontSize: 13,
                        color,
                      }}
                    >
                      <span style={{ fontWeight: 700, minWidth: 20 }}>
                        {c.label}
                      </span>
                      <span>{c.text}</span>
                      {isC && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#2FA46A',
                          }}
                        >
                          ✓ Correct
                        </span>
                      )}
                      {isG && !isC && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#C9453B',
                          }}
                        >
                          Your answer
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              )}
              {q.explanation && (
                <div
                  style={{
                    marginTop: 10,
                    marginLeft: 36,
                    padding: '10px 14px',
                    borderRadius: 'var(--kt-r-sm)',
                    background: 'var(--kt-purple-050)',
                    fontSize: 13,
                    color: 'var(--kt-purple-700)',
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main test screen ──────────────────────────────────────────────────
function TestScreen({
  section,
  qIdx,
  answers,
  eliminated,
  flagged,
  passages,
  passageHtmls,
  timeLeft,
  elimMode,
  onAnswer,
  onEliminate,
  onFlag,
  onNav,
  onPassageHtml,
  onPrev,
  onNext,
  onSubmit,
  onShowNav,
  onShowFormula,
  onToggleElim,
}: {
  section: AdaptedSection
  qIdx: number
  answers: Record<string, Record<string, string>>
  eliminated: Record<string, Record<string, string[]>>
  flagged: Record<string, Set<string>>
  passages: Record<string, AdaptedPassage>
  passageHtmls: Record<string, string>
  timeLeft: number | null
  elimMode: boolean
  onAnswer: (letter: string) => void
  onEliminate: (letter: string) => void
  onFlag: (qid: string) => void
  onNav: (i: number) => void
  onPassageHtml: (key: string, html: string) => void
  onPrev: () => void
  onNext: () => void
  onSubmit: () => void
  onShowNav: () => void
  onShowFormula: () => void
  onToggleElim: () => void
}) {
  const question = section.questions[qIdx]
  const sAnswers = answers[section.id] || {}
  const sFlagged = flagged[section.id] || new Set<string>()
  const sElim = (eliminated[section.id] || {})[question.id] || []
  const isFlagged = sFlagged.has(question.id)
  const tc = timerKind(timeLeft)
  const isLast = qIdx === section.questions.length - 1

  const passageKey = question.passageKey
  const passage = passageKey ? passages[passageKey] : null
  const passageHtml =
    passageKey && passage
      ? passageHtmls[passageKey] || passage.body
      : null

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="kt-header">
        <div className="kt-logo">kairos</div>
        <div className="kt-divider" />
        <div className="kt-section-name">{section.name}</div>
        <div className="kt-badge">{section.moduleLabel}</div>
        <div className="kt-spacer" />
        <div className="kt-qcount">
          Question {qIdx + 1} of {section.questions.length}
        </div>
        <div className="kt-divider" />
        <div className={`kt-timer kt-timer-${tc}`}>
          <Clock size={14} />
          {fmtTime(timeLeft)}
        </div>
        <div className="kt-divider" />
        <button
          className={`kt-icon-btn ${isFlagged ? 'kt-flagged-on' : ''}`}
          onClick={() => onFlag(question.id)}
          title="Flag for review"
        >
          <Flag size={15} />
          {isFlagged ? 'Flagged' : 'Flag'}
        </button>
        <button
          className={`kt-icon-btn ${elimMode ? 'kt-active' : ''}`}
          onClick={onToggleElim}
          title="Elimination mode"
        >
          <X size={15} />
          {elimMode ? 'Elim On' : 'Eliminate'}
        </button>
        <button
          className="kt-icon-btn"
          onClick={onShowNav}
          title="Question navigator"
        >
          <LayoutGrid size={15} />
          Navigator
        </button>
        {section.hasFormula && (
          <button
            className="kt-icon-btn"
            onClick={onShowFormula}
            title="Formula sheet"
          >
            <FunctionSquare size={15} />
            Formulas
          </button>
        )}
        {section.hasCalculator && (
          <button
            className="kt-icon-btn"
            title="Calculator (use your own)"
            disabled
            style={{ opacity: 0.55, cursor: 'default' }}
          >
            <Calculator size={15} />
            Calc OK
          </button>
        )}
      </div>

      <div className="kt-body">
        {passage && passageHtml && passageKey ? (
          <>
            <PassagePanel
              key={passageKey}
              passageKey={passageKey}
              passageHtml={passageHtml}
              fallbackHtml={passage.body}
              figures={passage.figures}
              onHtmlChange={onPassageHtml}
            />
            <div className="kt-question-panel">
              <QuestionPanel
                question={question}
                sectionQIdx={qIdx}
                answer={sAnswers[question.id]}
                eliminated={sElim}
                elimMode={elimMode}
                onAnswer={onAnswer}
                onEliminate={onEliminate}
              />
            </div>
          </>
        ) : (
          <div className="kt-math-panel">
            <div style={{ width: '100%', maxWidth: 640 }}>
              <QuestionPanel
                question={question}
                sectionQIdx={qIdx}
                answer={sAnswers[question.id]}
                eliminated={sElim}
                elimMode={elimMode}
                onAnswer={onAnswer}
                onEliminate={onEliminate}
              />
            </div>
          </div>
        )}
      </div>

      <div className="kt-footer">
        <button
          className="kt-action-btn kt-ghost"
          onClick={onPrev}
          disabled={qIdx === 0}
          style={{ opacity: qIdx === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <div className="kt-footer-dots">
          {section.questions.map((q, i) => {
            const isAns = !!sAnswers[q.id]
            const isFlag = sFlagged.has(q.id)
            const isCur = i === qIdx
            let cls = 'kt-foot-dot '
            if (isCur) cls += 'kt-current'
            else if (isFlag && !isAns) cls += 'kt-flagged-dot'
            else if (isAns) cls += 'kt-answered'
            else cls += 'kt-empty'
            return (
              <div
                key={q.id}
                className={cls}
                onClick={() => onNav(i)}
                style={{ cursor: 'pointer' }}
              />
            )
          })}
        </div>
        {isLast ? (
          <button className="kt-action-btn kt-submit" onClick={onSubmit}>
            Submit Section
            <Check size={14} />
          </button>
        ) : (
          <button className="kt-action-btn kt-primary" onClick={onNext}>
            Next
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Passage panel with highlight ──────────────────────────────────────
function PassagePanel({
  passageKey,
  passageHtml,
  fallbackHtml,
  figures,
  onHtmlChange,
}: {
  passageKey: string
  passageHtml: string
  fallbackHtml: string
  figures: Figure[]
  onHtmlChange: (key: string, html: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setTooltip(null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setTooltip(null)
      return
    }
    const rect = range.getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }, [])

  const applyHighlight = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !containerRef.current) return
    const range = sel.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) return
    try {
      const mark = document.createElement('mark')
      mark.className = 'kt-hl'
      mark.appendChild(range.extractContents())
      range.insertNode(mark)
      onHtmlChange(passageKey, containerRef.current.innerHTML)
    } catch {
      // Browsers throw on cross-element ranges; just skip.
    }
    sel.removeAllRanges()
    setTooltip(null)
  }

  const clearHighlights = () => {
    onHtmlChange(passageKey, fallbackHtml)
    setTooltip(null)
  }

  useEffect(() => {
    const hide = () => setTooltip(null)
    document.addEventListener('mousedown', hide)
    return () => document.removeEventListener('mousedown', hide)
  }, [])

  return (
    <div className="kt-passage-panel">
      <div className="kt-passage-toolbar">
        <button
          className="kt-tool-btn"
          onMouseDown={(e) => {
            e.preventDefault()
            applyHighlight()
          }}
        >
          <Highlighter size={12} />
          Highlight selected
        </button>
        <button className="kt-tool-btn" onClick={clearHighlights}>
          <Eraser size={12} />
          Clear highlights
        </button>
      </div>
      <div
        ref={containerRef}
        className="kt-passage-text"
        onMouseUp={handleMouseUp}
        dangerouslySetInnerHTML={{ __html: passageHtml }}
      />
      {figures.length > 0 && (
        <div className="kt-passage-figures">
          {figures.map((fig, fi) =>
            fig.url ? (
              <figure key={fi} className="kt-figure">
                <img
                  src={fig.url}
                  alt={fig.caption || `Figure ${fi + 1}`}
                />
                {fig.caption && (
                  <figcaption>{fig.caption}</figcaption>
                )}
              </figure>
            ) : null,
          )}
        </div>
      )}
      {tooltip && (
        <div
          className="kt-hl-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%,-100%)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              applyHighlight()
            }}
          >
            Highlight
          </button>
          <span className="kt-hl-sep">|</span>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              clearHighlights()
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

// ── Question panel ────────────────────────────────────────────────────
function QuestionPanel({
  question,
  sectionQIdx,
  answer,
  eliminated,
  elimMode,
  onAnswer,
  onEliminate,
}: {
  question: AdaptedQuestion
  sectionQIdx: number
  answer: string | undefined
  eliminated: string[]
  elimMode: boolean
  onAnswer: (letter: string) => void
  onEliminate: (letter: string) => void
}) {
  const isFillIn = !question.answer_choices || question.answer_choices.length === 0
  return (
    <div style={{ maxWidth: 680 }}>
      <div className="kt-q-num-row">
        <div className="kt-q-num-badge">{sectionQIdx + 1}</div>
        {elimMode && !isFillIn && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 'var(--kt-r-pill)',
              background: '#FFF0EF',
              border: '1px solid #F5C2BD',
              fontSize: 11,
              fontWeight: 600,
              color: '#C9453B',
            }}
          >
            <X size={11} />
            Elimination mode — click to cross out
          </div>
        )}
      </div>
      <div className="kt-q-stem">{question.cleanStem}</div>
      {question.figures && question.figures.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {question.figures.map((fig, fi) =>
            fig.url ? (
              <figure
                key={fi}
                style={{
                  borderRadius: 'var(--kt-r-md)',
                  border: '1px solid var(--kt-border)',
                  background: 'white',
                  padding: 12,
                }}
              >
                <img
                  src={fig.url}
                  alt={fig.caption || `Figure ${fi + 1}`}
                  style={{
                    display: 'block',
                    margin: '0 auto',
                    maxWidth: '100%',
                    borderRadius: 8,
                  }}
                />
                {fig.caption && (
                  <figcaption
                    style={{
                      fontSize: 12,
                      color: 'var(--kt-fg-3)',
                      marginTop: 8,
                      textAlign: 'center',
                    }}
                  >
                    {fig.caption}
                  </figcaption>
                )}
              </figure>
            ) : null,
          )}
        </div>
      )}
      {isFillIn ? (
        <div className="kt-fillin">
          <label className="kt-fillin-label" htmlFor={`spr-${question.id}`}>
            Enter your answer
          </label>
          <input
            id={`spr-${question.id}`}
            className="kt-fillin-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 0.5  or  1/2"
            value={answer ?? ''}
            onChange={(e) => onAnswer(e.target.value)}
          />
          <div className="kt-fillin-hint">
            Decimals, fractions, and negative values are accepted.
          </div>
        </div>
      ) : (
        <div className="kt-choices">
          {question.answer_choices.map((c) => {
            const isSelected = answer === c.label
            const isElim = eliminated.includes(c.label)
            const cls = [
              'kt-choice-btn',
              isSelected ? 'kt-selected' : '',
              isElim ? 'kt-eliminated' : '',
              elimMode && !isSelected ? 'kt-elim-hover' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={c.label}
                className={cls}
                onClick={() => {
                  if (elimMode) onEliminate(c.label)
                  else onAnswer(c.label)
                }}
              >
                <span className="kt-choice-letter">
                  {isElim ? '✕' : c.label}
                </span>
                <span className="kt-choice-text">{c.text}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Navigator modal ───────────────────────────────────────────────────
function NavigatorModal({
  section,
  qIdx,
  answers,
  flagged,
  onJump,
  onClose,
}: {
  section: AdaptedSection
  qIdx: number
  answers: Record<string, Record<string, string>>
  flagged: Record<string, Set<string>>
  onJump: (i: number) => void
  onClose: () => void
}) {
  const sAnswers = answers[section.id] || {}
  const sFlagged = flagged[section.id] || new Set<string>()
  return (
    <div className="kt-overlay" onClick={onClose}>
      <div className="kt-nav-modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Question Overview
            </div>
            <div style={{ fontSize: 12, color: 'var(--kt-fg-3)', marginTop: 2 }}>
              {section.name} · {section.moduleLabel}
            </div>
          </div>
          <button className="kt-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="kt-nav-grid">
          {section.questions.map((q, i) => {
            const isAns = !!sAnswers[q.id]
            const isFlag = sFlagged.has(q.id)
            const isCur = i === qIdx
            const cls = ['kt-nav-cell', isAns ? 'kt-ans' : '', isCur ? 'kt-cur' : '']
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={q.id}
                className={cls}
                onClick={() => {
                  onJump(i)
                  onClose()
                }}
              >
                {i + 1}
                {isFlag && <span className="kt-flag-pip" />}
              </button>
            )
          })}
        </div>
        <div className="kt-nav-legend">
          <div className="kt-legend-item">
            <div
              className="kt-legend-swatch"
              style={{ background: 'var(--kt-purple-500)' }}
            />
            Answered
          </div>
          <div className="kt-legend-item">
            <div
              className="kt-legend-swatch"
              style={{ border: '1.5px solid var(--kt-border)' }}
            />
            Unanswered
          </div>
          <div className="kt-legend-item">
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 50,
                background: '#E4943B',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                ★
              </span>
            </div>
            Flagged
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--kt-border)',
            fontSize: 13,
            color: 'var(--kt-fg-2)',
          }}
        >
          <span style={{ color: 'var(--kt-purple-600)', fontWeight: 600 }}>
            {Object.keys(sAnswers).length}
          </span>{' '}
          of {section.questions.length} answered
        </div>
      </div>
    </div>
  )
}

// ── Formula sheet modal ───────────────────────────────────────────────
function FormulaSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="kt-overlay" onClick={onClose}>
      <div className="kt-formula-modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--kt-fg-1)' }}>
              Reference Sheet
            </div>
            <div style={{ fontSize: 12, color: 'var(--kt-fg-3)', marginTop: 2 }}>
              SAT Math — provided on test day
            </div>
          </div>
          <button className="kt-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="kt-formula-grid">
          <div className="kt-formula-card">
            <h6>Area Formulas</h6>
            <FormulaRow label="Triangle" expr="A = ½bh" />
            <FormulaRow label="Circle" expr="A = πr²" />
            <FormulaRow label="Rectangle" expr="A = lw" />
            <FormulaRow label="Trapezoid" expr="A = ½(b₁+b₂)h" />
          </div>
          <div className="kt-formula-card">
            <h6>Circumference / Arc</h6>
            <FormulaRow label="Circumference" expr="C = 2πr" />
            <FormulaRow label="Arc Length" expr="(θ/360°)·2πr" />
            <div className="kt-formula-note">
              There are 360° in a circle. There are 2π radians in a circle.
            </div>
          </div>
          <div className="kt-formula-card">
            <h6>Volume Formulas</h6>
            <FormulaRow label="Rectangular" expr="V = lwh" />
            <FormulaRow label="Cylinder" expr="V = πr²h" />
            <FormulaRow label="Sphere" expr="V = (4/3)πr³" />
            <FormulaRow label="Cone" expr="V = (1/3)πr²h" />
            <FormulaRow label="Pyramid" expr="V = (1/3)lwh" />
          </div>
          <div className="kt-formula-card">
            <h6>Key Theorems</h6>
            <FormulaRow label="Pythagorean" expr="a² + b² = c²" />
            <FormulaRow label="Triangle ∑∠" expr="180°" />
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.07em',
                  color: 'var(--kt-fg-3)',
                  marginBottom: 8,
                }}
              >
                Special Right Triangles
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '10px 12px',
                    flex: 1,
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 4,
                      fontSize: 11,
                      color: 'var(--kt-fg-3)',
                    }}
                  >
                    30-60-90
                  </div>
                  <div style={{ color: 'var(--kt-fg-1)' }}>x · x√3 · 2x</div>
                </div>
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '10px 12px',
                    flex: 1,
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 4,
                      fontSize: 11,
                      color: 'var(--kt-fg-3)',
                    }}
                  >
                    45-45-90
                  </div>
                  <div style={{ color: 'var(--kt-fg-1)' }}>x · x · x√2</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--kt-purple-050)',
            borderRadius: 'var(--kt-r-md)',
            fontSize: 13,
            color: 'var(--kt-fg-2)',
          }}
        >
          The number of degrees of arc in a circle is 360. The number of
          radians of arc in a circle is 2π. The sum of the measures in degrees
          of the angles of a triangle is 180.
        </div>
      </div>
    </div>
  )
}

function FormulaRow({ label, expr }: { label: string; expr: string }) {
  return (
    <div className="kt-formula-row">
      <span className="kt-formula-label">{label}</span>
      <span className="kt-formula-expr">{expr}</span>
    </div>
  )
}

// ── Scoped styles ─────────────────────────────────────────────────────
// All styles are scoped under .kt-app so they don't bleed into the rest
// of the kairos app. The variables are pulled from the design's
// colors_and_type.css verbatim — the test surface intentionally uses
// the design's palette ("kairos-purple-600 = #6C52E0") rather than
// kairos's existing brand purple ("#7A3AE8") so the prototype's
// pixel-perfect look is preserved.
function KtStyles() {
  return (
    <style>{`
.kt-app {
  --kt-purple-900: #2A1B6B;
  --kt-purple-800: #3A2A8F;
  --kt-purple-700: #4B38B3;
  --kt-purple-600: #6C52E0;
  --kt-purple-500: #7A62EA;
  --kt-purple-400: #9B86F0;
  --kt-purple-300: #BDB0F5;
  --kt-purple-200: #D9D0FA;
  --kt-purple-100: #ECE7FC;
  --kt-purple-050: #F6F3FE;
  --kt-gradient-accent: linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 45%, #C93FD8 100%);
  --kt-ink: #1C1B1F;
  --kt-graphite: #5A5862;
  --kt-mute: #8A8792;
  --kt-border: #E6E3E8;
  --kt-surface-2: #F1EFE9;
  --kt-bg-page: #F7F5F0;
  --kt-fg-1: var(--kt-ink);
  --kt-fg-2: var(--kt-graphite);
  --kt-fg-3: var(--kt-mute);
  --kt-danger: #C9453B;
  --kt-r-xs: 6px;
  --kt-r-sm: 10px;
  --kt-r-md: 14px;
  --kt-r-lg: 20px;
  --kt-r-xl: 28px;
  --kt-r-pill: 999px;
  --kt-shadow-1: 0 1px 2px rgba(28,27,31,.04), 0 2px 6px rgba(28,27,31,.05);
  --kt-shadow-2: 0 2px 4px rgba(28,27,31,.04), 0 8px 20px rgba(28,27,31,.07);
  --kt-shadow-3: 0 6px 14px rgba(28,27,31,.06), 0 20px 40px rgba(28,27,31,.10);
  --kt-ease-standard: cubic-bezier(.2,.0,.0,1);
  --kt-ease-emph: cubic-bezier(.2,.7,.1,1);

  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--kt-bg-page);
  color: var(--kt-fg-1);
  font-family: var(--font-sans), 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif;
  z-index: 50;
  overflow: hidden;
}
.kt-app, .kt-app *, .kt-app *::before, .kt-app *::after { box-sizing: border-box; }
.kt-app button { font-family: inherit; cursor: pointer; }

.kt-spin { animation: kt-spin 1s linear infinite; }
@keyframes kt-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

.kt-fullpage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
}
.kt-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: var(--kt-r-pill);
  background: var(--kt-purple-500);
  color: white;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

/* Header */
.kt-header {
  height: 56px;
  background: white;
  border-bottom: 1px solid var(--kt-border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
  z-index: 20;
  user-select: none;
}
.kt-logo {
  font-family: var(--font-display), 'Shrikhand', Georgia, serif;
  font-size: 22px;
  color: var(--kt-purple-600);
  line-height: 1;
}
.kt-divider { width: 1px; height: 20px; background: var(--kt-border); }
.kt-section-name { font-size: 14px; font-weight: 600; color: var(--kt-fg-1); }
.kt-badge {
  padding: 3px 10px;
  border-radius: var(--kt-r-pill);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  background: var(--kt-purple-100);
  color: var(--kt-purple-700);
}
.kt-spacer { flex: 1; }
.kt-qcount { font-size: 13px; color: var(--kt-fg-2); font-weight: 500; }
.kt-timer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--kt-r-pill);
  font-size: 15px;
  font-weight: 700;
  border: 1.5px solid;
  min-width: 88px;
  justify-content: center;
}
.kt-timer-ok { border-color: var(--kt-border); color: var(--kt-fg-1); }
.kt-timer-warn { border-color: #E4943B; color: #E4943B; background: #FFF8F0; }
.kt-timer-danger { border-color: var(--kt-danger); color: var(--kt-danger); background: #FFF0EF; animation: kt-pulse 1s ease-in-out infinite; }
@keyframes kt-pulse { 0%,100% { opacity: 1; } 50% { opacity: .6; } }

/* Header buttons */
.kt-icon-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: var(--kt-r-sm);
  border: none;
  background: transparent;
  color: var(--kt-fg-2);
  font-size: 12px;
  font-weight: 600;
  transition: all 120ms;
}
.kt-icon-btn:hover { background: var(--kt-surface-2); color: var(--kt-fg-1); }
.kt-icon-btn.kt-active { background: var(--kt-purple-100); color: var(--kt-purple-600); }
.kt-icon-btn.kt-flagged-on { color: #E4943B; background: #FFF5E6; }

/* Body layout */
.kt-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--kt-bg-page);
}
.kt-passage-panel {
  flex: 0 0 52%;
  overflow-y: auto;
  padding: 28px 40px 20px;
  border-bottom: 3px solid var(--kt-border);
  background: white;
  position: relative;
}
.kt-question-panel { flex: 1; overflow-y: auto; padding: 24px 40px 12px; }
.kt-math-panel { flex: 1; display: flex; justify-content: center; padding: 40px; overflow-y: auto; }

/* Passage */
.kt-passage-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.kt-tool-btn {
  padding: 5px 12px;
  border-radius: var(--kt-r-pill);
  border: 1.5px solid var(--kt-border);
  background: white;
  font-size: 11px;
  font-weight: 600;
  color: var(--kt-fg-2);
  transition: all 120ms;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.kt-tool-btn:hover { border-color: var(--kt-purple-300); color: var(--kt-fg-1); }
.kt-passage-citation {
  font-style: italic;
  font-size: 13px;
  color: var(--kt-fg-2);
  margin-bottom: 16px;
  line-height: 1.5;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--kt-border);
}
.kt-passage-text p { font-size: 15px; line-height: 1.8; color: var(--kt-fg-1); margin: 0 0 14px; }
.kt-passage-text p:last-child { margin-bottom: 0; }
.kt-passage-text mark.kt-hl { background: rgba(245,194,66,.42); border-radius: 2px; padding: 0 1px; }
.kt-line-ref {
  font-size: 10px;
  font-weight: 600;
  color: var(--kt-purple-600);
  margin: 0 1px;
  vertical-align: super;
}
.kt-passage-figures {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.kt-figure {
  border: 1px solid var(--kt-border);
  border-radius: var(--kt-r-md);
  background: white;
  padding: 12px;
}
.kt-figure img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  border-radius: 8px;
}
.kt-figure figcaption {
  font-size: 12px;
  color: var(--kt-fg-3);
  margin-top: 8px;
  text-align: center;
}

/* Question */
.kt-q-num-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.kt-q-num-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--kt-purple-500);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.kt-q-stem {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.7;
  color: var(--kt-fg-1);
  margin-bottom: 20px;
  white-space: pre-wrap;
}
.kt-choices { display: flex; flex-direction: column; gap: 8px; }
.kt-choice-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  background: white;
  border: 1.5px solid var(--kt-border);
  border-radius: var(--kt-r-md);
  transition: all 120ms var(--kt-ease-standard);
  font-size: 15px;
  color: var(--kt-fg-1);
  line-height: 1.5;
}
.kt-choice-btn:hover { border-color: var(--kt-purple-300); box-shadow: var(--kt-shadow-1); }
.kt-choice-btn.kt-selected { border-color: var(--kt-purple-500); background: var(--kt-purple-050); }
.kt-choice-btn.kt-eliminated { opacity: .42; }
.kt-choice-btn.kt-eliminated .kt-choice-text { text-decoration: line-through; }
.kt-choice-btn.kt-elim-hover:not(.kt-selected):hover { border-color: #C9453B; background: #FFF5F4; }
.kt-choice-letter {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kt-surface-2);
  color: var(--kt-fg-2);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 120ms;
}
.kt-selected .kt-choice-letter { background: var(--kt-purple-500); color: white; }
.kt-eliminated .kt-choice-letter { background: var(--kt-surface-2); color: var(--kt-fg-3); position: relative; }
.kt-choice-text { flex: 1; }

/* Fill-in-the-blank (SAT student-produced response) */
.kt-fillin {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}
.kt-fillin-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--kt-fg-3);
}
.kt-fillin-input {
  width: 100%;
  padding: 14px 18px;
  border: 1.5px solid var(--kt-border);
  border-radius: var(--kt-r-md);
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: var(--kt-fg-1);
  background: white;
  transition: all 120ms;
  outline: none;
}
.kt-fillin-input::placeholder { color: var(--kt-fg-3); font-weight: 500; }
.kt-fillin-input:focus { border-color: var(--kt-purple-500); box-shadow: 0 0 0 4px rgba(122,98,234,.18); }
.kt-fillin-hint { font-size: 12px; color: var(--kt-fg-3); }

/* Footer */
.kt-footer {
  height: 64px;
  background: white;
  border-top: 1px solid var(--kt-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  gap: 16px;
}
.kt-footer-dots {
  display: flex;
  gap: 4px;
  align-items: center;
  overflow: hidden;
  max-width: 360px;
}
.kt-foot-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--kt-border);
}
.kt-foot-dot.kt-current { background: var(--kt-purple-600); transform: scale(1.35); }
.kt-foot-dot.kt-answered { background: var(--kt-purple-300); }
.kt-foot-dot.kt-flagged-dot { background: #E4943B; }
.kt-foot-dot.kt-empty { background: var(--kt-border); }

.kt-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border-radius: var(--kt-r-pill);
  border: none;
  font-size: 14px;
  font-weight: 700;
  transition: all 120ms;
}
.kt-action-btn.kt-primary { background: var(--kt-purple-500); color: white; }
.kt-action-btn.kt-primary:hover { background: var(--kt-purple-600); }
.kt-action-btn.kt-ghost { background: transparent; color: var(--kt-fg-2); border: 1.5px solid var(--kt-border); }
.kt-action-btn.kt-ghost:hover { background: var(--kt-surface-2); }
.kt-action-btn.kt-submit { background: var(--kt-gradient-accent); color: white; }
.kt-action-btn.kt-submit:hover { opacity: .9; }
.kt-action-btn:disabled { cursor: default; }

/* Modals */
.kt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(28,27,31,.4);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kt-nav-modal, .kt-formula-modal {
  background: white;
  border-radius: var(--kt-r-xl);
  box-shadow: var(--kt-shadow-3);
  max-height: 86vh;
  overflow-y: auto;
}
.kt-nav-modal { padding: 28px; width: 500px; max-width: 94vw; }
.kt-formula-modal { padding: 32px; width: 660px; max-width: 95vw; }

.kt-nav-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-top: 16px;
}
.kt-nav-cell {
  aspect-ratio: 1;
  border-radius: var(--kt-r-sm);
  border: 1.5px solid var(--kt-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 120ms;
  position: relative;
  color: var(--kt-fg-2);
  background: white;
}
.kt-nav-cell:hover { border-color: var(--kt-purple-300); }
.kt-nav-cell.kt-ans { background: var(--kt-purple-500); color: white; border-color: var(--kt-purple-500); }
.kt-nav-cell.kt-cur { outline: 2.5px solid var(--kt-ink); outline-offset: 2px; }
.kt-flag-pip {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #E4943B;
}
.kt-nav-legend { display: flex; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
.kt-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--kt-fg-2); }
.kt-legend-swatch { width: 14px; height: 14px; border-radius: 4px; }

/* Formula */
.kt-formula-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
.kt-formula-card { background: var(--kt-bg-page); border-radius: var(--kt-r-md); padding: 16px; }
.kt-formula-card h6 {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--kt-fg-3);
  margin: 0 0 10px;
}
.kt-formula-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; font-size: 14px; }
.kt-formula-label { color: var(--kt-fg-2); font-size: 12px; min-width: 80px; }
.kt-formula-expr { font-weight: 600; color: var(--kt-fg-1); font-size: 14px; }
.kt-formula-note { font-size: 11px; color: var(--kt-fg-3); margin-top: 4px; }

/* Highlight tooltip */
.kt-hl-tooltip {
  position: fixed;
  z-index: 300;
  background: var(--kt-ink);
  color: white;
  border-radius: var(--kt-r-sm);
  padding: 7px 13px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: var(--kt-shadow-2);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: all;
}
.kt-hl-tooltip button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  padding: 2px 0;
  opacity: .9;
}
.kt-hl-tooltip button:hover { opacity: 1; }
.kt-hl-sep { opacity: .3; }

/* Transition / center screens */
.kt-center-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--kt-bg-page);
  padding: 40px;
  gap: 20px;
  overflow-y: auto;
}
.kt-logo-display {
  font-family: var(--font-display), 'Shrikhand', Georgia, serif;
  font-size: 28px;
  color: var(--kt-purple-600);
}
.kt-center-card {
  background: white;
  border-radius: var(--kt-r-xl);
  box-shadow: var(--kt-shadow-2);
  padding: 44px 52px;
  max-width: 540px;
  width: 100%;
}
.kt-section-list {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kt-section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--kt-r-md);
  background: var(--kt-bg-page);
  font-size: 14px;
}
.kt-section-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--kt-purple-100);
  color: var(--kt-purple-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}
.kt-status-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}

/* Scrollbars */
.kt-app ::-webkit-scrollbar { width: 5px; }
.kt-app ::-webkit-scrollbar-track { background: transparent; }
.kt-app ::-webkit-scrollbar-thumb { background: var(--kt-purple-200); border-radius: 10px; }
`}</style>
  )
}
