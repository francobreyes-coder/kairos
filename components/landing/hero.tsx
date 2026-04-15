'use client'

import { useState } from 'react'
import { ArrowRight, Sparkles, Star, GraduationCap } from 'lucide-react'

const tutors = [
  { initials: 'JL', school: 'Harvard', rating: 5.0 },
  { initials: 'SM', school: 'Stanford', rating: 4.9 },
  { initials: 'AK', school: 'Yale', rating: 5.0 },
  { initials: 'RD', school: 'MIT', rating: 4.8 },
]

export function Hero() {
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

          {/* Email waitlist */}
          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-md"
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
            <div className="mt-10 flex items-center gap-2 px-6 py-4 rounded-xl bg-accent/10 border border-accent/20">
              <Sparkles className="w-5 h-5 text-accent" />
              <span className="text-foreground">{"You're on the list! We'll be in touch soon."}</span>
            </div>
          )}

          {/* iPhone app mockup */}
          <div className="mt-16 flex justify-center">
            <div className="relative">
              {/* iPhone frame */}
              <div className="relative w-[260px] rounded-[2.5rem] bg-foreground p-2.5 shadow-2xl shadow-foreground/20">
                {/* Dynamic Island */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-foreground rounded-full z-10" />

                {/* Screen */}
                <div className="relative rounded-[2rem] overflow-hidden bg-card">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-6 pt-14 pb-3 bg-card">
                    <span className="text-xs font-medium text-foreground">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-2.5 rounded-sm border border-foreground flex items-center justify-end pr-0.5">
                        <div className="w-2 h-1.5 rounded-sm bg-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* App content */}
                  <div className="px-4 pb-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Welcome back</p>
                        <h3 className="text-base font-semibold text-foreground">Find Tutors</h3>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-accent" />
                      </div>
                    </div>

                    {/* Search bar */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-border mb-4">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">AI-powered matching...</span>
                    </div>

                    {/* Service tabs */}
                    <div className="flex gap-2 mb-4">
                      <div className="px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30">
                        <span className="text-rose-500 text-xs font-medium">Essays</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-secondary border border-border">
                        <span className="text-muted-foreground text-xs font-medium">Test Prep</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-secondary border border-border">
                        <span className="text-muted-foreground text-xs font-medium">Activities</span>
                      </div>
                    </div>

                    {/* Tutor list */}
                    <div className="space-y-3">
                      {tutors.slice(0, 3).map((tutor, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border"
                        >
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-xs flex-shrink-0">
                            {tutor.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground">{tutor.school}</span>
                              <div className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span className="text-xs text-foreground">{tutor.rating}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Essay specialist</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      ))}
                    </div>

                    {/* Bottom nav */}
                    <div className="flex items-center justify-around mt-6 pt-4 border-t border-border">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-5 h-5 rounded bg-accent/20" />
                        <span className="text-[10px] text-accent font-medium">Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-5 h-5 rounded bg-muted" />
                        <span className="text-[10px] text-muted-foreground">Messages</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-5 h-5 rounded bg-muted" />
                        <span className="text-[10px] text-muted-foreground">Profile</span>
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
