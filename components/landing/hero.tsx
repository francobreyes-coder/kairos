'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { submitWaitlist } from '@/app/actions'

export function Hero() {
  const [role, setRole] = useState<'hs' | 'cs'>('hs')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    await submitWaitlist(email, role === 'hs' ? 'student' : 'tutor')
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <section
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-[120px] pb-20 relative overflow-hidden transition-colors duration-700"
      style={{ background: 'linear-gradient(135deg, #82AAEE 0%, #B47AE8 52%, #E882CC 100%)' }}
      id="hero"
    >
      {/* Decorative orbs */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full pointer-events-none opacity-25" style={{ background: '#ffffff', filter: 'blur(80px)' }} />
      <div className="absolute bottom-[-150px] left-[-80px] w-[500px] h-[500px] rounded-full pointer-events-none opacity-25" style={{ background: '#3C1EE0', filter: 'blur(80px)' }} />

      {/* Toggle */}
      <div
        className="inline-flex items-center rounded-full p-1 border border-white/25 z-10"
        style={{ background: 'rgba(255,255,255,0.18)', animation: 'fadeUp 0.5s cubic-bezier(.2,.0,.0,1) 0.15s both' }}
      >
        <button
          onClick={() => setRole('hs')}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
            role === 'hs' ? 'bg-white text-purple-soft' : 'bg-transparent text-white/80 hover:text-white'
          }`}
        >
          High School Student
        </button>
        <button
          onClick={() => setRole('cs')}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
            role === 'cs' ? 'bg-white text-purple-soft' : 'bg-transparent text-white/80 hover:text-white'
          }`}
        >
          College Student
        </button>
      </div>

      {/* Panels wrapper */}
      <div className="relative w-full flex flex-col items-center mt-0">
        {/* HS Panel */}
        <div
          className={`flex flex-col items-center w-full max-w-[860px] transition-all duration-400 ${
            role === 'hs'
              ? 'opacity-100 translate-y-0 relative'
              : 'opacity-0 translate-y-4 pointer-events-none absolute top-0 left-1/2 -translate-x-1/2'
          }`}
          style={role === 'hs' ? { animation: 'fadeUp 0.6s cubic-bezier(.2,.0,.0,1) 0.3s both' } : undefined}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/25 mt-8 mb-7 text-[13px] font-medium text-white" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}>
            <span className="w-[7px] h-[7px] rounded-full bg-[#4AFA8F]" />
            Coming Soon to iOS
          </div>
          <h1 className="font-display text-[clamp(52px,8vw,96px)] leading-[1.05] text-white max-w-[820px]">
            Learn from students<br />who just did it.
          </h1>
          <p className="text-[clamp(15px,1.8vw,18px)] leading-[1.65] text-white/88 max-w-[520px] mt-5">
            Kairos connects high school students with current undergraduates at top universities. Get personalized help with essays, test prep, and activities—from those who know what it takes.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex gap-2.5 mt-7 flex-wrap justify-center">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-[52px] w-[280px] rounded-[14px] border-none px-5 text-sm bg-white text-ink placeholder:text-mute outline-none focus:shadow-[0_0_0_3px_rgba(255,255,255,0.4)]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-[52px] px-7 rounded-[14px] border-none bg-ink text-white text-sm font-bold flex items-center gap-2 hover:opacity-85 active:scale-[0.98] transition-all"
              >
                {submitting ? 'Submitting…' : 'Join Waitlist →'}
              </button>
            </form>
          ) : (
            <div className="mt-7 flex items-center gap-2 px-6 py-4 rounded-xl bg-white/15 border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="text-white">{"You're on the list! We'll be in touch soon."}</span>
            </div>
          )}

          {/* Student phone mockup */}
          <div className="mt-[52px] relative z-[1]" style={{ animation: 'fadeUp 0.8s cubic-bezier(.2,.0,.0,1) 0.7s both' }}>
            <div className="w-[260px] rounded-[40px] p-3 mx-auto" style={{ background: '#111', boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' }}>
              <div className="rounded-[30px] overflow-hidden flex flex-col" style={{ background: '#1A1A2E', aspectRatio: '9/19' }}>
                <div className="w-[110px] h-7 mx-auto rounded-b-[20px]" style={{ background: '#111' }} />
                <div className="p-3 px-4 flex-1">
                  <div className="text-[11px] font-medium text-white/50">Hey, Alex</div>
                  <div className="text-[18px] font-bold text-white leading-[1.25] mt-1">Ready to move forward? Your next session is coming up.</div>
                  <div className="rounded-2xl p-3 mt-3" style={{ background: 'linear-gradient(135deg, #6C52E0, #C93FD8)' }}>
                    <div className="text-[9px] font-semibold tracking-[0.1em] text-white/60 uppercase mb-2">Next Session</div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>MH</div>
                      <div className="flex-1">
                        <div className="text-[12px] font-bold text-white">Michael Haskins</div>
                        <div className="text-[10px] text-white/70">Essay Writing</div>
                      </div>
                      <div className="text-[11px] text-white font-semibold text-right">Tomorrow<br /><span className="text-[9px] opacity-80">4:30 PM</span></div>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <div className="flex-1 py-[7px] rounded-full border border-white/30 text-[10px] font-semibold text-white text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>Join</div>
                      <div className="flex-1 py-[7px] rounded-full border border-white/30 text-[10px] font-semibold text-white text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>Message</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-white mt-3.5 mb-2">Get help with</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <div className="px-3 py-1.5 rounded-full border border-white/12 text-[10px] text-white/80 font-medium" style={{ background: 'rgba(255,255,255,0.07)' }}>Essays</div>
                    <div className="px-3 py-1.5 rounded-full border border-white/12 text-[10px] text-white/80 font-medium" style={{ background: 'rgba(255,255,255,0.07)' }}>Test Prep</div>
                    <div className="px-3 py-1.5 rounded-full border border-white/12 text-[10px] text-white/80 font-medium" style={{ background: 'rgba(255,255,255,0.07)' }}>Activities</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CS Panel */}
        <div
          className={`flex flex-col items-center w-full max-w-[860px] transition-all duration-400 ${
            role === 'cs'
              ? 'opacity-100 translate-y-0 relative'
              : 'opacity-0 translate-y-4 pointer-events-none absolute top-0 left-1/2 -translate-x-1/2'
          }`}
          style={role === 'cs' ? { animation: 'fadeUp 0.6s cubic-bezier(.2,.0,.0,1) 0.1s both' } : undefined}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/25 mt-8 mb-7 text-[13px] font-medium text-white" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}>
            Become a tutor today
          </div>
          <h1 className="font-display text-[clamp(52px,8vw,96px)] leading-[1.05] text-white max-w-[820px]">
            Market your expertise.<br />Earn on your terms.
          </h1>
          <p className="text-[clamp(15px,1.8vw,18px)] leading-[1.65] text-white/88 max-w-[520px] mt-5">
            Turn your college experience into income. Set your own schedule, choose your specialties, and help the next class succeed.
          </p>

          <div className="flex gap-2.5 mt-7 flex-wrap justify-center">
            <Link
              href="/apply"
              className="h-[52px] px-7 rounded-[14px] border-none bg-white text-purple-soft text-sm font-bold flex items-center gap-2 hover:opacity-85 active:scale-[0.98] transition-all no-underline"
            >
              Apply as Tutor →
            </Link>
          </div>

          {/* Tutor dashboard phone mockup */}
          <div className="mt-[52px] relative z-[1]" style={{ animation: 'fadeUp 0.8s cubic-bezier(.2,.0,.0,1) 0.5s both' }}>
            <div className="w-[260px] rounded-[40px] p-3 mx-auto" style={{ background: '#111', boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' }}>
              <div className="rounded-[30px] overflow-hidden flex flex-col" style={{ background: '#1A1A2E', aspectRatio: '9/19' }}>
                <div className="w-[110px] h-7 mx-auto rounded-b-[20px]" style={{ background: '#111' }} />
                <div className="p-3 px-4 flex-1">
                  <div className="text-[11px] font-medium text-white/50">Hey, Michael</div>
                  <div className="text-[18px] font-bold text-white leading-[1.25] mt-1">Your tutoring dashboard.</div>
                  {/* Earnings card */}
                  <div className="rounded-[14px] p-3 mt-2.5" style={{ background: 'linear-gradient(135deg, #6C52E0, #C93FD8)' }}>
                    <div className="text-[9px] font-semibold tracking-[0.1em] text-white/60 uppercase mb-1.5">This Month</div>
                    <div className="text-[22px] font-bold text-white leading-none">$340</div>
                    <div className="text-[10px] text-white/70 mt-0.5">17 sessions · 4.9 ★</div>
                    <div className="flex gap-1.5 mt-2.5">
                      <div className="flex-1 py-1.5 rounded-full border border-white/30 text-[9px] font-semibold text-white text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>Withdraw</div>
                      <div className="flex-1 py-1.5 rounded-full border border-white/30 text-[9px] font-semibold text-white text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>Schedule</div>
                    </div>
                  </div>
                  {/* Upcoming */}
                  <div className="text-[10px] font-bold text-white mt-3.5 mb-2">Upcoming Sessions</div>
                  <div className="flex flex-col gap-[7px]">
                    <div className="flex items-center gap-2 rounded-[10px] px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: '#9B86F0' }}>AJ</div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-white">Alex Johnson</div>
                        <div className="text-[9px] text-white/60">Essay Writing</div>
                      </div>
                      <div className="text-[9px] text-white/70 font-semibold">Today 5pm</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-[10px] px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: '#B47AE8' }}>SR</div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-white">Sam Rivera</div>
                        <div className="text-[9px] text-white/60">Common App</div>
                      </div>
                      <div className="text-[9px] text-white/70 font-semibold">Fri 3pm</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[12px] font-medium tracking-[0.08em] uppercase flex flex-col items-center gap-2" style={{ animation: 'bob 2s ease-in-out infinite' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 4v12M4 10l6 6 6-6" />
        </svg>
        scroll
      </div>
    </section>
  )
}
