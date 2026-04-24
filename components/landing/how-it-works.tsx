'use client'

import { useEffect, useRef } from 'react'
import { Heart, Sun, Shield } from 'lucide-react'

const cards = [
  {
    icon: Heart,
    label: 'Pathos',
    title: 'Write compelling essays.',
    body: "Work with tutors who crafted winning essays. Get feedback on structure, voice, and authenticity from students who've been accepted to your dream schools.",
    iconBg: '#ECE7FC',
    iconColor: '#BDB0F5',
    stripe: 'linear-gradient(90deg, #BDB0F5, #9B86F0)',
    delay: 'reveal-delay-1',
  },
  {
    icon: Sun,
    label: 'Logos',
    title: 'Ace your standardized tests.',
    body: 'Our tutors share the techniques that helped them achieve top SAT & ACT scores. Data-driven prep, from people who actually used it.',
    iconBg: '#E5E0F6',
    iconColor: '#9B86F0',
    stripe: 'linear-gradient(90deg, #9B86F0, #7A62EA)',
    delay: 'reveal-delay-2',
  },
  {
    icon: Shield,
    label: 'Ethos',
    title: 'Build an impressive activities list.',
    body: 'Get guidance from students who stood out. Learn how to frame your experiences for maximum impact, from people admissions officers actually noticed.',
    iconBg: '#DDD8F2',
    iconColor: '#7A62EA',
    stripe: 'linear-gradient(90deg, #7A62EA, #6C52E0)',
    delay: 'reveal-delay-3',
  },
]

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const els = sectionRef.current?.querySelectorAll('.reveal')
    if (!els) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.12 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="bg-surface py-24 px-6 md:px-12" ref={sectionRef}>
      <div className="max-w-[1120px] mx-auto">
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-purple-soft mb-3 reveal">
          How It Works
        </div>
        <h2 className="text-[clamp(32px,4.5vw,52px)] font-bold leading-[1.1] tracking-tight text-ink max-w-[560px] reveal reveal-delay-1">
          A successful college application?<br />
          <em className="italic text-purple-soft">Think back to Aristotle.</em>
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {cards.map((card) => (
            <div
              key={card.label}
              className={`bg-white rounded-[20px] p-7 relative overflow-hidden reveal ${card.delay}`}
              style={{ boxShadow: '0 2px 4px rgba(28,27,31,.04), 0 8px 20px rgba(28,27,31,.07)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: card.stripe }} />
              <div
                className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-5"
                style={{ background: card.iconBg }}
              >
                <card.icon className="w-[26px] h-[26px]" style={{ color: card.iconColor }} />
              </div>
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-mute mb-2">
                {card.label}
              </div>
              <div className="text-[20px] font-bold text-ink mb-3 tracking-tight">
                {card.title}
              </div>
              <div className="text-[14px] leading-[1.65] text-graphite">
                {card.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
