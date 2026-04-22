'use client'

import { useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import { XCircle } from 'lucide-react'

export default function BookingCancelPage() {
  const router = useRouter()

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <div className="mx-auto max-w-md text-center py-16">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-8">
            Your payment was not completed and no session was booked.
            You can try again whenever you&apos;re ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/find-tutors')}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Back to Tutors
            </button>
            <button
              onClick={() => router.push('/sessions')}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              My Sessions
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
