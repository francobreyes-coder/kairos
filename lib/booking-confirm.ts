import type Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase'
import { sendBookingConfirmationEmail } from '@/lib/email'
import { createVideoRoom } from '@/lib/daily'

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
      console.log('[fulfillCheckoutBooking] duplicate, returning existing id=', existing?.id)
      return existing?.id ?? null
    }
    console.error('[fulfillCheckoutBooking] insert failed:', JSON.stringify(error), 'meta=', JSON.stringify(meta))
    return null
  }
  console.log('[fulfillCheckoutBooking] inserted session id=', inserted.id)

  const sessionId = inserted.id

  try {
    const { roomName, roomUrl } = await createVideoRoom(
      sessionId,
      meta.scheduled_date,
      meta.time_slot,
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
    const formattedDate = new Date(meta.scheduled_date + 'T00:00:00').toLocaleDateString(
      'en-US',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    )

    if (studentEmail) {
      await sendBookingConfirmationEmail(
        studentEmail,
        studentName,
        tutorName,
        formattedDate,
        meta.time_slot,
      )
    }
  } catch (e) {
    console.error('Failed to send booking confirmation email:', e)
  }

  return sessionId
}
