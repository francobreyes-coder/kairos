import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { rankTutors, type StudentProfile, type TutorProfile } from '@/lib/matching'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Fetch the student's profile
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('interests, intended_major, colleges_of_interest, goals, preferred_teaching_style, tutor_personality')
    .eq('user_id', session.user.id)
    .single()

  if (studentErr || !student) {
    return NextResponse.json(
      { error: 'Student profile not found. Complete onboarding first.' },
      { status: 404 }
    )
  }

  // Fetch all completed tutor profiles
  const { data: tutors, error: tutorErr } = await supabase
    .from('tutor_profiles')
    .select('user_id, bio, profile_photo, subjects, college, major, interests, teaching_style, services, availability, profile_completed')
    .eq('profile_completed', true)

  if (tutorErr) {
    return NextResponse.json({ error: 'Failed to fetch tutors' }, { status: 500 })
  }

  if (!tutors || tutors.length === 0) {
    return NextResponse.json({ matches: [] })
  }

  // Fetch tutor names — try multiple sources to handle user_id mismatches
  // (e.g. tutor applied with credentials but completed profile with Google)
  const tutorUserIds = tutors.map((t) => t.user_id)
  const nameMap = new Map<string, string>()

  // 1. Direct user_id match on approved applications
  const { data: applications } = await supabase
    .from('tutor_applications')
    .select('user_id, name')
    .in('user_id', tutorUserIds)
    .eq('application_status', 'approved')

  if (applications) {
    for (const app of applications) {
      nameMap.set(app.user_id, app.name)
    }
  }

  // 2. For tutors still missing names, try email-based lookup via users table
  const missingIds = tutorUserIds.filter((id) => !nameMap.has(id))
  if (missingIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', missingIds)

    if (users) {
      const emailToUserId = new Map<string, string>()
      for (const u of users) {
        // Use the users table name as a fallback
        if (u.name && !nameMap.has(u.id)) {
          nameMap.set(u.id, u.name)
        }
        if (u.email) {
          emailToUserId.set(u.email, u.id)
        }
      }

      // Also try matching applications by email for name resolution
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
            if (userId && app.name) {
              nameMap.set(userId, app.name)
            }
          }
        }
      }
    }
  }

  const studentProfile: StudentProfile = {
    interests: student.interests ?? [],
    intended_major: student.intended_major ?? '',
    colleges_of_interest: student.colleges_of_interest ?? [],
    goals: student.goals ?? [],
    preferred_teaching_style: student.preferred_teaching_style ?? '',
    tutor_personality: student.tutor_personality ?? [],
  }

  const ranked = rankTutors(studentProfile, tutors as TutorProfile[])

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
    score: m.score,
    reasons: m.reasons,
  }))

  return NextResponse.json({ matches })
}
