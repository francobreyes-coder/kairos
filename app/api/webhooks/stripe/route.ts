import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session

    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    const meta = checkoutSession.metadata
    if (!meta?.student_id || !meta?.tutor_id) {
      console.error('Missing metadata in checkout session')
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Create the session in the database now that payment is confirmed
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        student_id: meta.student_id,
        tutor_id: meta.tutor_id,
        day_of_week: meta.day_of_week,
        time_slot: meta.time_slot,
        scheduled_date: meta.scheduled_date,
        notes: meta.notes || '',
        status: 'confirmed',
        price: parseFloat(meta.price || '0'),
        payment_status: 'paid',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create session after payment:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Send confirmation email
    try {
      const { data: student } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', meta.student_id)
        .single()

      const { data: tutorApp } = await supabase
        .from('tutor_applications')
        .select('name')
        .eq('user_id', meta.tutor_id)
        .eq('application_status', 'approved')
        .single()

      const tutorName = tutorApp?.name ?? 'your tutor'
      const studentEmail = student?.email
      const studentName = student?.name?.split(' ')[0] || 'there'
      const formattedDate = new Date(meta.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      if (studentEmail) {
        await sendBookingConfirmationEmail(studentEmail, studentName, tutorName, formattedDate, meta.time_slot)
      }
    } catch (e) {
      console.error('Failed to send booking confirmation email:', e)
    }

    console.log('Session created after payment:', newSession?.id)
  }

  return NextResponse.json({ received: true })
}
