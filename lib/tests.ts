import { getSupabase } from './supabase'
import type { Question, QuestionFilters } from './questions'

// A section is a named, independently-filtered slice of a test. Tests built
// before sections existed have a flat filters object; new tests store
// `{ sections: [...] }` so the viewer can group questions under headers.
export interface TestSectionFilters {
  label: string
  subject?: string
  question_type?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  limit?: number
}

export interface TestFilters extends QuestionFilters {
  sections?: TestSectionFilters[]
}

export interface Test {
  id: string
  tutor_id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  filters: TestFilters
  question_count: number
  created_at: string
}

export interface Passage {
  id: string
  exam_type: string
  subject: string
  title: string | null
  passage_number: number | null
  kind: 'single' | 'paired-A' | 'paired-B'
  body: string
  figures: { url?: string; caption: string }[]
}

export interface TestWithQuestions extends Test {
  questions: Question[]
  passages: Passage[]
  // Parallel array — section_index per question (matches `questions` order).
  // 0 for legacy tests without section data.
  section_indices: number[]
}

export interface GeneratedSection {
  label: string
  questions: Question[]
}

/**
 * Generate a randomized set of questions based on filters.
 * Does NOT save — just returns the question pool for preview.
 *
 * Questions sharing a passage_group are included atomically: a group is
 * either fully selected or skipped. Within a group, original insertion
 * order is preserved (siblings appear consecutively, in source order).
 */
export async function generateTestQuestions(
  filters: QuestionFilters
): Promise<Question[]> {
  const supabase = getSupabase()
  let query = supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: true })

  if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
  if (filters.subject) query = query.eq('subject', filters.subject)
  if (filters.question_type) query = query.eq('question_type', filters.question_type)
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
  if (filters.tags && filters.tags.length > 0) query = query.overlaps('tags', filters.tags)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch questions: ${error.message}`)

  const all = data as (Question & { passage_ids?: string[] | null })[]

  // Partition into groups by passage_ids — questions sharing any passage_id
  // are bundled atomically. Standalone questions (no passage_ids) get a
  // unique key so each is its own one-item group.
  const groups = new Map<string, typeof all>()
  for (const q of all) {
    const ids = q.passage_ids ?? []
    const key = ids.length > 0 ? `passage:${ids.slice().sort().join('+')}` : `_solo:${q.id}`
    const arr = groups.get(key) ?? []
    arr.push(q)
    groups.set(key, arr)
  }

  // Fisher-Yates shuffle the GROUP keys.
  const keys = [...groups.keys()]
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
  }

  const limit = filters.limit ?? 20
  const out: Question[] = []
  for (const k of keys) {
    const g = groups.get(k)!
    // Skip a group if including it would overflow the limit.
    // For limits smaller than a passage group, this means the group is dropped
    // entirely; the user should raise the limit if they want full passages.
    if (out.length + g.length > limit) continue
    out.push(...g)
    if (out.length >= limit) break
  }

  return out
}

/**
 * Generate one preview per section. Each section is drawn independently, so
 * a Math + Reading test can compose two filtered pools without one starving
 * the other. Section order in input is preserved.
 */
export async function generateTestSections(
  examType: 'SAT' | 'ACT',
  sections: TestSectionFilters[],
): Promise<GeneratedSection[]> {
  const out: GeneratedSection[] = []
  for (const s of sections) {
    const filters: QuestionFilters = { exam_type: examType, limit: s.limit ?? 20 }
    if (s.subject) filters.subject = s.subject
    if (s.question_type) filters.question_type = s.question_type
    if (s.difficulty) filters.difficulty = s.difficulty
    const questions = await generateTestQuestions(filters)
    out.push({ label: s.label, questions })
  }
  return out
}

/**
 * Save a section-composed test. Each section is persisted in `tests.filters.sections`
 * and each test_question row is tagged with its section_index so the viewer can
 * render section headers.
 */
export async function saveSectionedTest(
  tutorId: string,
  name: string,
  examType: 'SAT' | 'ACT',
  sections: (TestSectionFilters & { question_ids: string[] })[],
): Promise<Test> {
  const supabase = getSupabase()

  const totalCount = sections.reduce((acc, s) => acc + s.question_ids.length, 0)

  const filters: TestFilters = {
    exam_type: examType,
    sections: sections.map(({ question_ids: _ids, ...rest }) => rest),
  }

  const { data: test, error: testErr } = await supabase
    .from('tests')
    .insert({
      tutor_id: tutorId,
      name,
      exam_type: examType,
      filters,
      question_count: totalCount,
    })
    .select()
    .single()

  if (testErr) throw new Error(`Failed to create test: ${testErr.message}`)

  const rows: { test_id: string; question_id: string; order_index: number; section_index: number }[] = []
  let order = 0
  sections.forEach((s, sectionIdx) => {
    for (const qid of s.question_ids) {
      rows.push({
        test_id: test.id,
        question_id: qid,
        order_index: order++,
        section_index: sectionIdx,
      })
    }
  })

  const { error: qErr } = await supabase.from('test_questions').insert(rows)

  if (qErr) throw new Error(`Failed to save test questions: ${qErr.message}`)

  return test as Test
}

/**
 * List all tests for a tutor.
 */
export async function listTests(tutorId: string): Promise<Test[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list tests: ${error.message}`)
  return data as Test[]
}

