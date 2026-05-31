'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  Save,
  Tag,
  Pencil,
  Check,
  X,
  Search,
  Filter as FilterIcon,
} from 'lucide-react'
import { HtmlEditor } from '@/components/admin/HtmlEditor'
import { DataTableEditor, emptyDataTable, type DataTable } from '@/components/admin/DataTableEditor'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

interface AnswerChoice {
  label: string
  text: string
}
interface QuestionFigure {
  url: string
  caption: string
}
interface Question {
  id: string
  exam_type: 'SAT' | 'ACT'
  subject: string
  question_type: string
  topic: string | null
  difficulty: string
  question_text: string
  answer_choices: AnswerChoice[]
  correct_answer: string
  explanation: string
  tags: string[]
  time_estimate: number | null
  figures: QuestionFigure[]
  data_table: DataTable | null
  passage_group: string | null
  question_number: number | null
}

interface Categories {
  exam_types: string[]
  subjects: Record<string, string[]>
  question_types: Record<string, string[]>
  topics: Record<string, string[]>
  difficulties: string[]
}

const PAGE_SIZE = 50

export default function AdminQuestionsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.email === ADMIN_EMAIL

  const [categories, setCategories] = useState<Categories | null>(null)
  const [examType, setExamType] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [questionType, setQuestionType] = useState<string>('')
  const [topic, setTopic] = useState<string>('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [selected, setSelected] = useState<Question | null>(null)
  const [draft, setDraft] = useState<Question | null>(null)
  const [saving, setSaving] = useState(false)
  const [renamingField, setRenamingField] =
    useState<null | { field: 'difficulty' | 'question_type' | 'topic'; from: string }>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session || !isAdmin) {
      router.push('/home')
      return
    }
    refreshCategories()
  }, [session, sessionStatus, isAdmin, router])

  async function refreshCategories() {
    const res = await fetch('/api/admin/questions/categories')
    if (!res.ok) return
    const data = await res.json()
    setCategories(data)
  }

  const subjectsForExam = useMemo(() => {
    if (!categories || !examType) return []
    return categories.subjects[examType] ?? []
  }, [categories, examType])

  const typesForExamSubject = useMemo(() => {
    if (!categories || !examType || !subject) return []
    return categories.question_types[`${examType}|${subject}`] ?? []
  }, [categories, examType, subject])

  const topicsForExamSubjectType = useMemo(() => {
    if (!categories || !examType || !subject || !questionType) return []
    return categories.topics[`${examType}|${subject}|${questionType}`] ?? []
  }, [categories, examType, subject, questionType])

  // Reset cascading filters when a parent changes.
  useEffect(() => {
    setSubject('')
    setQuestionType('')
    setTopic('')
    setOffset(0)
  }, [examType])
  useEffect(() => {
    setQuestionType('')
    setTopic('')
    setOffset(0)
  }, [subject])
  useEffect(() => {
    setTopic('')
    setOffset(0)
  }, [questionType])

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setOffset(0)
    }, 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!isAdmin) return
    fetchQuestions()
  }, [isAdmin, examType, subject, questionType, topic, difficulty, search, offset])

  async function fetchQuestions() {
    setLoading(true)
    const params = new URLSearchParams()
    if (examType) params.set('exam_type', examType)
    if (subject) params.set('subject', subject)
    if (questionType) params.set('question_type', questionType)
    if (topic) params.set('topic', topic)
    if (difficulty) params.set('difficulty', difficulty)
    if (search) params.set('q', search)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))
    const res = await fetch(`/api/admin/questions?${params}`)
    if (res.ok) {
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setTotal(data.total ?? 0)
    }
    setLoading(false)
  }

  function openQuestion(q: Question) {
    setSelected(q)
    setDraft({ ...q, answer_choices: [...(q.answer_choices ?? [])], tags: [...(q.tags ?? [])] })
  }

  function closeQuestion() {
    setSelected(null)
    setDraft(null)
  }

  async function saveDraft() {
    if (!draft || !selected) return
    setSaving(true)
    const body: Record<string, unknown> = {
      subject: draft.subject,
      question_type: draft.question_type,
      topic: draft.topic && draft.topic.trim() ? draft.topic.trim() : null,
      difficulty: draft.difficulty,
      question_text: draft.question_text,
      answer_choices: draft.answer_choices,
      correct_answer: draft.correct_answer,
      explanation: draft.explanation,
      tags: draft.tags,
      time_estimate: draft.time_estimate,
      data_table: draft.data_table,
    }
    const res = await fetch(`/api/admin/questions/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      const updated = data.question as Question
      setSelected(updated)
      setDraft({ ...updated, answer_choices: [...(updated.answer_choices ?? [])] })
      setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
      refreshCategories()
    }
  }

  async function performRename(to: string) {
    if (!renamingField || !to.trim() || to === renamingField.from) {
      setRenamingField(null)
      return
    }
    const body: Record<string, unknown> = {
      field: renamingField.field,
      from: renamingField.from,
      to: to.trim(),
    }
    if (renamingField.field === 'question_type') {
      if (examType) body.exam_type = examType
      if (subject) body.subject = subject
    }
    if (renamingField.field === 'topic') {
      if (examType) body.exam_type = examType
      if (subject) body.subject = subject
      if (questionType) body.question_type = questionType
    }
    const res = await fetch('/api/admin/questions/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setRenamingField(null)
    if (res.ok) {
      await refreshCategories()
      // If we were filtering by the old value, swap it.
      if (renamingField.field === 'difficulty' && difficulty === renamingField.from) {
        setDifficulty(to.trim())
      }
      if (renamingField.field === 'question_type' && questionType === renamingField.from) {
        setQuestionType(to.trim())
      }
      if (renamingField.field === 'topic' && topic === renamingField.from) {
        setTopic(to.trim())
      }
      fetchQuestions()
    }
  }

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (selected && draft) {
    return (
      <QuestionDetail
        original={selected}
        draft={draft}
        setDraft={setDraft}
        saving={saving}
        onSave={saveDraft}
        onClose={closeQuestion}
        difficulties={categories?.difficulties ?? []}
        questionTypes={
          (categories?.question_types[`${draft.exam_type}|${draft.subject}`] ?? [])
        }
        topics={
          (categories?.topics[
            `${draft.exam_type}|${draft.subject}|${draft.question_type}`
          ] ?? [])
        }
        onRename={(field, from) => setRenamingField({ field, from })}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Admin dashboard
            </button>
            <h1 className="text-2xl font-semibold text-foreground">Question bank editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total.toLocaleString()} {total === 1 ? 'question' : 'questions'} matching filters
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FilterIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <SelectField
              label="Exam"
              value={examType}
              onChange={setExamType}
              options={categories?.exam_types ?? []}
            />
            <SelectField
              label="Subject"
              value={subject}
              onChange={setSubject}
              options={subjectsForExam}
              disabled={!examType}
            />
            <SelectField
              label="Category"
              value={questionType}
              onChange={setQuestionType}
              options={typesForExamSubject}
              disabled={!subject}
              onRename={
                questionType
                  ? () => setRenamingField({ field: 'question_type', from: questionType })
                  : undefined
              }
            />
            <SelectField
              label="Subcategory"
              value={topic}
              onChange={setTopic}
              options={topicsForExamSubjectType}
              disabled={!questionType}
              extraOptions={
                questionType ? [{ value: '__none__', label: '(unassigned)' }] : undefined
              }
              onRename={
                topic && topic !== '__none__'
                  ? () => setRenamingField({ field: 'topic', from: topic })
                  : undefined
              }
            />
            <SelectField
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={categories?.difficulties ?? []}
              onRename={
                difficulty ? () => setRenamingField({ field: 'difficulty', from: difficulty }) : undefined
              }
            />
            <div className="relative">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Search
              </label>
              <Search className="absolute left-2 top-7 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Question text…"
                className="w-full h-8 pl-7 pr-2 text-xs rounded-md border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">No questions match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <QuestionRow key={q.id} question={q} onClick={() => openQuestion(q)} />
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {renamingField && (
        <RenameModal
          field={renamingField.field}
          from={renamingField.from}
          scope={
            renamingField.field === 'question_type'
              ? { exam_type: examType || undefined, subject: subject || undefined }
              : renamingField.field === 'topic'
                ? {
                    exam_type: examType || undefined,
                    subject: subject || undefined,
                    question_type: questionType || undefined,
                  }
                : undefined
          }
          onCancel={() => setRenamingField(null)}
          onConfirm={performRename}
        />
      )}
    </main>
  )
}

function QuestionRow({ question, onClick }: { question: Question; onClick: () => void }) {
  const preview = stripHtml(question.question_text).slice(0, 160)
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card border border-border p-4 hover:border-purple-500/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Badge color="purple">{question.exam_type}</Badge>
        <Badge color="gray">{question.subject}</Badge>
        <Badge color="gray">{question.question_type}</Badge>
        {question.topic && <Badge color="indigo">{question.topic}</Badge>}
        <Badge color={difficultyColor(question.difficulty)}>{question.difficulty}</Badge>
        {question.data_table && <Badge color="emerald">table</Badge>}
        {(question.figures ?? []).length > 0 && (
          <Badge color="amber">{question.figures.length} figure{question.figures.length === 1 ? '' : 's'}</Badge>
        )}
      </div>
      <p className="text-sm text-foreground line-clamp-2">{preview || <em className="text-muted-foreground">(empty)</em>}</p>
    </button>
  )
}

function QuestionDetail({
  original,
  draft,
  setDraft,
  saving,
  onSave,
  onClose,
  difficulties,
  questionTypes,
  topics,
  onRename,
}: {
  original: Question
  draft: Question
  setDraft: (q: Question | ((prev: Question | null) => Question | null)) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
  difficulties: string[]
  questionTypes: string[]
  topics: string[]
  onRename: (field: 'difficulty' | 'question_type' | 'topic', from: string) => void
}) {
  const dirty = useMemo(() => JSON.stringify(original) !== JSON.stringify(draft), [original, draft])

  function update<K extends keyof Question>(key: K, value: Question[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }
  function updateChoice(i: number, patch: Partial<AnswerChoice>) {
    setDraft((prev) => {
      if (!prev) return prev
      const choices = prev.answer_choices.map((c, ci) => (ci === i ? { ...c, ...patch } : c))
      return { ...prev, answer_choices: choices }
    })
  }
  function addChoice() {
    setDraft((prev) => {
      if (!prev) return prev
      const nextLabel = String.fromCharCode(65 + prev.answer_choices.length)
      return {
        ...prev,
        answer_choices: [...prev.answer_choices, { label: nextLabel, text: '' }],
      }
    })
  }
  function removeChoice(i: number) {
    setDraft((prev) => {
      if (!prev) return prev
      return { ...prev, answer_choices: prev.answer_choices.filter((_, ci) => ci !== i) }
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to list
          </button>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save changes
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge color="purple">{draft.exam_type}</Badge>
          <span>·</span>
          <span>{draft.subject}</span>
          {draft.question_number != null && (
            <>
              <span>·</span>
              <span>Q#{draft.question_number}</span>
            </>
          )}
          <span>·</span>
          <span className="font-mono text-[10px]">{original.id.slice(0, 8)}</span>
        </div>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Categorization
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CategoryField
              label="Subject"
              value={draft.subject}
              onChange={(v) => update('subject', v)}
            />
            <CategoryField
              label="Category"
              value={draft.question_type}
              options={questionTypes}
              onChange={(v) => update('question_type', v)}
              onRename={
                draft.question_type
                  ? () => onRename('question_type', draft.question_type)
                  : undefined
              }
            />
            <CategoryField
              label="Subcategory"
              value={draft.topic ?? ''}
              options={topics}
              onChange={(v) => update('topic', v ? v : null)}
              onRename={
                draft.topic ? () => onRename('topic', draft.topic as string) : undefined
              }
            />
            <CategoryField
              label="Difficulty"
              value={draft.difficulty}
              options={difficulties}
              onChange={(v) => update('difficulty', v)}
              onRename={
                draft.difficulty ? () => onRename('difficulty', draft.difficulty) : undefined
              }
            />
          </div>
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Question text
          </h2>
          <HtmlEditor
            value={draft.question_text}
            onChange={(html) => update('question_text', html)}
            placeholder="Question text…"
          />
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Data table
          </h2>
          <DataTableEditor
            value={draft.data_table}
            onChange={(t) => update('data_table', t)}
          />
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Answer choices
            </h2>
            <button
              type="button"
              onClick={addChoice}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              + Add choice
            </button>
          </div>
          <div className="space-y-2">
            {draft.answer_choices.map((c, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border p-2 ${
                  draft.correct_answer === c.label
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-border bg-background'
                }`}
              >
                <input
                  type="radio"
                  name="correct"
                  checked={draft.correct_answer === c.label}
                  onChange={() => update('correct_answer', c.label)}
                  className="mt-1.5 accent-green-600"
                  title="Mark as correct"
                />
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateChoice(i, { label: e.target.value })}
                  className="w-12 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <input
                  type="text"
                  value={c.text}
                  onChange={(e) => updateChoice(i, { text: e.target.value })}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  type="button"
                  onClick={() => removeChoice(i)}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-red-600"
                  title="Remove choice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {draft.answer_choices.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No choices yet.</p>
            )}
          </div>
          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Correct answer (free form, overrides selection)
            </label>
            <input
              type="text"
              value={draft.correct_answer}
              onChange={(e) => update('correct_answer', e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Explanation
          </h2>
          <HtmlEditor
            value={draft.explanation}
            onChange={(html) => update('explanation', html)}
            minHeight={140}
            placeholder="Explanation…"
          />
        </section>

        <section className="rounded-2xl bg-card border border-border p-5 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Tags & metadata
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Tags (comma-separated)
              </label>
              <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  value={(draft.tags ?? []).join(', ')}
                  onChange={(e) =>
                    update(
                      'tags',
                      e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                    )
                  }
                  className="flex-1 bg-transparent text-xs outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Time estimate (seconds)
              </label>
              <input
                type="number"
                value={draft.time_estimate ?? ''}
                onChange={(e) =>
                  update('time_estimate', e.target.value ? parseInt(e.target.value, 10) : null)
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>
        </section>

        {(draft.figures ?? []).length > 0 && (
          <section className="rounded-2xl bg-card border border-border p-5 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Figures
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {draft.figures.map((f, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.caption}
                    className="max-h-48 w-full rounded object-contain bg-secondary/30"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground truncate">{f.caption}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function CategoryField({
  label,
  value,
  onChange,
  options,
  onRename,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options?: string[]
  onRename?: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {onRename && (
          <button
            type="button"
            onClick={onRename}
            className="inline-flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700"
            title={`Rename "${value}" everywhere`}
          >
            <Pencil className="w-2.5 h-2.5" /> Rename
          </button>
        )}
      </div>
      <input
        type="text"
        list={options ? `${label}-options` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-500/30"
      />
      {options && (
        <datalist id={`${label}-options`}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  onRename,
  extraOptions,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  disabled?: boolean
  onRename?: () => void
  extraOptions?: { value: string; label: string }[]
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {onRename && (
          <button
            type="button"
            onClick={onRename}
            className="inline-flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700"
            title={`Rename "${value}"`}
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-purple-500/30 disabled:opacity-40"
      >
        <option value="">All</option>
        {extraOptions?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function RenameModal({
  field,
  from,
  scope,
  onCancel,
  onConfirm,
}: {
  field: 'difficulty' | 'question_type' | 'topic'
  from: string
  scope?: { exam_type?: string; subject?: string; question_type?: string }
  onCancel: () => void
  onConfirm: (to: string) => void
}) {
  const [to, setTo] = useState(from)
  const scopeText = scope
    ? [scope.exam_type, scope.subject, scope.question_type].filter(Boolean).join(' / ') ||
      'all questions'
    : 'all questions'
  const fieldLabel =
    field === 'question_type' ? 'category' : field === 'topic' ? 'subcategory' : 'difficulty'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Rename {fieldLabel}</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Every question in <span className="font-medium">{scopeText}</span> with{' '}
          <code className="rounded bg-secondary px-1">{from}</code> will be updated to the new label.
        </p>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/30 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(to)}
            disabled={!to.trim() || to.trim() === from}
            className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Rename
          </button>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const styles: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    gray: 'bg-secondary text-muted-foreground border-border',
    green: 'bg-green-500/10 text-green-600 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        styles[color] ?? styles.gray
      }`}
    >
      {children}
    </span>
  )
}

function difficultyColor(d: string): string {
  const normalized = d.toLowerCase()
  if (normalized.includes('easy') || normalized.includes('foundation')) return 'green'
  if (normalized.includes('hard') || normalized.includes('advanced')) return 'red'
  if (normalized.includes('medium') || normalized.includes('intermediate')) return 'amber'
  return 'gray'
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
