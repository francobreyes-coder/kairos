import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

// GET /api/admin/questions/categories
// Returns the distinct values currently in use for the filter dropdowns:
//   { exam_types, subjects, question_types, topics, difficulties }
// `subjects` is keyed by exam_type, `question_types` by `${exam_type}|${subject}`,
// and `topics` by `${exam_type}|${subject}|${question_type}` so each dropdown
// can show only the values relevant to the parent selection.
export async function GET() {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('exam_type, subject, question_type, topic, difficulty')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Array<{
    exam_type: string
    subject: string
    question_type: string
    topic: string | null
    difficulty: string
  }>

  const exam_types = [...new Set(rows.map((r) => r.exam_type))].sort()
  const difficulties = [...new Set(rows.map((r) => r.difficulty))].sort()

  const subjectsByExam: Record<string, Set<string>> = {}
  const typesByExamSubject: Record<string, Set<string>> = {}
  const topicsByExamSubjectType: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (!subjectsByExam[r.exam_type]) subjectsByExam[r.exam_type] = new Set()
    subjectsByExam[r.exam_type].add(r.subject)
    const k = `${r.exam_type}|${r.subject}`
    if (!typesByExamSubject[k]) typesByExamSubject[k] = new Set()
    typesByExamSubject[k].add(r.question_type)
    if (r.topic) {
      const tk = `${r.exam_type}|${r.subject}|${r.question_type}`
      if (!topicsByExamSubjectType[tk]) topicsByExamSubjectType[tk] = new Set()
      topicsByExamSubjectType[tk].add(r.topic)
    }
  }

  const subjects = Object.fromEntries(
    Object.entries(subjectsByExam).map(([k, v]) => [k, [...v].sort()])
  )
  const question_types = Object.fromEntries(
    Object.entries(typesByExamSubject).map(([k, v]) => [k, [...v].sort()])
  )
  const topics = Object.fromEntries(
    Object.entries(topicsByExamSubjectType).map(([k, v]) => [k, [...v].sort()])
  )

  return NextResponse.json({ exam_types, subjects, question_types, topics, difficulties })
}
