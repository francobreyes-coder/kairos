'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function PostSignInHandler() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    const optin = sessionStorage.getItem('kairos_email_optin')
    if (optin === null) return

    const signupRaw = sessionStorage.getItem('kairos_signup')
    const signup = signupRaw ? JSON.parse(signupRaw) : null

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOptin: optin === 'true',
        ...(signup && {
          firstName: signup.firstName,
          lastName: signup.lastName,
          contactEmail: signup.email,
          age: signup.age,
        }),
      }),
    }).then(() => {
      sessionStorage.removeItem('kairos_email_optin')
      sessionStorage.removeItem('kairos_signup')
    })
  }, [session])

  return null
}

const ONBOARDING_EXEMPT = ['/tutor/onboarding', '/tutor/profile', '/auth', '/admin', '/apply']

function OnboardingGuard() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return
    if (ONBOARDING_EXEMPT.some((p) => pathname.startsWith(p))) return

    fetch('/api/tutor/profile')
      .then((r) => r.json())
      .then(({ application, profile }) => {
        if (application && (!profile || !profile.profile_completed)) {
          router.push('/tutor/onboarding')
        }
      })
      .catch(() => {})
  }, [status, session, pathname, router])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostSignInHandler />
      <OnboardingGuard />
      {children}
    </SessionProvider>
  )
}
