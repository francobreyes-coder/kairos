import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  const { data: profile, error: profileErr } = await supabase
    .from('tutor_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  const { data: application, error: appErr } = await supabase
    .from('tutor_applications')
    .select('university, major, services_approved, name, application_status')
    .eq('user_id', session.user.id)
    .eq('application_status', 'approved')
    .single()

  // Also check if user has ANY tutor application (regardless of status)
  const { data: anyApplication, error: anyAppErr } = await supabase
    .from('tutor_applications')
    .select('id, user_id, application_status')
    .eq('user_id', session.user.id)
    .single()

  // Fetch all applications by email for debugging
  const { data: appsByEmail } = await supabase
    .from('tutor_applications')
    .select('id, user_id, application_status, email')
    .eq('email', session.user.email!)

  return NextResponse.json({
    profile,
    application,
    hasApplication: !!anyApplication,
    _debug: {
      sessionUserId: session.user.id,
      sessionEmail: session.user.email,
      profileErr: profileErr?.message,
      appErr: appErr?.message,
      anyAppErr: anyAppErr?.message,
      anyApplication,
      appsByEmail,
    },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getSupabase()

  const { data: application } = await supabase
    .from('tutor_applications')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('application_status', 'approved')
    .single()

  if (!application) {
    return NextResponse.json({ error: 'No approved application found' }, { status: 403 })
  }

  const profileData: Record<string, unknown> = {
    user_id: session.user.id,
    bio: body.bio ?? '',
    subjects: body.subjects ?? [],
    college: body.college ?? '',
    major: body.major ?? '',
    interests: body.interests ?? [],
    teaching_style: body.teachingStyle ?? '',
    availability: body.availability ?? {},
    services: body.services ?? [],
    profile_completed: body.profileCompleted ?? false,
    updated_at: new Date().toISOString(),
  }

  if (body.profilePhoto !== undefined) {
    profileData.profile_photo = body.profilePhoto
  }

  const { error } = await supabase
    .from('tutor_profiles')
    .upsert(profileData, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
