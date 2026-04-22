import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

// GET /api/tutor/dashboard — fetch all data needed for the tutor dashboard
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const userId = session.user.id

  // Verify this user is a tutor with a completed profile
  const { data: profile } = await supabase
    .from('tutor_profiles')
    .select('user_id, bio, profile_photo, subjects, college, major, availability, services, profile_completed')
    .eq('user_id', userId)
    .eq('profile_completed', true)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Tutor profile not found' }, { status: 404 })
  }

  // Fetch all sessions for this tutor
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('tutor_id', userId)
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

  // Tutor application name
  const { data: app } = await supabase
    .from('tutor_applications')
    .select('name')
    .eq('user_id', userId)
    .eq('application_status', 'approved')
    .single()

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
