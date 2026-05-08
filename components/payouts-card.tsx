'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, CreditCard } from 'lucide-react'

interface StripeStatus {
  connected: boolean
  accountId?: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsDue?: string[]
  error?: string
}

export function PayoutsCard() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<StripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Show a brief banner when the tutor returns from Stripe onboarding —
  // signal is in the query string the connect endpoint sends them back to.
  const justReturned = searchParams.get('stripe') === 'return'

  useEffect(() => {
    fetch('/api/tutor/stripe/status')
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({
        connected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        error: 'Could not load Stripe status.',
      }))
      .finally(() => setLoading(false))
  }, [])

  async function startOnboarding() {
    setActing(true)
    setActionError(null)
    try {
      const res = await fetch('/api/tutor/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setActionError(data.error ?? 'Could not start Stripe onboarding.')
        return
      }
      window.location.href = data.url
    } catch {
      setActionError('Network error.')
    } finally {
      setActing(false)
    }
  }

  async function openDashboard() {
    setActing(true)
    setActionError(null)
    try {
      const res = await fetch('/api/tutor/stripe/dashboard-link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setActionError(data.error ?? 'Could not open Stripe dashboard.')
        return
      }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('Network error.')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-8">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Payouts
          </h3>
        </div>
        {status?.chargesEnabled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !status?.connected ? (
        <div>
          <p className="text-sm text-foreground mb-1">
            Connect a Stripe account to receive payouts.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Kairos takes a 15% commission; the rest is paid out to your account by Stripe.
            You can&apos;t accept bookings until this is set up.
          </p>
          <button
            onClick={startOnboarding}
            disabled={acting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Connect Stripe
          </button>
        </div>
      ) : !status.chargesEnabled ? (
        <div>
          <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-foreground">
              {justReturned ? 'Stripe still needs more details before you can take bookings.' : 'Stripe needs more details before you can take bookings.'}
              {status.requirementsDue && status.requirementsDue.length > 0 && (
                <span className="block mt-1 text-muted-foreground">
                  Outstanding: {status.requirementsDue.slice(0, 4).join(', ')}
                  {status.requirementsDue.length > 4 && '…'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={startOnboarding}
              disabled={acting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Finish setup
            </button>
            <button
              onClick={openDashboard}
              disabled={acting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Stripe dashboard
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-foreground mb-1">
            Stripe is connected — you can take bookings.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Each completed booking is automatically paid out to your bank account by Stripe,
            minus the 15% Kairos commission.
          </p>
          <button
            onClick={openDashboard}
            disabled={acting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors disabled:opacity-50"
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            Manage payouts on Stripe
          </button>
        </div>
      )}

      {actionError && (
        <p className="mt-3 text-xs text-destructive">{actionError}</p>
      )}
    </div>
  )
}
