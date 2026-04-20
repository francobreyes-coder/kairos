'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useEffect } from 'react'

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostSignInHandler />
      {children}
    </SessionProvider>
  )
}
