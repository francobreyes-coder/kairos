'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useEffect } from 'react'

function PostSignInHandler() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return
    const optin = sessionStorage.getItem('kairos_email_optin')
    if (optin === null) return

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOptin: optin === 'true' }),
    }).then(() => sessionStorage.removeItem('kairos_email_optin'))
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
