'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import { Loader2 } from 'lucide-react'

function BookingSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const finish = () => router.replace('/home')

    if (!sessionId) {
      finish()
      return
    }

    fetch('/api/booking/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).finally(finish)
  }, [sessionId, router])

  return (
    <div className="mx-auto max-w-md text-center py-16">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-muted-foreground">Confirming your booking...</p>
      </div>
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