/**
 * Get a test with all its questions in order.
 */
export async function getTestWithQuestions(testId: string): Promise<TestWithQuestions> {
  const supabase = getSupabase()

  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (testErr) throw new Error(`Test not found: ${testErr.message}`)

  const { data: tqs, error: tqErr } = await supabase
    .from('test_questions')
    .select('question_id, order_index, section_index')
    .eq('test_id', testId)
    .order('order_index')

  if (tqErr) throw new Error(`Failed to load test questions: ${tqErr.message}`)

  const tqRows = tqs as {
    question_id: string
    order_index: number
    section_index: number | null
  }[]
  const qIds = tqRows.map((r) => r.question_id)

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .in('id', qIds)

  if (qErr) throw new Error(`Failed to load questions: ${qErr.message}`)

  // Restore order
  const qMap = new Map((questions as Question[]).map((q) => [q.id, q]))
  const ordered = qIds.map((id) => qMap.get(id)!).filter(Boolean)
  const sectionIndices = tqRows.map((r) => r.section_index ?? 0)

  // Fetch every passage referenced by any of the test's questions so the
  // renderer can look up shared passage text by id.
  const passageIds = new Set<string>()
  for (const q of ordered as (Question & { passage_ids?: string[] | null })[]) {
    for (const pid of q.passage_ids ?? []) passageIds.add(pid)
  }

  let passages: Passage[] = []
  if (passageIds.size > 0) {
    const { data: rows, error: pErr } = await supabase
      .from('passages')
      .select('id, exam_type, subject, title, passage_number, kind, body, figures')
      .in('id', [...passageIds])
    if (pErr) throw new Error(`Failed to load passages: ${pErr.message}`)
    passages = (rows ?? []) as Passage[]
  }

  return { ...(test as Test), questions: ordered, passages, section_indices: sectionIndices }
}

/**
 * Delete a test and its questions (cascade).
 */
export async function deleteTest(testId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('tests').delete().eq('id', testId)
  if (error) throw new Error(`Failed to delete test: ${error.message}`)
}

/**
 * Count available questions matching filters (for UI preview).
 */
export async function countQuestions(filters: QuestionFilters): Promise<number> {
  const supabase = getSupabase()
  let query = supabase.from('questions').select('id', { count: 'exact', head: true })

  if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
  if (filters.subject) query = query.eq('subject', filters.subject)
  if (filters.question_type) query = query.eq('question_type', filters.question_type)
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)

  const { count, error } = await query
  if (error) throw new Error(`Failed to count questions: ${error.message}`)
  return count ?? 0
}
