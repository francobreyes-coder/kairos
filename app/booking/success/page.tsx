'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import { CheckCircle, Calendar, Loader2 } from 'lucide-react'

function BookingSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="mx-auto max-w-md text-center py-16">
      {!ready ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-muted-foreground">Confirming your payment...</p>
        </div>
      ) : (
        <>
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Session Booked!</h1>
          <p className="text-muted-foreground mb-8">
            Your payment was successful and your tutoring session has been confirmed.
            You&apos;ll receive a confirmation email shortly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/sessions')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              View My Sessions
            </button>
            <button
              onClick={() => router.push('/find-tutors')}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Find More Tutors
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function BookingSuccessPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          }
        >
          <BookingSuccessContent />
        </Suspense>
      </main>
    </>
  )
}
