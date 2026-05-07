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

  const out: AssignedTest[] = (tests ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      exam_type: t.exam_type,
      question_count: t.question_count,
      created_at: t.created_at,
      tutor_name: tutorNameByKey.get(t.tutor_id) || null,
    }))
    .sort((a, b) =>
      (assignmentOrder.get(b.id) ?? '').localeCompare(assignmentOrder.get(a.id) ?? ''),
    )

  return NextResponse.json({ tests: out })
}
