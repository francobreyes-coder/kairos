'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowDown } from 'lucide-react'

export function CTA() {
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
    <section
      id="cta"
      ref={sectionRef}
      className="py-24 px-6 md:px-12 relative overflow-hidden text-center"
      style={{ background: 'linear-gradient(135deg, #82AAEE 0%, #B47AE8 52%, #E882CC 100%)' }}
    >
      {/* Radial overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />

      {/* Background watermark */}
      <div className="font-display absolute bottom-[-20px] right-10 text-[clamp(72px,12vw,160px)] text-white/15 leading-none pointer-events-none select-none">
        k
      </div>

      <h2 className="font-display text-[clamp(36px,6vw,80px)] text-white leading-[1.1] max-w-[700px] mx-auto mb-9 reveal relative z-10">
        Ready to get started?
      </h2>

      <Link
        href="/find-tutors"
        className="inline-flex items-center gap-2 px-9 py-4 rounded-full bg-white text-purple font-bold text-[15px] no-underline hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] active:scale-[0.98] transition-all reveal reveal-delay-1 relative z-10"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
      >
        <ArrowDown className="w-4 h-4" />
        Browse Tutors
      </Link>
    </section>
  )
}
