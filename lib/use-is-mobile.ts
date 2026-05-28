'use client'

import { useEffect, useState } from 'react'

// Mobile = iPhone-class viewport: anything 640px wide or narrower.
// SSR returns false so server markup matches the desktop layout; the hook
// flips to true after mount on small screens.
const MOBILE_QUERY = '(max-width: 640px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}
