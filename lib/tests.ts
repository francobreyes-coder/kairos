import { getSupabase } from './supabase'
import type { Question, QuestionFilters } from './questions'

export interface Test {
  id: string
  tutor_id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  filters: QuestionFilters
  question_count: number
  created_at: string
}

export interface TestWithQuestions extends Test {
  questions: Question[]
}

/**
 * Generate a randomized set of questions based on filters.
 * Does NOT save — just returns the question pool for preview.
 */
export async function generateTestQuestions(
  filters: QuestionFilters
): Promise<Question[]> {
  const supabase = getSupabase()
  let query = supabase.from('questions').select('*')

  if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
  if (filters.subject) query = query.eq('subject', filters.subject)
  if (filters.question_type) query = query.eq('question_type', filters.question_type)
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
  if (filters.tags && filters.tags.length > 0) query = query.overlaps('tags', filters.tags)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch questions: ${error.message}`)

  const all = data as Question[]

  // Fisher-Yates shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }

  const limit = filters.limit ?? 20
  return all.slice(0, limit)
}

/**
 * Save a test with its selected questions.
 */
export async function saveTest(
  tutorId: string,
  name: string,
  examType: 'SAT' | 'ACT',
  filters: QuestionFilters,
  questionIds: string[]
): Promise<Test> {
  const supabase = getSupabase()

  const { data: test, error: testErr } = await supabase
    .from('tests')
    .insert({
      tutor_id: tutorId,
      name,
      exam_type: examType,
      filters,
      question_count: questionIds.length,
    })
    .select()
    .single()

  if (testErr) throw new Error(`Failed to create test: ${testErr.message}`)

  const rows = questionIds.map((qid, i) => ({
    test_id: test.id,
    question_id: qid,
    order_index: i,
  }))

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
    .select('question_id, order_index')
    .eq('test_id', testId)
    .order('order_index')

  if (tqErr) throw new Error(`Failed to load test questions: ${tqErr.message}`)

  const qIds = (tqs as { question_id: string; order_index: number }[]).map((r) => r.question_id)

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .in('id', qIds)

  if (qErr) throw new Error(`Failed to load questions: ${qErr.message}`)

  // Restore order
  const qMap = new Map((questions as Question[]).map((q) => [q.id, q]))
  const ordered = qIds.map((id) => qMap.get(id)!).filter(Boolean)

  return { ...(test as Test), questions: ordered }
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
