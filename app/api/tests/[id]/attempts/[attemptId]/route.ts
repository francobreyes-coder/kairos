import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

// GET /api/tests/[id]/attempts/[attemptId]
//
// Returns the saved answers + score for a single attempt. Authorization:
//  - the student who submitted the attempt can read their own
//  - the tutor who owns the test can read any attempt against it
//
// Used by the review screens (student dashboard "Review", tutor dashboard
// "Review results"). The full set of correct answers lives on the test row,
// so the page client just re-runs the same comparison the test runtime uses.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: testId, attemptId } = await params
  const supabase = getSupabase()

  const { data: attempt, error } = await supabase
    .from('test_attempts')
    .select('id, test_id, student_id, tutor_id, answers, correct_count, total_count, submitted_at')
    .eq('id', attemptId)
    .eq('test_id', testId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!attempt) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  }

  const candidateIds = await getUserCandidateIds({
    id: session.user.id,
    email: session.user.email,
  })
  const ownerKeys = new Set<string>(candidateIds)
  if (session.user.email) ownerKeys.add(session.user.email)

  const { data: testRow } = await supabase
    .from('tests')
    .select('tutor_id')
    .eq('id', testId)
    .single()
  const isTutorOwner = !!(testRow && ownerKeys.has(testRow.tutor_id))
  const isStudentOwner = candidateIds.includes(attempt.student_id)

  if (!isTutorOwner && !isStudentOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let studentName: string | null = null
  if (isTutorOwner) {
    const { data: u } = await supabase
      .from('users')
      .select('name')
      .eq('id', attempt.student_id)
      .maybeSingle()
    studentName = u?.name ?? null
    if (!studentName) {
      const { data: s } = await supabase
        .from('students')
        .select('name')
        .eq('user_id', attempt.student_id)
        .maybeSingle()
      studentName = s?.name ?? null
    }
  }

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      test_id: attempt.test_id,
      student_id: attempt.student_id,
      answers: attempt.answers ?? {},
      correct_count: attempt.correct_count,
      total_count: attempt.total_count,
      submitted_at: attempt.submitted_at,
      student_name: studentName,
    },
    role: isTutorOwner ? 'tutor' : 'student',
  })
}
