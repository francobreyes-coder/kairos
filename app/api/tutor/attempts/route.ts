import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

export interface TutorAttemptSummary {
  id: string
  test_id: string
  test_name: string
  exam_type: 'SAT' | 'ACT'
  student_id: string
  student_name: string | null
  correct_count: number
  total_count: number
  submitted_at: string
}

// GET /api/tutor/attempts — every submission across every test this tutor
// owns, newest first. Powers the tutor dashboard "Practice Tests" panel.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const candidateIds = await getUserCandidateIds({
    id: session.user.id,
    email: session.user.email,
  })
  const tutorKeys = Array.from(new Set([...candidateIds, session.user.email].filter(Boolean) as string[]))

  // Find the tutor's tests by tutor_id (which on the tests table can be a
  // users.id or an email — same as the assignment endpoint resolves it).
  const { data: tests, error: tErr } = await supabase
    .from('tests')
    .select('id, name, exam_type')
    .in('tutor_id', tutorKeys)

  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 })
  }
  if (!tests || tests.length === 0) {
    return NextResponse.json({ attempts: [] })
  }

  const testIds = tests.map((t) => t.id)
  const testById = new Map(tests.map((t) => [t.id, t]))

  const { data: attempts, error: aErr } = await supabase
    .from('test_attempts')
    .select('id, test_id, student_id, correct_count, total_count, submitted_at')
    .in('test_id', testIds)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 })
  }

  const studentIds = Array.from(new Set((attempts ?? []).map((a) => a.student_id)))
  const studentNames = new Map<string, string>()
  if (studentIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', studentIds)
    for (const u of users ?? []) {
      if (u.name) studentNames.set(u.id, u.name)
    }
    const { data: students } = await supabase
      .from('students')
      .select('user_id, name')
      .in('user_id', studentIds)
    for (const s of students ?? []) {
      if (s.name) studentNames.set(s.user_id, s.name)
    }
  }

  const out: TutorAttemptSummary[] = (attempts ?? []).map((a) => {
    const t = testById.get(a.test_id)
    return {
      id: a.id,
      test_id: a.test_id,
      test_name: t?.name ?? 'Practice test',
      exam_type: (t?.exam_type as 'SAT' | 'ACT') ?? 'SAT',
      student_id: a.student_id,
      student_name: studentNames.get(a.student_id) ?? null,
      correct_count: a.correct_count,
      total_count: a.total_count,
      submitted_at: a.submitted_at,
    }
  })

  return NextResponse.json({ attempts: out })
}
