'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_TIMEZONE, getViewerTimezone, subscribeToViewerTimezone } from './timezone'

/**
 * React hook returning the viewer's effective display timezone (browser +
 * localStorage override). Stays in sync when any TimezoneSelector elsewhere
 * on the page changes the override.
 *
 * Returns DEFAULT_TIMEZONE during SSR and on the very first client render
 * (before useEffect runs) so server/client output match.
 */
export function useViewerTimezone(): string {
  const [tz, setTz] = useState<string>(DEFAULT_TIMEZONE)

  useEffect(() => {
    const update = () => setTz(getViewerTimezone())
    update()
    return subscribeToViewerTimezone(update)
  }, [])

  return tz
}
