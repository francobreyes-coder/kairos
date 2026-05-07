import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

// Tests use `tutor_id text` storing either the user.id or email — the
// existing list endpoint queries by email. Build the same candidate set
// (id + email + linked accounts) so an assign action by the original
// creator works regardless of which identity wrote the test row.
async function getTutorCandidateKeys(opts: { id: string; email?: string | null }): Promise<string[]> {
  const ids = await getUserCandidateIds(opts)
  if (opts.email) ids.push(opts.email)
  return Array.from(new Set(ids))
}

async function ensureOwnsTest(
  testId: string,
  tutorKeys: string[],
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = getSupabase()
  const { data: test, error } = await supabase
    .from('tests')
    .select('id, tutor_id')
    .eq('id', testId)
    .single()

  if (error || !test) return { ok: false, status: 404, error: 'Test not found' }
  if (!tutorKeys.includes(test.tutor_id)) {
    return { ok: false, status: 403, error: 'Not authorized for this test' }
  }
  return { ok: true }
}

// GET /api/tests/[id]/assignments — list students this test is assigned to.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tutorKeys = await getTutorCandidateKeys({
    id: session.user.id,
    email: session.user.email,
  })
  const owns = await ensureOwnsTest(id, tutorKeys)
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status })

  const supabase = getSupabase()
  const { data: assignments, error } = await supabase
    .from('test_assignments')
    .select('student_id, assigned_at')
    .eq('test_id', id)
    .order('assigned_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }

  return NextResponse.json({ assignments: assignments ?? [] })
}

// POST /api/tests/[id]/assignments — assign the test to one or more students.
//   body: { studentIds: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tutorKeys = await getTutorCandidateKeys({
    id: session.user.id,
    email: session.user.email,
  })
  const owns = await ensureOwnsTest(id, tutorKeys)
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status })

  const body = await req.json()
  const studentIds = Array.isArray(body?.studentIds) ? (body.studentIds as string[]) : []
  if (studentIds.length === 0) {
    return NextResponse.json({ error: 'studentIds is required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Only allow assigning to students the tutor has actually had a session
  // with. This mirrors the picker's filter on the client and prevents a
  // tutor from assigning a test to an arbitrary user via crafted requests.
  const { data: sessionsRows } = await supabase
    .from('sessions')
    .select('student_id')
    .in('tutor_id', tutorKeys)

  const allowed = new Set((sessionsRows ?? []).map((r) => r.student_id))
  const filtered = studentIds.filter((sid) => allowed.has(sid))
  if (filtered.length === 0) {
    return NextResponse.json(
      { error: 'No matching session students found for this tutor' },
      { status: 400 },
    )
  }

  const tutorIdForRow = session.user.email ?? session.user.id
  const rows = filtered.map((sid) => ({
    test_id: id,
    student_id: sid,
    tutor_id: tutorIdForRow,
  }))

  const { error: insertErr } = await supabase
    .from('test_assignments')
    .upsert(rows, { onConflict: 'test_id,student_id', ignoreDuplicates: true })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, assigned: filtered.length })
}

// DELETE /api/tests/[id]/assignments?studentId=... — unassign one student.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const studentId = req.nextUrl.searchParams.get('studentId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
  }

  const tutorKeys = await getTutorCandidateKeys({
    id: session.user.id,
    email: session.user.email,
  })
  const owns = await ensureOwnsTest(id, tutorKeys)
  if (!owns.ok) return NextResponse.json({ error: owns.error }, { status: owns.status })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('test_assignments')
    .delete()
    .eq('test_id', id)
    .eq('student_id', studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
