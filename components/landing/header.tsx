'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'How It Works', target: 'how-it-works' },
  { label: 'Preview', target: 'preview' },
  { label: 'Why Kairos', target: 'why-kairos' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-400 flex items-center justify-center shadow-sm flex-shrink-0">
              <span
                className="text-white text-xl leading-none select-none"
                style={{ fontFamily: 'var(--font-playfair)', fontWeight: 900, fontStyle: 'italic', textShadow: '1px 1.5px 3px rgba(180,140,220,0.55)' }}
              >
                k
              </span>
            </div>
            <span
              className="text-xl leading-none text-foreground select-none"
              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontStyle: 'italic', textShadow: '2px 2px 0px rgba(0,0,0,0.12)' }}
            >
              kairos
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.target)}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <button
              onClick={() => scrollTo('cta')}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Join Waitlist
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 flex flex-col gap-4">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => { scrollTo(link.target); setMobileMenuOpen(false) }}
                className="text-left text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => { scrollTo('cta'); setMobileMenuOpen(false) }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mt-2"
            >
              Join Waitlist
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
