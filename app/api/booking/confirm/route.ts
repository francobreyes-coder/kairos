import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckoutBooking } from '@/lib/booking-confirm'

// POST /api/booking/confirm — called from /booking/success so the booking
// lands even when the Stripe webhook isn't reachable (local dev / misconfig).
// Idempotent: the helper no-ops on the unique index if the webhook already
// inserted the row.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await req.json()
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const stripe = getStripe()
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

  if (checkoutSession.metadata?.student_id !== session.user.id) {
    return NextResponse.json({ error: 'Not your checkout session' }, { status: 403 })
  }

  if (checkoutSession.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
  }

  const id = await fulfillCheckoutBooking(checkoutSession)
  return NextResponse.json({ sessionId: id })
}
