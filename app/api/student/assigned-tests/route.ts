import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

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

  // No formal student↔test assignment table yet — for the student dashboard,
  // surface every tutor-authored test so students can take them. When an
  // assignment table is added, filter here by student_id.
  const { data: tests, error } = await supabase
    .from('tests')
    .select('id, name, exam_type, question_count, created_at, tutor_id')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tutorIds = Array.from(new Set((tests ?? []).map((t) => t.tutor_id).filter(Boolean)))
  let tutorNameByKey = new Map<string, string>()
  if (tutorIds.length > 0) {
    const { data: byId } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', tutorIds)
    for (const u of byId ?? []) {
      if (u.id) tutorNameByKey.set(u.id, u.name ?? '')
      if (u.email) tutorNameByKey.set(u.email, u.name ?? '')
    }
    const { data: byEmail } = await supabase
      .from('users')
      .select('id, name, email')
      .in('email', tutorIds)
    for (const u of byEmail ?? []) {
      if (u.email) tutorNameByKey.set(u.email, u.name ?? '')
    }
  }

  const out: AssignedTest[] = (tests ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    exam_type: t.exam_type,
    question_count: t.question_count,
    created_at: t.created_at,
    tutor_name: tutorNameByKey.get(t.tutor_id) ?? null,
  }))

  return NextResponse.json({ tests: out })
}
