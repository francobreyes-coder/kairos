import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

export type SessionMembership = {
  userId: string
  email: string | null
  candidateIds: string[]
  session: {
    id: string
    student_id: string
    tutor_id: string
  }
  isTutor: boolean
}

// Resolves the current user and confirms they are either the tutor or
// student on `sessionId`. Mirrors the identity-drift handling used by
// /api/sessions so a workspace lookup never fails for a logged-in member.
// Returns null if unauthenticated or not a member.
export async function getSessionMembership(
  sessionId: string,
): Promise<SessionMembership | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const supabase = getSupabase()

  const { data: row } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id')
    .eq('id', sessionId)
    .single()

  if (!row) return null

  const candidateIds = await getUserCandidateIds({
    id: session.user.id,
    email: session.user.email,
  })
  const candidateSet = new Set(candidateIds)

  const isTutor = candidateSet.has(row.tutor_id)
  const isStudent = candidateSet.has(row.student_id)
  if (!isTutor && !isStudent) return null

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    candidateIds,
    session: row,
    isTutor,
  }
}
