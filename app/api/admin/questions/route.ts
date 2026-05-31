import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

async function requireAdmin() {
  const session = await auth()
  return session?.user?.email === ADMIN_EMAIL
}

const ALL_FIELDS =
  'id, exam_type, subject, question_type, topic, difficulty, question_text, ' +
  'answer_choices, correct_answer, explanation, tags, time_estimate, ' +
  'figures, data_table, passage_group, passage_ids, question_number, ' +
  'context_lines, created_at, updated_at'

// GET /api/admin/questions
// Query params: exam_type, subject, question_type, topic, difficulty, q (text search),
// limit (default 100), offset (default 0).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const examType = params.get('exam_type')
  const subject = params.get('subject')
  const questionType = params.get('question_type')
  const topic = params.get('topic')
  const difficulty = params.get('difficulty')
  const q = params.get('q')?.trim()
  const limit = Math.min(parseInt(params.get('limit') ?? '100', 10) || 100, 500)
  const offset = parseInt(params.get('offset') ?? '0', 10) || 0

  const supabase = getSupabase()
  let query = supabase
    .from('questions')
    .select(ALL_FIELDS, { count: 'exact' })
    .order('exam_type', { ascending: true })
    .order('subject', { ascending: true })
    .order('question_type', { ascending: true })
    .order('created_at', { ascending: true })

  if (examType) query = query.eq('exam_type', examType)
  if (subject) query = query.eq('subject', subject)
  if (questionType) query = query.eq('question_type', questionType)
  if (topic) {
    if (topic === '__none__') query = query.is('topic', null)
    else query = query.eq('topic', topic)
  }
  if (difficulty) query = query.eq('difficulty', difficulty)
  if (q) query = query.ilike('question_text', `%${q}%`)

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ questions: data ?? [], total: count ?? 0, limit, offset })
}
