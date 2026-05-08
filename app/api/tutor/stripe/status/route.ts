import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { findTutorProfile } from '@/lib/tutor-profile'

// GET /api/tutor/stripe/status — current Connect onboarding state for the
// signed-in tutor. Used by the dashboard to decide whether to show "Connect"
// vs "Manage payouts" and to surface why bookings might be blocked.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { profile } = await findTutorProfile({
    id: session.user.id,
    email: session.user.email,
  })

  const accountId = profile?.stripe_account_id ?? null
  if (!accountId) {
    return NextResponse.json({
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    })
  }

  try {
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(accountId)
    return NextResponse.json({
      connected: true,
      accountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsDue: account.requirements?.currently_due ?? [],
    })
  } catch (e) {
    console.error('Stripe accounts.retrieve failed:', e)
    return NextResponse.json(
      {
        connected: true,
        accountId,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        error: 'Could not retrieve Stripe account.',
      },
      { status: 200 },
    )
  }
}
