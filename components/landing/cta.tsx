'use client'

import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { submitWaitlist } from '@/app/actions'

export function CTA() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [userType, setUserType] = useState<'student' | 'tutor'>('student')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    await submitWaitlist(email, userType)
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <section id="cta" className="py-24 px-6 bg-primary">
      <div className="mx-auto max-w-3xl text-center">

        <h2 className="text-3xl md:text-4xl font-semibold text-primary-foreground tracking-tight text-balance">
          Ready to get started?
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/80">
          Whether you&apos;re a high schooler looking for guidance or a college student ready to
          tutor—join the waitlist today.
        </p>

        {/* Student / Tutor toggle */}
        <div className="mt-8 inline-flex rounded-full bg-primary-foreground/10 p-1">
          <button
            onClick={() => setUserType('student')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              userType === 'student'
                ? 'bg-primary-foreground text-primary'
                : 'text-primary-foreground/70 hover:text-primary-foreground'
            }`}
          >
            High School Student
          </button>
          <button
            onClick={() => setUserType('tutor')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              userType === 'tutor'
                ? 'bg-primary-foreground text-primary'
                : 'text-primary-foreground/70 hover:text-primary-foreground'
            }`}
          >
            College Tutor
          </button>
        </div>

        {!submitted ? (
          <form
            onSubmit={handleSubmit}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              placeholder={
                userType === 'student' ? 'Enter your email' : 'Enter your .edu email'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 h-12 px-4 rounded-lg bg-primary-foreground border-0 text-primary placeholder:text-primary/50 text-sm outline-none focus:ring-2 focus:ring-primary-foreground/30"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              {submitting ? 'Submitting…' : (userType === 'student' ? 'Join Waitlist' : 'Apply as Tutor')}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          <div className="mt-8 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 max-w-md mx-auto">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
            <span className="text-primary-foreground">
              {userType === 'student'
                ? "You're on the list! We'll be in touch soon."
                : "Application received! We'll review and be in touch."}
            </span>
          </div>
        )}

        <p className="mt-8 text-sm text-primary-foreground/60">
          {userType === 'tutor'
            ? 'Currently accepting students from top 30 universities'
            : 'Coming soon to iOS and Web'}
        </p>

      </div>
    </section>
  )
}
