import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

// GET /api/tutor/students — lists every student who has had any session
// (past or upcoming, in any status) with the current tutor. Used by the
// test-assignment picker so a tutor can only assign to students they
// already have a session relationship with.
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

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('student_id, scheduled_date, status')
    .in('tutor_id', candidateIds)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }

  // Collapse to unique students, keeping the most recent session date so the
  // picker can show a hint like "Last session: Mar 12".
  const map = new Map<string, { lastDate: string; status: string }>()
  for (const s of sessions ?? []) {
    const existing = map.get(s.student_id)
    if (!existing || s.scheduled_date > existing.lastDate) {
      map.set(s.student_id, { lastDate: s.scheduled_date, status: s.status })
    }
  }

  const studentIds = Array.from(map.keys())
  if (studentIds.length === 0) {
    return NextResponse.json({ students: [] })
  }

  // Resolve names — prefer students.name, fall back to users.name.
  const nameMap = new Map<string, string>()
  const { data: studentRows } = await supabase
    .from('students')
    .select('user_id, name')
    .in('user_id', studentIds)
  for (const s of studentRows ?? []) {
    if (s.name) nameMap.set(s.user_id, s.name)
  }

  const { data: userRows } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', studentIds)
  const emailMap = new Map<string, string>()
  for (const u of userRows ?? []) {
    if (u.name && !nameMap.has(u.id)) nameMap.set(u.id, u.name)
    if (u.email) emailMap.set(u.id, u.email)
  }

  const today = new Date().toISOString().split('T')[0]
  const students = studentIds.map((id) => {
    const meta = map.get(id)!
    return {
      id,
      name: nameMap.get(id) ?? emailMap.get(id) ?? 'Student',
      email: emailMap.get(id) ?? null,
      last_session_date: meta.lastDate,
      last_session_status: meta.status,
      is_upcoming: meta.lastDate >= today && meta.status === 'confirmed',
    }
  })

  // Upcoming first, then most-recent past.
  students.sort((a, b) => {
    if (a.is_upcoming !== b.is_upcoming) return a.is_upcoming ? -1 : 1
    return b.last_session_date.localeCompare(a.last_session_date)
  })

  return NextResponse.json({ students })
}
