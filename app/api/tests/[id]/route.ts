import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getTestWithQuestions, deleteTest } from '@/lib/tests'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

// GET /api/tests/[id] — get a test with its questions.
//
// Authorization: the requester must either own the test (its creator)
// or have a test_assignments row matching one of their candidate ids.
// This is what enforces "students can only take tests assigned to them"
// at the data layer.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabase()

    const { data: testRow, error: testErr } = await supabase
      .from('tests')
      .select('tutor_id')
      .eq('id', id)
      .single()
    if (testErr || !testRow) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const candidateIds = await getUserCandidateIds({
      id: session.user.id,
      email: session.user.email,
    })
    const ownerKeys = new Set<string>(candidateIds)
    if (session.user.email) ownerKeys.add(session.user.email)
    const isOwner = ownerKeys.has(testRow.tutor_id)

    if (!isOwner) {
      const { data: assignment } = await supabase
        .from('test_assignments')
        .select('test_id')
        .eq('test_id', id)
        .in('student_id', candidateIds)
        .limit(1)
        .maybeSingle()
      if (!assignment) {
        return NextResponse.json(
          { error: 'This test has not been assigned to you' },
          { status: 403 },
        )
      }
    }

    const test = await getTestWithQuestions(id)
    return NextResponse.json({ test })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/tests/[id] — delete a test
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    await deleteTest(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
