import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  return NextResponse.json({ student })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getSupabase()

  const update: Record<string, unknown> = {
    user_id: session.user.id,
    email: session.user.email ?? '',
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) update.name = body.name
  if (body.grade !== undefined) update.grade = body.grade
  if (body.interests !== undefined) update.interests = body.interests
  if (body.intendedMajor !== undefined) update.intended_major = body.intendedMajor
  if (body.collegesOfInterest !== undefined) update.colleges_of_interest = body.collegesOfInterest
  if (body.goals !== undefined) update.goals = body.goals
  if (body.preferredTeachingStyle !== undefined) update.preferred_teaching_style = body.preferredTeachingStyle
  if (body.tutorPersonality !== undefined) update.tutor_personality = body.tutorPersonality
  if (body.onboardingCompleted !== undefined) update.onboarding_completed = body.onboardingCompleted

  if (body.bio !== undefined) update.bio = body.bio
  if (body.dateOfBirth !== undefined) update.date_of_birth = body.dateOfBirth || null
  if (body.gender !== undefined) update.gender = body.gender
  if (body.phone !== undefined) update.phone = body.phone
  if (body.profilePhoto !== undefined) update.profile_photo = body.profilePhoto

  const { error } = await supabase
    .from('students')
    .upsert(update, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Keep users.name in sync so session-driven UI (sidebar initials, header
  // greeting) reflects the latest value after a session refetch.
  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    await supabase
      .from('users')
      .update({ name: body.name, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
  }

  return NextResponse.json({ ok: true })
}
