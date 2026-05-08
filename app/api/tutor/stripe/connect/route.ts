import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { getSupabase } from '@/lib/supabase'
import { findTutorProfile } from '@/lib/tutor-profile'

// POST /api/tutor/stripe/connect — start (or resume) Stripe Connect Express
// onboarding for the signed-in tutor. Returns a Stripe-hosted onboarding URL
// that the client should redirect to. Idempotent: reuses an existing
// stripe_account_id when present.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { profile, application } = await findTutorProfile({
    id: session.user.id,
    email: session.user.email,
  })

  if (!application) {
    return NextResponse.json(
      { error: 'No approved tutor application found.' },
      { status: 403 },
    )
  }

  const supabase = getSupabase()
  const stripe = getStripe()

  let accountId = profile?.stripe_account_id ?? null

  if (!accountId) {
    // Create a fresh Express account. We only set the email — the rest is
    // collected by Stripe's hosted onboarding so we don't accidentally
    // commit to fields that would block Connect's identity flow.
    const account = await stripe.accounts.create({
      type: 'express',
      email: application.email ?? session.user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        kairos_user_id: profile?.user_id ?? session.user.id,
        kairos_application_id: application.id,
      },
    })
    accountId = account.id

    // Persist on the profile row that already exists (so identity drift
    // doesn't leave us with two profile rows).
    const profileUserId = profile?.user_id ?? session.user.id
    const { error: upsertErr } = await supabase
      .from('tutor_profiles')
      .upsert(
        {
          user_id: profileUserId,
          stripe_account_id: accountId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (upsertErr) {
      return NextResponse.json(
        { error: 'Failed to persist Stripe account id' },
        { status: 500 },
      )
    }
  }

  const baseUrl = req.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/tutor/dashboard?stripe=refresh`,
    return_url: `${baseUrl}/tutor/dashboard?stripe=return`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url, accountId })
}
