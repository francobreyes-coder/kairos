'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Header } from '@/components/landing/header'
import { Search } from 'lucide-react'

export default function FindTutorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  if (status === 'loading') {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="pt-28 pb-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Search className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {"You're all set!"}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            {"We're building your personalized tutor matches. We'll notify you when your matches are ready."}
          </p>
          <button
            onClick={() => router.push('/home')}
            className="inline-flex items-center px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </main>
    </>
  )
}
