import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia',
  })
}

// Kairos platform commission as a fraction (0.15 = 15%). Charged on top of
// the tutor's listed price as a Stripe `application_fee_amount`, with the
// remainder transferred to the tutor's connected Express account.
export const PLATFORM_FEE_PCT = 0.15

// Compute the application fee in cents from a price expressed in dollars.
// Kept in one place so checkout and refund logic agree.
export function platformFeeCents(priceUsd: number): number {
  return Math.round(priceUsd * 100 * PLATFORM_FEE_PCT)
}
