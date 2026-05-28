import type Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase'
import { sendBookingConfirmationEmail } from '@/lib/email'
import { createVideoRoom } from '@/lib/daily'
import { DEFAULT_TIMEZONE, formatSessionDateTime } from '@/lib/timezone'

// Idempotent fulfillment from a paid Stripe checkout session: insert the
// session row, create a Daily.co room, and send the confirmation email.
// Called from both the Stripe webhook and the /booking/success page so the
// booking lands even if the webhook isn't reachable (e.g. local dev). The
// unique index on (tutor_id, scheduled_date, time_slot) where status =
// 'confirmed' guarantees only one row is created when both callers race.
export async function fulfillCheckoutBooking(
  checkoutSession: Stripe.Checkout.Session,
): Promise<string | null> {
  if (checkoutSession.payment_status !== 'paid') return null

  const meta = checkoutSession.metadata
  if (!meta?.student_id || !meta?.tutor_id) return null

  const supabase = getSupabase()

  // payment_intent on a Checkout Session is either a string id or an
  // expanded object depending on how it was retrieved.
  const paymentIntentId =
    typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id ?? null

  const applicationFeeAmount = meta.application_fee_cents
    ? parseInt(meta.application_fee_cents, 10)
    : null

  const sessionTimezone = meta.timezone || DEFAULT_TIMEZONE

  const { data: inserted, error } = await supabase
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
      stripe_payment_intent_id: paymentIntentId,
      stripe_application_fee_amount: applicationFeeAmount,
      timezone: sessionTimezone,
    })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('tutor_id', meta.tutor_id)
        .eq('scheduled_date', meta.scheduled_date)
        .eq('time_slot', meta.time_slot)
        .eq('status', 'confirmed')
        .single()
      return existing?.id ?? null
    }
    console.error('Failed to create session after payment:', error)
    return null
  }

  const sessionId = inserted.id

  try {
    const { roomName, roomUrl } = await createVideoRoom(
      sessionId,
      meta.scheduled_date,
      meta.time_slot,
      sessionTimezone,
    )
    await supabase
      .from('sessions')
      .update({ video_room_name: roomName, video_room_url: roomUrl })
      .eq('id', sessionId)
  } catch (e) {
    console.error('Failed to create video room:', e)
  }

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
    // Render date + time in the session's source timezone (the tutor's tz
    // at booking time) so the email shows a single canonical time labeled
    // with the tz abbreviation — recipients in other zones convert mentally.
    const formattedWhen = formatSessionDateTime(
      meta.scheduled_date,
      meta.time_slot,
      sessionTimezone,
      sessionTimezone,
      { dateStyle: 'full', includeTimezone: true },
    )

    if (studentEmail) {
      await sendBookingConfirmationEmail(
        studentEmail,
        studentName,
        tutorName,
        formattedWhen,
      )
    }
  } catch (e) {
    console.error('Failed to send booking confirmation email:', e)
  }

  return sessionId
}
