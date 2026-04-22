'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const inputCls =
  'w-full h-11 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'create'>('create')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [role, setRole] = useState<'high_school' | 'college'>('high_school')
  const [emailOptin, setEmailOptin] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session && !submitting) router.push('/home')
  }, [session, router, submitting])

  if (status === 'loading' || session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const passwordsMatch = password === confirmPassword
  const canSignup = firstName.trim() && lastName.trim() && email.trim() && age.trim() && password.length >= 8 && passwordsMatch
  const canLogin = loginEmail.trim() && loginPassword.trim()

  const handleFormSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSignup) return
    setError('')
    setSubmitting(true)

    const result = await signIn('signup', {
      redirect: false,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      age: age.trim(),
      password,
      emailOptin: emailOptin ? 'true' : 'false',
      role,
    })

    if (result?.error) {
      setError('An account with this email may already exist. Try signing in.')
      setSubmitting(false)
    } else {
      router.push(role === 'high_school' ? '/student/onboarding' : '/home')
    }
  }

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canLogin) return
    setError('')
    setSubmitting(true)

    const result = await signIn('login', {
      redirect: false,
      email: loginEmail.trim(),
      password: loginPassword,
    })

    if (result?.error) {
      setError("We couldn't find an account with those credentials. Try creating one instead.")
      setMode('create')
      setSubmitting(false)
    } else {
      router.push('/home')
    }
  }

  const handleGoogleSignup = () => {
    sessionStorage.setItem('kairos_email_optin', emailOptin ? 'true' : 'false')
    sessionStorage.setItem('kairos_role', role)
    signIn('google', { callbackUrl: role === 'high_school' ? '/student/onboarding' : '/home' })
  }

  const handleGoogleSignin = () => {
    sessionStorage.removeItem('kairos_email_optin')
    sessionStorage.removeItem('kairos_signup')
    sessionStorage.removeItem('kairos_role')
    signIn('google', { callbackUrl: '/home' })
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <Image src="/logo.png" alt="Kairos" width={40} height={40} className="rounded-xl" />
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
            onClick={() => { setMode('create'); setError('') }}
            className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
          <button
            onClick={() => { setMode('signin'); setError('') }}
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
            ? 'Sign up with your details or continue with Google.'
            : 'Sign in with your email or Google.'}
        </p>

        {mode === 'create' ? (
          <>
            {/* Role toggle */}
            <div className="flex rounded-full bg-secondary border border-border p-1 mb-4">
              <button
                type="button"
                onClick={() => setRole('high_school')}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                  role === 'high_school'
                    ? 'bg-purple-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {"I'm in High School"}
              </button>
              <button
                type="button"
                onClick={() => setRole('college')}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                  role === 'college'
                    ? 'bg-purple-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {"I'm in College"}
              </button>
            </div>

            {/* Sign-up form */}
            <form onSubmit={handleFormSignup} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="13"
                max="99"
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`${inputCls} ${confirmPassword && !passwordsMatch ? 'border-red-400 focus:ring-red-300/30' : ''}`}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-500">Passwords do not match.</p>
              )}

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={!canSignup || submitting}
                className="w-full h-12 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google option */}
            <button
              onClick={handleGoogleSignup}
              className="w-full h-12 rounded-lg bg-card border border-border text-foreground text-sm font-medium inline-flex items-center justify-center gap-3 hover:bg-secondary transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </>
        ) : (
          <>
            {/* Sign-in form */}
            <form onSubmit={handleFormLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className={inputCls}
              />

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={!canLogin || submitting}
                className="w-full h-12 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google option */}
            <button
              onClick={handleGoogleSignin}
              className="w-full h-12 rounded-lg bg-card border border-border text-foreground text-sm font-medium inline-flex items-center justify-center gap-3 hover:bg-secondary transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </>
        )}

        {/* Email opt-in (signup only) */}
        {mode === 'create' && (
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
        )}

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
