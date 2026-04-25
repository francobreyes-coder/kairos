import { getSupabase } from './supabase'

export interface QuestionFigure {
  url: string
  caption: string
}

export interface Question {
  id: string
  exam_type: 'SAT' | 'ACT'
  subject: string
  question_type: string
  difficulty: 'easy' | 'medium' | 'hard'
  question_text: string
  answer_choices: { label: string; text: string }[]
  correct_answer: string
  explanation: string
  tags: string[]
  time_estimate: number | null
  figures: QuestionFigure[]
  created_at: string
  updated_at: string
}

export interface QuestionFilters {
  exam_type?: 'SAT' | 'ACT'
  subject?: string
  question_type?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
  limit?: number
  randomize?: boolean
}

/**
 * Fetch questions with optional filters and randomization.
 */
export async function fetchQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  const supabase = getSupabase()
  let query = supabase.from('questions').select('*')

  if (filters.exam_type) {
    query = query.eq('exam_type', filters.exam_type)
  }
  if (filters.subject) {
    query = query.eq('subject', filters.subject)
  }
  if (filters.question_type) {
    query = query.eq('question_type', filters.question_type)
  }
  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }
  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  const limit = filters.limit ?? 50

  if (filters.randomize) {
    // Use a random offset for pseudo-randomization via Supabase
    // For true random ordering, we fetch more and shuffle client-side
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })

    const total = count ?? 0
    if (total > 0) {
      const maxOffset = Math.max(0, total - limit)
      const randomOffset = Math.floor(Math.random() * (maxOffset + 1))
      query = query.range(randomOffset, randomOffset + limit - 1)
    }
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch questions: ${error.message}`)
  }

  const questions = data as Question[]

  // Shuffle if randomize was requested
  if (filters.randomize) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[questions[i], questions[j]] = [questions[j], questions[i]]
    }
  }

  return questions
}

/**
 * Get all distinct subjects for an exam type.
 */
export async function getSubjects(examType: 'SAT' | 'ACT'): Promise<string[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('subject')
    .eq('exam_type', examType)

  if (error) {
    throw new Error(`Failed to fetch subjects: ${error.message}`)
  }

  return [...new Set((data as { subject: string }[]).map((r) => r.subject))]
}

/**
 * Get all distinct question types for a given exam + subject.
 */
export async function getQuestionTypes(
  examType: 'SAT' | 'ACT',
  subject: string
): Promise<string[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('question_type')
    .eq('exam_type', examType)
    .eq('subject', subject)

  if (error) {
    throw new Error(`Failed to fetch question types: ${error.message}`)
  }

  return [...new Set((data as { question_type: string }[]).map((r) => r.question_type))]
}

/**
 * Insert a single question.
 */
export async function insertQuestion(
  question: Omit<Question, 'id' | 'created_at' | 'updated_at'>
): Promise<Question> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .insert(question)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to insert question: ${error.message}`)
  }

  return data as Question
}

/**
 * Bulk insert questions. Skips duplicates via onConflict.
 */
export async function bulkInsertQuestions(
  questions: Omit<Question, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ inserted: number; skipped: number; total: number }> {
  const supabase = getSupabase()
  let inserted = 0
  let skipped = 0

  for (const question of questions) {
    const { error } = await supabase
      .from('questions')
      .insert(question)

    if (error) {
      if (error.code === '23505') {
        // Duplicate — skip
        skipped++
      } else {
        throw new Error(`Failed to insert question: ${error.message}`)
      }
    } else {
      inserted++
    }
  }

  return { inserted, skipped, total: questions.length }
}
