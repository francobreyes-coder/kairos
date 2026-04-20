'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'create'>('create')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [emailOptin, setEmailOptin] = useState(true)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/home')
  }, [session, router])

  if (status === 'loading' || session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const canProceed = mode === 'signin' || (
    firstName.trim() && lastName.trim() && email.trim() && age.trim()
  )

  const handleProvider = (provider: string) => {
    if (!canProceed) return
    sessionStorage.setItem('kairos_email_optin', emailOptin ? 'true' : 'false')
    if (mode === 'create') {
      sessionStorage.setItem('kairos_signup', JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        age: age.trim(),
      }))
    }
    signIn(provider, { callbackUrl: '/home' })
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-400 flex items-center justify-center shadow-sm">
            <span
              className="text-white text-2xl leading-none select-none"
              style={{ fontFamily: 'Shrikhand, cursive' }}
            >
              k
            </span>
          </div>
          <span
            className="text-2xl leading-none text-foreground select-none"
            style={{ fontFamily: 'Shrikhand, cursive' }}
          >
            kairos
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-full bg-secondary border border-border p-1 mb-8">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-foreground text-center mb-2">
          {mode === 'create' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {mode === 'create'
            ? 'Fill in your details, then continue with a provider.'
            : 'Sign in to pick up where you left off.'}
        </p>

        {/* Create account fields */}
        {mode === 'create' && (
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
              />
            </div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min="13"
              max="99"
              className={inputCls}
            />
          </div>
        )}

        {/* Provider buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleProvider('apple')}
            disabled={!canProceed}
            className="w-full h-12 rounded-lg bg-foreground text-background text-sm font-medium inline-flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>

          <button
            onClick={() => handleProvider('google')}
            disabled={!canProceed}
            className="w-full h-12 rounded-lg bg-card border border-border text-foreground text-sm font-medium inline-flex items-center justify-center gap-3 hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Email opt-in */}
        <label className="flex items-start gap-3 mt-8 cursor-pointer group">
          <div
            onClick={() => setEmailOptin(!emailOptin)}
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 mt-0.5 ${
              emailOptin
                ? 'bg-accent border-accent'
                : 'border-border group-hover:border-accent/50'
            }`}
          >
            {emailOptin && (
              <svg className="w-3 h-3 text-accent-foreground" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="text-sm text-muted-foreground leading-snug">
            {"I'd like to receive emails from Kairos about updates, tips, and new features."}
          </span>
        </label>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href="/home"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>

      </div>
    </main>
  )
}
