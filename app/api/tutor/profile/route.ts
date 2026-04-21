import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Try by user_id first, fall back to email if not found
  // (handles cases where user has multiple accounts, e.g. Google + credentials)
  let { data: profile } = await supabase
    .from('tutor_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  let { data: application } = await supabase
    .from('tutor_applications')
    .select('university, major, services_approved, name, application_status')
    .eq('user_id', session.user.id)
    .eq('application_status', 'approved')
    .single()

  // Fallback: look up by email if user_id didn't match
  if (!application && session.user.email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('university, major, services_approved, name, application_status, user_id')
      .eq('email', session.user.email)
      .eq('application_status', 'approved')
      .single()

    if (appByEmail) {
      application = appByEmail

      // Also try to find profile by the application's original user_id
      if (!profile) {
        const { data: profileByOriginal } = await supabase
          .from('tutor_profiles')
          .select('*')
          .eq('user_id', appByEmail.user_id)
          .single()
        if (profileByOriginal) profile = profileByOriginal
      }
    }
  }

  // Check for any application (regardless of status) by user_id or email
  let hasApplication = false
  const { data: anyApp } = await supabase
    .from('tutor_applications')
    .select('id')
    .eq('user_id', session.user.id)
    .single()
  if (anyApp) {
    hasApplication = true
  } else if (session.user.email) {
    const { data: anyAppByEmail } = await supabase
      .from('tutor_applications')
      .select('id')
      .eq('email', session.user.email)
      .single()
    if (anyAppByEmail) hasApplication = true
  }

  return NextResponse.json({ profile, application, hasApplication })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getSupabase()

  let { data: application } = await supabase
    .from('tutor_applications')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('application_status', 'approved')
    .single()

  // Fallback: look up by email
  if (!application && session.user.email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('id')
      .eq('email', session.user.email)
      .eq('application_status', 'approved')
      .single()
    application = appByEmail
  }

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
