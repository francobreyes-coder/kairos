'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function PostLoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }
    const role = (session?.user as { role?: string } | undefined)?.role
    router.replace(role === 'high_school' ? '/student/dashboard' : '/home')
  }, [status, session, router])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '3px solid #BDB0F5',
          borderTopColor: 'transparent',
          animation: 'kspin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}
