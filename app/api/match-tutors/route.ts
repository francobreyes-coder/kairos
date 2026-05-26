import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { rankTutors, type StudentProfile, type TutorProfile } from '@/lib/matching'
import { findTutorProfile } from '@/lib/tutor-profile'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Fetch the student's profile (may not exist if user is a tutor/admin)
  const { data: student } = await supabase
    .from('students')
    .select('interests, intended_major, colleges_of_interest, goals, preferred_teaching_style, tutor_personality')
    .eq('user_id', session.user.id)
    .single()

  // Fetch all completed tutor profiles
  const { data: tutors, error: tutorErr } = await supabase
    .from('tutor_profiles')
    .select('user_id, bio, profile_photo, subjects, college, major, interests, teaching_style, services, service_prices, availability, profile_completed')
    .eq('profile_completed', true)

  if (tutorErr) {
    return NextResponse.json({ error: 'Failed to fetch tutors' }, { status: 500 })
  }

  if (!tutors || tutors.length === 0) {
    return NextResponse.json({ matches: [] })
  }

  // Identify which tutor_profiles correspond to an APPROVED application, so
  // suspended/banned tutors are filtered out of /find-tutors entirely.
  // Application user_id may not match profile user_id (e.g. tutor applied
  // with credentials but completed their profile after a Google sign-in),
  // so we also reconcile by email via the users table.
  const tutorUserIds = tutors.map((t) => t.user_id)
  const approvedTutorIds = new Set<string>()
  const nameMap = new Map<string, string>()

  // 1. Direct user_id match on approved applications
  const { data: applications } = await supabase
    .from('tutor_applications')
    .select('user_id, name')
    .in('user_id', tutorUserIds)
    .eq('application_status', 'approved')

  if (applications) {
    for (const app of applications) {
      approvedTutorIds.add(app.user_id)
      if (app.name) nameMap.set(app.user_id, app.name)
    }
  }

  // 2. Reconcile id drift: for any profile not yet approved, look up the
  // owning user's email and see if an approved application exists under it.
  const unmatched = tutorUserIds.filter((id) => !approvedTutorIds.has(id))
  if (unmatched.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', unmatched)

    if (users) {
      const emailToUserId = new Map<string, string>()
      for (const u of users) {
        if (u.email) emailToUserId.set(u.email, u.id)
      }

      if (emailToUserId.size > 0) {
        const emails = Array.from(emailToUserId.keys())
        const { data: appsByEmail } = await supabase
          .from('tutor_applications')
          .select('email, name')
          .in('email', emails)
          .eq('application_status', 'approved')

        if (appsByEmail) {
          for (const app of appsByEmail) {
            const userId = emailToUserId.get(app.email)
            if (userId) {
              approvedTutorIds.add(userId)
              if (app.name) nameMap.set(userId, app.name)
            }
          }
        }
      }
    }
  }

  // Drop suspended/banned (and any other non-approved) tutors before ranking.
  const approvedTutors = tutors.filter((t) => approvedTutorIds.has(t.user_id))

  if (approvedTutors.length === 0) {
    return NextResponse.json({ matches: [], viewerSelfUserId: null })
  }

  const studentProfile: StudentProfile = {
    interests: student?.interests ?? [],
    intended_major: student?.intended_major ?? '',
    colleges_of_interest: student?.colleges_of_interest ?? [],
    goals: student?.goals ?? [],
    preferred_teaching_style: student?.preferred_teaching_style ?? '',
    tutor_personality: student?.tutor_personality ?? [],
  }

  // Fetch tutors the student has previously booked to prioritize similar tutors
  let bookedTutorProfiles: TutorProfile[] = []
  const { data: bookedSessions } = await supabase
    .from('sessions')
    .select('tutor_id')
    .eq('student_id', session.user.id)
    .eq('status', 'confirmed')

  if (bookedSessions && bookedSessions.length > 0) {
    const bookedTutorIds = [...new Set(bookedSessions.map((s) => s.tutor_id))]
    const { data: bookedTutors } = await supabase
      .from('tutor_profiles')
      .select('user_id, bio, profile_photo, subjects, college, major, interests, teaching_style, services, service_prices, availability, profile_completed')
      .in('user_id', bookedTutorIds)

    if (bookedTutors) {
      bookedTutorProfiles = bookedTutors as TutorProfile[]
    }
  }

  const ranked = rankTutors(studentProfile, approvedTutors as TutorProfile[], bookedTutorProfiles)

  const matches = ranked.map((m) => ({
    userId: m.tutor.user_id,
    name: nameMap.get(m.tutor.user_id) ?? 'Tutor',
    bio: m.tutor.bio,
    profilePhoto: m.tutor.profile_photo,
    subjects: m.tutor.subjects,
    college: m.tutor.college,
    major: m.tutor.major,
    interests: m.tutor.interests,
    teachingStyle: m.tutor.teaching_style,
    services: m.tutor.services,
    servicePrices: (m.tutor as unknown as Record<string, unknown>).service_prices ?? {},
    score: m.score,
    reasons: m.reasons,
  }))

  // Tell the client which row in `matches` (if any) belongs to the viewer,
  // so a tutor visiting /find-tutors sees their own card pinned as the top
  // match instead of randomly placed.
  let viewerSelfUserId: string | null = null
  const { application: viewerApp, profile: viewerProfile } = await findTutorProfile({
    id: session.user.id,
    email: session.user.email,
  })
  if (viewerApp && viewerProfile?.profile_completed) {
    viewerSelfUserId = viewerProfile.user_id
  }

  return NextResponse.json({ matches, viewerSelfUserId })
}
