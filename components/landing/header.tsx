'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Menu, X, LogOut } from 'lucide-react'

const navLinks = [
  { label: 'How It Works', target: 'how-it-works' },
  { label: 'Preview', target: 'preview' },
  { label: 'Why Kairos', target: 'why-kairos' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function UserAvatar({ name, image }: { name?: string | null; image?: string | null }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className="w-8 h-8 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
      <span className="text-xs font-medium text-accent">{initials}</span>
    </div>
  )
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { data: session } = useSession()

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
              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontStyle: 'italic' }}
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

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scrollTo('cta')}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Join Waitlist
            </button>

            {session ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="rounded-full ring-2 ring-transparent hover:ring-accent/30 transition-all"
                >
                  <UserAvatar name={session.user?.name} image={session.user?.image} />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-card border border-border shadow-lg z-50 py-1">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground truncate">{session.user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                      </div>
                      <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Sign In
              </Link>
            )}
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
            {session ? (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <UserAvatar name={session.user?.name} image={session.user?.image} />
                  <span className="text-sm text-foreground truncate">{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
