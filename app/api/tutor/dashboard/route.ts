import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getUserCandidateIds } from '@/lib/user-candidates'
import { expandLegacyServiceIds, expandLegacyServicePrices, SERVICE_LABELS } from '@/lib/services'
import { getStripe, PLATFORM_FEE_PCT } from '@/lib/stripe'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// GET /api/tutor/dashboard — fetch all data needed for the tutor dashboard
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const userId = session.user.id

  // Surface suspended / banned tutors with a specific signal so the dashboard
  // page can redirect them to the explainer instead of showing "profile not
  // found". Check by both id and email to handle credentials/Google drift.
  let inactiveStatus: string | null = null
  const { data: statusById } = await supabase
    .from('tutor_applications')
    .select('application_status')
    .eq('user_id', userId)
    .in('application_status', ['suspended', 'banned'])
    .maybeSingle()
  if (statusById) inactiveStatus = statusById.application_status as string

  if (!inactiveStatus && session.user.email) {
    const { data: statusByEmail } = await supabase
      .from('tutor_applications')
      .select('application_status')
      .eq('email', session.user.email)
      .in('application_status', ['suspended', 'banned'])
      .maybeSingle()
    if (statusByEmail) inactiveStatus = statusByEmail.application_status as string
  }

  if (inactiveStatus) {
    return NextResponse.json(
      { error: 'Account inactive', status: inactiveStatus },
      { status: 403 },
    )
  }

  // Try by user_id first, then fall back to email-based lookup
  // (handles cases where user has multiple accounts, e.g. Google + credentials)
  let { data: profile } = await supabase
    .from('tutor_profiles')
    .select('user_id, bio, profile_photo, subjects, college, major, availability, services, service_prices, qa, profile_completed, stripe_account_id')
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
        .select('user_id, bio, profile_photo, subjects, college, major, availability, services, service_prices, qa, profile_completed, stripe_account_id')
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
    .select('id, student_id, tutor_id, day_of_week, time_slot, scheduled_date, status, price, payment_status, notes, created_at, timezone, stripe_payment_intent_id, stripe_application_fee_amount')
    .in('tutor_id', tutorIds)
    .order('scheduled_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  // Gather student names + grade/school for sub-line in lists
  const studentIds = new Set<string>()
  for (const s of sessions ?? []) {
    studentIds.add(s.student_id)
  }

  const nameMap = new Map<string, string>()
  const subMap = new Map<string, string>()
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

    // Check students table for better names + grade
    const { data: students } = await supabase
      .from('students')
      .select('user_id, name, grade')
      .in('user_id', Array.from(studentIds))

    if (students) {
      for (const s of students) {
        if (s.name) nameMap.set(s.user_id, s.name)
        if (s.grade) subMap.set(s.user_id, s.grade)
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // Net earnings the tutor actually receives from Stripe per session: the
  // listed price minus the Kairos application fee that was attached to the
  // PaymentIntent at booking. Prefer the persisted Stripe fee (in cents) so
  // the dashboard reflects the exact amount Stripe transferred; fall back to
  // PLATFORM_FEE_PCT for legacy rows booked before the fee column existed.
  // Rows that never went through Stripe (payment_status != 'paid', e.g.
  // refunds or admin-created sessions) contribute $0 — only paid sessions
  // count toward earnings.
  function netUsd(s: { price: unknown; payment_status: string | null; stripe_application_fee_amount: number | null }): number {
    if (s.payment_status !== 'paid') return 0
    const gross = parseFloat(String(s.price)) || 0
    if (gross <= 0) return 0
    const feeCents =
      s.stripe_application_fee_amount ?? Math.round(gross * 100 * PLATFORM_FEE_PCT)
    return Math.max(0, gross - feeCents / 100)
  }

  const enrichedSessions = (sessions ?? []).map((s) => ({
    ...s,
    student_name: nameMap.get(s.student_id) ?? 'Student',
    student_sub: subMap.get(s.student_id) ?? '',
    net_earnings: netUsd(s),
  }))

  const upcoming = enrichedSessions.filter(
    (s) => s.scheduled_date >= today && s.status === 'confirmed'
  )
  const past = enrichedSessions.filter(
    (s) => s.scheduled_date < today || s.status === 'completed'
  )
  const completed = enrichedSessions.filter((s) => s.status === 'completed')
  // Every session Stripe actually charged for. This is the only thing that
  // affects the tutor's Stripe balance — completion status is a calendar
  // bookkeeping concept that doesn't change what's already been transferred.
  const paid = enrichedSessions.filter((s) => s.payment_status === 'paid')

  // Earnings — net of the 15% Kairos platform fee, sourced from each
  // session's stored Stripe application_fee_amount. Counted on `paid` (not
  // `completed`) so a session that's been charged but not yet marked
  // complete still shows the money that's already sitting in Stripe.
  const totalEarnings = paid.reduce((sum, s) => sum + s.net_earnings, 0)
  const earningsPerSession = paid.length > 0 ? totalEarnings / paid.length : 0

  // Earnings this week (current Sun→Sat window)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0]

  const earningsThisWeek = paid
    .filter((s) => s.scheduled_date >= startOfWeekStr)
    .reduce((sum, s) => sum + s.net_earnings, 0)

  // Weekly buckets — Mon..Sun in the current week, net $ from paid sessions.
  const weekly = DAY_LABELS.map((label) => ({ label, val: 0 }))
  for (const s of paid) {
    if (s.scheduled_date < startOfWeekStr) continue
    const d = new Date(s.scheduled_date + 'T00:00:00')
    // JS getDay: 0=Sun..6=Sat. Map to 0=Mon..6=Sun.
    const idx = (d.getDay() + 6) % 7
    weekly[idx].val += s.net_earnings
  }
  for (const w of weekly) w.val = Math.round(w.val)

  // Monthly buckets — last 6 months ending this month
  const monthly: { label: string; val: number; ym: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly.push({
      label: MONTH_LABELS[d.getMonth()],
      val: 0,
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  const monthlySessions = monthly.map((m) => ({ label: m.label, val: 0 }))
  for (const s of paid) {
    const ym = s.scheduled_date.slice(0, 7)
    const idx = monthly.findIndex((m) => m.ym === ym)
    if (idx >= 0) {
      monthly[idx].val += s.net_earnings
      monthlySessions[idx].val += 1
    }
  }
  for (const m of monthly) m.val = Math.round(m.val)

  // Live Stripe balance for the connected account — canonical source for
  // "Available" (ready to be paid out) and "Pending" (still in flight from
  // recent charges). Falls back to 0 if the tutor hasn't connected Stripe
  // yet or the API call fails.
  let stripeAvailable = 0
  let stripePending = 0
  if (profile.stripe_account_id) {
    try {
      const stripe = getStripe()
      const balance = await stripe.balance.retrieve(undefined, {
        stripeAccount: profile.stripe_account_id as string,
      })
      const usdCentsSum = (entries: Array<{ amount: number; currency: string }>) =>
        entries.filter((e) => e.currency === 'usd').reduce((s, e) => s + e.amount, 0)
      stripeAvailable = usdCentsSum(balance.available) / 100
      stripePending = usdCentsSum(balance.pending) / 100
    } catch (e) {
      console.error('Failed to fetch Stripe balance:', e)
    }
  }

  // Top students by completed session count (for Analytics "by student" chart)
  const studentCounts = new Map<string, { name: string; sub: string; count: number }>()
  for (const s of completed) {
    const existing = studentCounts.get(s.student_id)
    if (existing) {
      existing.count += 1
    } else {
      studentCounts.set(s.student_id, {
        name: s.student_name,
        sub: s.student_sub,
        count: 1,
      })
    }
  }
  const topStudents = Array.from(studentCounts.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Repeat rate — % of completed-session students who have 2+ completed sessions
  const repeatRate = studentCounts.size > 0
    ? Math.round(
        (Array.from(studentCounts.values()).filter((v) => v.count >= 2).length /
          studentCounts.size) * 100,
      )
    : 0

  // Subject breakdown — derived from services the tutor offers, weighted by
  // number of approved services (no per-session subject tagging exists yet).
  const services = expandLegacyServiceIds(profile.services as string[] | null)
  const servicesBreakdown = services.map((id) => ({
    id,
    label: SERVICE_LABELS[id] ?? id,
  }))

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
      services,
      service_prices: expandLegacyServicePrices(profile.service_prices as Record<string, number> | null),
      qa: (profile.qa as Array<{ question: string; answer: string }> | null | undefined) ?? [],
      name: app?.name ?? session.user.name ?? 'Tutor',
      profile_photo: profile.profile_photo
        ? `/api/storage?path=${encodeURIComponent(profile.profile_photo)}`
        : null,
    },
    stats: {
      totalEarnings,
      earningsPerSession,
      earningsThisWeek,
      // Live values from the connected Stripe account so what the dashboard
      // shows matches what the tutor sees on Stripe.
      stripeAvailable,
      stripePending,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      totalSessions: enrichedSessions.length,
      uniqueStudents: studentCounts.size,
      repeatRate,
      platformFeePct: PLATFORM_FEE_PCT,
    },
    upcoming: upcoming.slice(0, 10),
    past: past.slice(0, 20),
    weekly,
    monthly: monthly.map(({ label, val }) => ({ label, val })),
    monthlySessions,
    topStudents,
    servicesBreakdown,
  })
}
