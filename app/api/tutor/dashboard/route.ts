import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'

// GET /api/tutor/dashboard — fetch all data needed for the tutor dashboard
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const userId = session.user.id

  // Try by user_id first, then fall back to email-based lookup
  // (handles cases where user has multiple accounts, e.g. Google + credentials)
  let { data: profile } = await supabase
    .from('tutor_profiles')
    .select('user_id, bio, profile_photo, subjects, college, major, availability, services, service_prices, profile_completed')
    .eq('user_id', userId)
    .eq('profile_completed', true)
    .single()

  let tutorUserId = userId

  // Fallback: look up by email if user_id didn't match
  if (!profile && session.user.email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('user_id')
      .eq('email', session.user.email)
      .eq('application_status', 'approved')
      .single()

    if (appByEmail) {
      const { data: profileByOriginal } = await supabase
        .from('tutor_profiles')
        .select('user_id, bio, profile_photo, subjects, college, major, availability, services, service_prices, profile_completed')
        .eq('user_id', appByEmail.user_id)
        .eq('profile_completed', true)
        .single()

      if (profileByOriginal) {
        profile = profileByOriginal
        tutorUserId = appByEmail.user_id
      }
    }
  }

  if (!profile) {
    return NextResponse.json({ error: 'Tutor profile not found' }, { status: 404 })
  }

  // Booking writes tutor_id as the email-resolved users.id, which can be a
  // third value distinct from both the current signin id and the orphan
  // tutor_profiles.user_id. Combine all of them so the row is found.
  const candidateIds = await getUserCandidateIds({
    id: userId,
    email: session.user.email,
  })
  const tutorIds = Array.from(new Set([...candidateIds, tutorUserId]))
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .in('tutor_id', tutorIds)
    .order('scheduled_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  // Gather student names
  const studentIds = new Set<string>()
  for (const s of sessions ?? []) {
    studentIds.add(s.student_id)
  }

  const nameMap = new Map<string, string>()
  if (studentIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(studentIds))

    if (users) {
      for (const u of users) {
        nameMap.set(u.id, u.name ?? 'Unknown')
      }
    }

    // Check students table for better names
    const { data: students } = await supabase
      .from('students')
      .select('user_id, name')
      .in('user_id', Array.from(studentIds))

    if (students) {
      for (const s of students) {
        if (s.name) nameMap.set(s.user_id, s.name)
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const enrichedSessions = (sessions ?? []).map((s) => ({
    ...s,
    student_name: nameMap.get(s.student_id) ?? 'Student',
  }))

  const upcoming = enrichedSessions.filter(
    (s) => s.scheduled_date >= today && s.status === 'confirmed'
  )
  const past = enrichedSessions.filter(
    (s) => s.scheduled_date < today || s.status === 'completed'
  )
  const completed = enrichedSessions.filter((s) => s.status === 'completed')

  // Earnings calculations
  const totalEarnings = completed.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
  const earningsPerSession = completed.length > 0 ? totalEarnings / completed.length : 0

  // Earnings this week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0]
  const earningsThisWeek = completed
    .filter((s) => s.scheduled_date >= startOfWeekStr)
    .reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)

  // Tutor application name (try user_id, then email fallback)
  let { data: app } = await supabase
    .from('tutor_applications')
    .select('name')
    .eq('user_id', userId)
    .eq('application_status', 'approved')
    .single()

  if (!app && session.user.email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('name')
      .eq('email', session.user.email)
      .eq('application_status', 'approved')
      .single()
    if (appByEmail) app = appByEmail
  }

  return NextResponse.json({
    profile: {
      ...profile,
      name: app?.name ?? session.user.name ?? 'Tutor',
      profile_photo: profile.profile_photo
        ? `/api/storage?path=${encodeURIComponent(profile.profile_photo)}`
        : null,
    },
    stats: {
      totalEarnings,
      earningsPerSession,
      earningsThisWeek,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      totalSessions: enrichedSessions.length,
    },
    upcoming: upcoming.slice(0, 10),
    past: past.slice(0, 20),
  })
}
