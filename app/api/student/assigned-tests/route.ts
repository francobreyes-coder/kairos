import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

export interface AssignedTest {
  id: string
  name: string
  exam_type: 'SAT' | 'ACT'
  question_count: number
  created_at: string
  tutor_name: string | null
  // Latest attempt for this student against this test, if they've finished
  // one. The dashboard uses this to switch the card from "Start" to
  // "Review results" and to display the score.
  last_attempt: {
    id: string
    correct_count: number
    total_count: number
    submitted_at: string
  } | null
  attempt_count: number
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Resolve every id linked to this student so an assignment written
  // against any of them is visible after identity drift.
  const candidateIds = await getUserCandidateIds({
    id: session.user.id,
    email: session.user.email,
  })

  const { data: assignments, error: aErr } = await supabase
    .from('test_assignments')
    .select('test_id, assigned_at')
    .in('student_id', candidateIds)
    .order('assigned_at', { ascending: false })

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 })
  }

  const testIds = Array.from(new Set((assignments ?? []).map((a) => a.test_id)))
  if (testIds.length === 0) {
    return NextResponse.json({ tests: [] })
  }

  const { data: tests, error } = await supabase
    .from('tests')
    .select('id, name, exam_type, question_count, created_at, tutor_id')
    .in('id', testIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // tests.tutor_id is stored as either a user.id or an email; resolve
  // tutor display name from both shapes.
  const tutorKeys = Array.from(new Set((tests ?? []).map((t) => t.tutor_id).filter(Boolean)))
  const tutorNameByKey = new Map<string, string>()
  if (tutorKeys.length > 0) {
    const { data: byId } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', tutorKeys)
    for (const u of byId ?? []) {
      if (u.id) tutorNameByKey.set(u.id, u.name ?? '')
      if (u.email) tutorNameByKey.set(u.email, u.name ?? '')
    }
    const { data: byEmail } = await supabase
      .from('users')
      .select('id, name, email')
      .in('email', tutorKeys)
    for (const u of byEmail ?? []) {
      if (u.email) tutorNameByKey.set(u.email, u.name ?? '')
    }
  }

  // Order tests by their assignment timestamp so newest assignments appear first.
  const assignmentOrder = new Map<string, string>()
  for (const a of assignments ?? []) {
    if (!assignmentOrder.has(a.test_id)) {
      assignmentOrder.set(a.test_id, a.assigned_at)
    }
  }

  // Pull every attempt this student has against the assigned tests in one
  // query, then collapse to "latest per test + total count" client-side. The
  // student_id stored on test_attempts is whichever candidate id was logged
  // in at submit time, so the IN-set has to span all of them.
  const { data: attempts } = await supabase
    .from('test_attempts')
    .select('id, test_id, correct_count, total_count, submitted_at')
    .in('test_id', testIds)
    .in('student_id', candidateIds)
    .order('submitted_at', { ascending: false })

  const latestByTest = new Map<string, NonNullable<AssignedTest['last_attempt']>>()
  const countByTest = new Map<string, number>()
  for (const a of attempts ?? []) {
    countByTest.set(a.test_id, (countByTest.get(a.test_id) ?? 0) + 1)
    if (!latestByTest.has(a.test_id)) {
      latestByTest.set(a.test_id, {
        id: a.id,
        correct_count: a.correct_count,
        total_count: a.total_count,
        submitted_at: a.submitted_at,
      })
    }
  }

  const out: AssignedTest[] = (tests ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      exam_type: t.exam_type,
      question_count: t.question_count,
      created_at: t.created_at,
      tutor_name: tutorNameByKey.get(t.tutor_id) || null,
      last_attempt: latestByTest.get(t.id) ?? null,
      attempt_count: countByTest.get(t.id) ?? 0,
    }))
    .sort((a, b) =>
      (assignmentOrder.get(b.id) ?? '').localeCompare(assignmentOrder.get(a.id) ?? ''),
    )

  return NextResponse.json({ tests: out })
}
