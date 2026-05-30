import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

// GET /api/admin/questions/categories
// Returns the distinct values currently in use for the filter dropdowns:
//   { exam_types, subjects, question_types, difficulties }
// `question_types` and `subjects` are grouped by exam_type so the UI can
// show only the values that exist for the selected exam.
export async function GET() {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('exam_type, subject, question_type, difficulty')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Array<{
    exam_type: string
    subject: string
    question_type: string
    difficulty: string
  }>

  const exam_types = [...new Set(rows.map((r) => r.exam_type))].sort()
  const difficulties = [...new Set(rows.map((r) => r.difficulty))].sort()

  const subjectsByExam: Record<string, Set<string>> = {}
  const typesByExamSubject: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (!subjectsByExam[r.exam_type]) subjectsByExam[r.exam_type] = new Set()
    subjectsByExam[r.exam_type].add(r.subject)
    const k = `${r.exam_type}|${r.subject}`
    if (!typesByExamSubject[k]) typesByExamSubject[k] = new Set()
    typesByExamSubject[k].add(r.question_type)
  }

  const subjects = Object.fromEntries(
    Object.entries(subjectsByExam).map(([k, v]) => [k, [...v].sort()])
  )
  const question_types = Object.fromEntries(
    Object.entries(typesByExamSubject).map(([k, v]) => [k, [...v].sort()])
  )

  return NextResponse.json({ exam_types, subjects, question_types, difficulties })
}
