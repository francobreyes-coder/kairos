import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'

// POST /api/checkout — create a Stripe Checkout session for booking
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { tutorId, dayOfWeek, timeSlot, scheduledDate, notes, service } = body

  if (!tutorId || !dayOfWeek || !timeSlot || !scheduledDate || !service) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (tutorId === session.user.id) {
    return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verify tutor exists and has this availability + price
  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('availability, service_prices, services')
    .eq('user_id', tutorId)
    .eq('profile_completed', true)
    .single()

  if (!tutor) {
    return NextResponse.json({ error: 'Tutor not found' }, { status: 404 })
  }

  // Validate availability
  const tutorAvailability = tutor.availability as Record<string, string[]>
  const daySlots = tutorAvailability[dayOfWeek] ?? []
  if (!daySlots.includes(timeSlot)) {
    return NextResponse.json({ error: 'Tutor is not available at this time' }, { status: 400 })
  }

  // Validate service and get price
  const services = tutor.services as string[]
  if (!services.includes(service)) {
    return NextResponse.json({ error: 'Tutor does not offer this service' }, { status: 400 })
  }

  const servicePrices = tutor.service_prices as Record<string, number>
  const price = servicePrices[service]
  if (!price || price <= 0) {
    return NextResponse.json({ error: 'No price set for this service' }, { status: 400 })
  }

  // tutor_profiles.user_id can drift from users.id when the tutor applied
  // with one account and later signed in with another (Google vs
  // credentials). sessions.tutor_id has a FK to users(id), so resolve to a
  // real users row before booking — otherwise the insert in the webhook /
  // confirm path fails with 23503 and no session is ever created.
  let resolvedTutorId = tutorId
  const { data: tutorUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', tutorId)
    .single()
  if (!tutorUser) {
    const { data: app } = await supabase
      .from('tutor_applications')
      .select('email')
      .eq('user_id', tutorId)
      .eq('application_status', 'approved')
      .single()
    if (app?.email) {
      const { data: byEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', app.email)
        .single()
      if (byEmail) resolvedTutorId = byEmail.id
    }
    if (resolvedTutorId === tutorId) {
      return NextResponse.json(
        { error: "This tutor isn't available for booking right now" },
        { status: 400 },
      )
    }
  }

  if (resolvedTutorId === session.user.id) {
    return NextResponse.json({ error: 'Cannot book yourself' }, { status: 400 })
  }

  // Check for double booking
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('tutor_id', resolvedTutorId)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .single()

  if (existing) {
    return NextResponse.json({ error: 'This time slot is already booked' }, { status: 409 })
  }

  // Check student double booking
  const { data: studentConflict } = await supabase
    .from('sessions')
    .select('id')
    .eq('student_id', session.user.id)
    .eq('scheduled_date', scheduledDate)
    .eq('time_slot', timeSlot)
    .eq('status', 'confirmed')
    .single()

  if (studentConflict) {
    return NextResponse.json({ error: 'You already have a session at this time' }, { status: 409 })
  }

  // Get tutor name for checkout display
  const { data: tutorApp } = await supabase
    .from('tutor_applications')
    .select('name')
    .eq('user_id', tutorId)
    .eq('application_status', 'approved')
    .single()

  const tutorName = tutorApp?.name ?? 'Tutor'

  const SERVICE_LABELS: Record<string, string> = {
    'essays': 'Essay Writing',
    'sat-act': 'SAT/ACT Prep',
    'activities': 'Activities',
  }

  // Create Stripe Checkout session.
  // Derive baseUrl from the request so Stripe always redirects back to the
  // origin the user is actually on — independent of how NEXTAUTH_URL is set
  // in the deploy environment. Falls back to env only if origin is missing.
  const stripe = getStripe()
  const baseUrl = req.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(price * 100), // cents
          product_data: {
            name: `${SERVICE_LABELS[service] ?? service} Session with ${tutorName}`,
            description: `${dayOfWeek}, ${scheduledDate} at ${timeSlot}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      student_id: session.user.id,
      tutor_id: resolvedTutorId,
      day_of_week: dayOfWeek,
      time_slot: timeSlot,
      scheduled_date: scheduledDate,
      notes: notes || '',
      service,
      price: String(price),
    },
    success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking/cancel`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
