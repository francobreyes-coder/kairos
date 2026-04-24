'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut, UserCircle, LayoutDashboard, MessageSquare } from 'lucide-react'

const navLinks: { label: string; target?: string; href?: string }[] = [
  { label: 'How It Works', target: 'how-it-works' },
  { label: 'Find Tutors', href: '/find-tutors' },
]

function scrollTo(id: string, pathname: string, router: ReturnType<typeof useRouter>) {
  if (pathname === '/home' || pathname === '/') {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  } else {
    router.push(`/home#${id}`)
  }
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
  const [scrolled, setScrolled] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [profileHref, setProfileHref] = useState('/tutor/profile')
  const [isTutor, setIsTutor] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/tutor/profile')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then(({ profile, application, hasApplication }) => {
        if (application || profile || hasApplication) {
          setProfileHref('/tutor/profile')
          setIsTutor(true)
        } else {
          setProfileHref('/find-tutors')
          setIsTutor(false)
        }
        if (profile?.profile_photo) {
          setProfilePhoto(`/api/storage?path=${encodeURIComponent(profile.profile_photo)}`)
        }
      })
      .catch(() => {
        // Default to tutor profile on error
        setProfileHref('/tutor/profile')
      })
  }, [session?.user?.id])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-[16px] transition-all duration-300 ${
        scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
      }`}
      style={{ background: 'rgba(247,245,240,0.88)' }}
    >
      <nav className="mx-auto max-w-6xl px-6 md:px-12 h-16 flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2.5 z-10">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 45%, #C93FD8 100%)' }}
            >
              <span className="font-display text-white text-xl leading-none">k</span>
            </div>
            <span className="font-display text-[22px] text-ink tracking-tight select-none">
              kairos
            </span>
          </Link>

          {/* Desktop nav — absolutely centered */}
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) =>
              link.href ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.target!, pathname, router)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  {link.label}
                </button>
              )
            )}
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-2.5 z-10">
            <button
              onClick={() => scrollTo('cta', pathname, router)}
              className="px-5 py-2 rounded-full bg-ink text-white text-[13px] font-semibold hover:opacity-85 transition-opacity"
            >
              Join Waitlist
            </button>

            {session ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="rounded-full ring-2 ring-transparent hover:ring-accent/30 transition-all"
                >
                  <UserAvatar name={session.user?.name} image={profilePhoto || session.user?.image} />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-card border border-border shadow-lg z-50 py-1">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground truncate">{session.user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                      </div>
                      <Link
                        href={profileHref}
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <UserCircle className="w-4 h-4" />
                        View Profile
                      </Link>
                      {isTutor && (
                        <Link
                          href="/tutor/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Tutor Dashboard
                        </Link>
                      )}
                      <Link
                        href="/sessions"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <UserCircle className="w-4 h-4" />
                        My Sessions
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Messages
                      </Link>
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
                className="px-5 py-2 rounded-full bg-purple text-white text-[13px] font-semibold hover:opacity-85 transition-opacity"
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

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 flex flex-col gap-4">
            {navLinks.map((link) =>
              link.href ? (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.label}
                  onClick={() => { scrollTo(link.target!, pathname, router); setMobileMenuOpen(false) }}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  {link.label}
                </button>
              )
            )}
            <button
              onClick={() => { scrollTo('cta', pathname, router); setMobileMenuOpen(false) }}
              className="px-5 py-2 rounded-full bg-ink text-white text-[13px] font-semibold text-center mt-2"
            >
              Join Waitlist
            </button>
            {session ? (
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-center gap-2">
                  <UserAvatar name={session.user?.name} image={profilePhoto || session.user?.image} />
                  <span className="text-sm text-foreground truncate">{session.user?.name}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <Link
                    href={profileHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm text-accent hover:text-accent/80 font-medium"
                  >
                    View Profile
                  </Link>
                  {isTutor && (
                    <Link
                      href="/tutor/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-sm text-accent hover:text-accent/80 font-medium"
                    >
                      Dashboard
                    </Link>
                  )}
                  <Link
                    href="/sessions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm text-accent hover:text-accent/80 font-medium"
                  >
                    My Sessions
                  </Link>
                  <Link
                    href="/messages"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm text-accent hover:text-accent/80 font-medium"
                  >
                    Messages
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="px-5 py-2 rounded-full bg-purple text-white text-[13px] font-semibold text-center"
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
