'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Star, GraduationCap } from 'lucide-react'

const tutors = [
  { initials: 'JL', school: 'Harvard', rating: 5.0 },
  { initials: 'SM', school: 'Stanford', rating: 4.9 },
  { initials: 'AK', school: 'Yale', rating: 5.0 },
  { initials: 'RD', school: 'MIT', rating: 4.8 },
]

export function Hero() {
  const [userType, setUserType] = useState<'student' | 'college'>('student')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-muted-foreground">Coming Soon to iOS</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold text-foreground tracking-tight max-w-4xl text-balance">
            Learn from students who just did it.
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Kairos connects high school students with current undergraduates at top universities.
            Get personalized help with essays, test prep, and activities—from those who know what it takes.
          </p>

          {/* User type toggle */}
          <div className="mt-10 inline-flex rounded-full bg-secondary border border-border p-1">
            <button
              type="button"
              onClick={() => setUserType('student')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                userType === 'student'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              High School Student
            </button>
            <button
              type="button"
              onClick={() => setUserType('college')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                userType === 'college'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              College Student
            </button>
          </div>

          {/* Conditional content */}
          {userType === 'student' ? (
            <>
              {!submitted ? (
                <form
                  onSubmit={handleSubmit}
                  className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-md"
                >
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 h-12 px-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30 transition"
                  />
                  <button
                    type="submit"
                    className="h-12 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    Join Waitlist
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="mt-6 flex items-center gap-2 px-6 py-4 rounded-xl bg-accent/10 border border-accent/20">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span className="text-foreground">{"You're on the list! We'll be in touch soon."}</span>
                </div>
              )}
            </>
          ) : (
            <div className="mt-6">
              <Link
                href="/apply"
                className="inline-flex items-center gap-2 h-12 px-8 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Apply to Become a Tutor Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* iPhone app mockup */}
          <div className="mt-16 flex justify-center">
            <div className="relative">
              {/* iPhone frame */}
              <div className="relative w-[260px] h-[520px] rounded-[2.5rem] bg-foreground p-2.5 shadow-2xl shadow-foreground/20">
                {/* Dynamic Island */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-foreground rounded-full z-10" />

                {/* Screen — flex column so content fills height exactly */}
                <div className="relative rounded-[2rem] overflow-hidden bg-card h-full flex flex-col">

                  {/* Status bar */}
                  <div className="flex items-center justify-between px-5 pt-12 pb-2 flex-shrink-0">
                    <span className="text-[10px] font-medium text-foreground">9:41</span>
                    <div className="w-4 h-2 rounded-sm border border-foreground/70 flex items-center justify-end pr-0.5">
                      <div className="w-2.5 h-1 rounded-sm bg-foreground/70" />
                    </div>
                  </div>

                  {/* App content — grows to fill remaining space */}
                  <div className="flex-1 flex flex-col px-4 pb-3 min-h-0">

                    {/* App header */}
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Welcome back</p>
                        <h3 className="text-sm font-semibold text-foreground">Find Tutors</h3>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                        <GraduationCap className="w-3.5 h-3.5 text-accent" />
                      </div>
                    </div>

                    {/* Search bar */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border mb-3 flex-shrink-0">
                      <Sparkles className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">AI-powered matching...</span>
                    </div>

                    {/* Service tabs */}
                    <div className="flex gap-1.5 mb-3 flex-shrink-0">
                      <div className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30">
                        <span className="text-rose-500 text-[10px] font-medium">Essays</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-secondary border border-border">
                        <span className="text-muted-foreground text-[10px] font-medium">Test Prep</span>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-secondary border border-border">
                        <span className="text-muted-foreground text-[10px] font-medium">Activities</span>
                      </div>
                    </div>

                    {/* Tutor list — flex-1 fills remaining space */}
                    <div className="flex-1 flex flex-col justify-around min-h-0">
                      {tutors.slice(0, 3).map((tutor, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-secondary/50 border border-border"
                        >
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-[10px] flex-shrink-0">
                            {tutor.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-medium text-foreground">{tutor.school}</span>
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              <span className="text-[10px] text-foreground">{tutor.rating}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Essay specialist</p>
                          </div>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </div>
                      ))}
                    </div>

                    {/* Bottom nav */}
                    <div className="flex items-center justify-around pt-3 mt-3 border-t border-border flex-shrink-0">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-4 h-4 rounded bg-accent/20" />
                        <span className="text-[9px] text-accent font-medium">Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-4 h-4 rounded bg-muted" />
                        <span className="text-[9px] text-muted-foreground">Messages</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-4 h-4 rounded bg-muted" />
                        <span className="text-[9px] text-muted-foreground">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div className="absolute -inset-4 bg-accent/10 rounded-[4rem] blur-2xl -z-10" />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
