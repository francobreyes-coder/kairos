import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { findTutorProfile } from '@/lib/tutor-profile'

// POST /api/tutor/stripe/dashboard-link — single-use Stripe Express dashboard
// login link so a tutor can manage payouts, view balances, etc.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { profile } = await findTutorProfile({
    id: session.user.id,
    email: session.user.email,
  })

  const accountId = profile?.stripe_account_id
  if (!accountId) {
    return NextResponse.json(
      { error: 'No Stripe account connected.' },
      { status: 400 },
    )
  }

  const stripe = getStripe()
  const link = await stripe.accounts.createLoginLink(accountId)
  return NextResponse.json({ url: link.url })
}
