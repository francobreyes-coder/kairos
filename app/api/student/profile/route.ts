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

  const studentData = {
    user_id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    grade: body.grade ?? '',
    interests: body.interests ?? [],
    intended_major: body.intendedMajor ?? '',
    colleges_of_interest: body.collegesOfInterest ?? [],
    goals: body.goals ?? [],
    preferred_teaching_style: body.preferredTeachingStyle ?? '',
    tutor_personality: body.tutorPersonality ?? [],
    onboarding_completed: body.onboardingCompleted ?? false,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('students')
    .upsert(studentData, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
