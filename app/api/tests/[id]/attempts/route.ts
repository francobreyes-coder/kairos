import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'
import { getTestWithQuestions } from '@/lib/tests'
import { sendSystemMessage } from '@/lib/messaging'

// Permissive correctness check — mirrors the student test-runner so a
// fill-in answer of "0.5" / ".5" / "1/2" all match a stored "0.5".
function parseNumeric(s: string): number | null {
  const trimmed = s.trim()
  const fracMatch = trimmed.match(/^(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)$/)
  if (fracMatch) {
    const num = parseFloat(fracMatch[1])
    const den = parseFloat(fracMatch[2])
    if (den === 0 || !isFinite(num) || !isFinite(den)) return null
    return num / den
  }
  const n = parseFloat(trimmed)
  return isFinite(n) && /^-?\d*\.?\d+$/.test(trimmed) ? n : null
}

function answerMatches(given: string | undefined, expected: string): boolean {
  if (given == null) return false
  const a = given.trim()
  const b = expected.trim()
  if (a === '' || b === '') return false
  if (a === b) return true
  const na = parseNumeric(a)
  const nb = parseNumeric(b)
  if (na != null && nb != null && Math.abs(na - nb) < 1e-9) return true
  return false
}

// Resolve a tutor_id stored on a row (could be a users.id or an email) into
// the canonical users.id we should DM. Falls back to the stored value if
// nothing matches — the messaging layer will still accept it.
async function resolveTutorUserId(tutorIdOrEmail: string): Promise<{
  id: string
  email: string | null
}> {
  const supabase = getSupabase()
  if (tutorIdOrEmail.includes('@')) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', tutorIdOrEmail)
      .maybeSingle()
    if (user) return { id: user.id, email: user.email ?? tutorIdOrEmail }
    return { id: tutorIdOrEmail, email: tutorIdOrEmail }
  }
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', tutorIdOrEmail)
    .maybeSingle()
  if (user) return { id: user.id, email: user.email }
  return { id: tutorIdOrEmail, email: null }
}

// POST /api/tests/[id]/attempts — student submits a completed test.
//   body: { answers: Record<string, string> }
//
// Server scores against the test's correct_answer values (so a malicious
// client can't post a 100% with no actual answers) and writes a row.
// Also opens-or-reuses the tutor↔student conversation and posts a
// "submitted" message so the tutor sees the notification in their inbox.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: testId } = await params

  let payload: { answers?: Record<string, string> }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload?.answers ?? {})) {
    if (typeof v === 'string' && v.trim() !== '') answers[k] = v
  }

  const supabase = getSupabase()
  const candidateIds = await getUserCandidateIds({
    id: session.user.id,
    email: session.user.email,
  })

  // Same allow-list logic as GET /api/tests/[id] — the student must have a
  // matching assignment row.
  const { data: assignment } = await supabase
    .from('test_assignments')
    .select('test_id, tutor_id')
    .eq('test_id', testId)
    .in('student_id', candidateIds)
    .limit(1)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json(
      { error: 'This test has not been assigned to you' },
      { status: 403 },
    )
  }

  const test = await getTestWithQuestions(testId)
  const totalCount = test.questions.length
  const correctCount = test.questions.reduce(
    (acc, q) => acc + (answerMatches(answers[q.id], q.correct_answer) ? 1 : 0),
    0,
  )

  const { data: attempt, error: insertErr } = await supabase
    .from('test_attempts')
    .insert({
      test_id: testId,
      student_id: session.user.id,
      tutor_id: assignment.tutor_id,
      answers,
      correct_count: correctCount,
      total_count: totalCount,
    })
    .select('id, submitted_at, correct_count, total_count')
    .single()

  if (insertErr || !attempt) {
    return NextResponse.json(
      { error: `Failed to save attempt: ${insertErr?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }

  // Best-effort inbox notification. Errors here don't fail the submission —
  // the attempt is already persisted and the tutor can still see it in their
  // practice-tests panel.
  try {
    const tutor = await resolveTutorUserId(assignment.tutor_id)
    const studentName = session.user.name || 'Your student'
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
    const content =
      `📝 ${studentName} just submitted ${test.name} — ` +
      `${correctCount}/${totalCount} correct (${pct}%). ` +
      `Open it from your Practice Tests panel to see their answers.`
    await sendSystemMessage({
      senderId: session.user.id,
      senderEmail: session.user.email,
      partnerId: tutor.id,
      partnerEmail: tutor.email,
      content,
    })
  } catch (err) {
    console.error('[attempts] inbox notify failed:', err)
  }

  return NextResponse.json({ attempt }, { status: 201 })
}

// GET /api/tests/[id]/attempts — list attempts for this test.
//   Tutors (who own the test) see every student's attempts.
//   Students see only their own attempts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: testId } = await params
  const supabase = getSupabase()

  const { data: testRow, error: testErr } = await supabase
    .from('tests')
    .select('tutor_id')
    .eq('id', testId)
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

  let query = supabase
    .from('test_attempts')
    .select('id, test_id, student_id, correct_count, total_count, submitted_at')
    .eq('test_id', testId)
    .order('submitted_at', { ascending: false })

  if (!isOwner) {
    query = query.in('student_id', candidateIds)
  }

  const { data: attempts, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // For tutor views, decorate with student names so the dashboard doesn't
  // have to make a second roundtrip.
  let studentNames: Record<string, string> = {}
  if (isOwner && attempts && attempts.length > 0) {
    const studentIds = Array.from(new Set(attempts.map((a) => a.student_id)))
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', studentIds)
    for (const u of users ?? []) {
      if (u.name) studentNames[u.id] = u.name
    }
    const { data: students } = await supabase
      .from('students')
      .select('user_id, name')
      .in('user_id', studentIds)
    for (const s of students ?? []) {
      if (s.name) studentNames[s.user_id] = s.name
    }
  }

  return NextResponse.json({
    attempts: (attempts ?? []).map((a) => ({
      ...a,
      student_name: studentNames[a.student_id] ?? null,
    })),
    isOwner,
  })
}
