'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import {
  COMMON_TIMEZONES,
  getBrowserTimezone,
  getTimezoneAbbreviation,
  getViewerTimezone,
  setViewerTimezone,
  shortTimezoneLabel,
} from '@/lib/timezone'

interface Props {
  /** Called when the viewer changes their preferred display tz. */
  onChange?: (tz: string) => void
  /** Optional short prefix label, e.g. "Times in". */
  label?: string
  className?: string
}

/**
 * Chip + dropdown letting the viewer pick the timezone in which times are
 * displayed. Defaults to the browser tz; override persists in localStorage
 * so it survives reloads.
 */
export function TimezoneSelector({ onChange, label = 'Times in', className }: Props) {
  const [tz, setTz] = useState<string>(() => getViewerTimezone())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const browserTz = getBrowserTimezone()

  // Sync once on mount in case SSR rendered the default.
  useEffect(() => {
    setTz(getViewerTimezone())
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function choose(nextTz: string, isDefault: boolean) {
    setViewerTimezone(isDefault ? null : nextTz)
    setTz(nextTz)
    setOpen(false)
    onChange?.(nextTz)
  }

  // Merge browser tz into the list if it's not already there so users always
  // see "my timezone" as an option.
  const items = COMMON_TIMEZONES.some((t) => t.id === browserTz)
    ? COMMON_TIMEZONES
    : [{ id: browserTz, label: `${shortTimezoneLabel(browserTz)} (browser)` }, ...COMMON_TIMEZONES]

  return (
    <div ref={ref} className={`relative inline-block ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-xs text-foreground transition-colors"
      >
        <Globe className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{getTimezoneAbbreviation(tz)} · {shortTimezoneLabel(tz)}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1">
          <button
            type="button"
            onClick={() => choose(browserTz, true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-muted transition-colors"
          >
            <span>
              <span className="font-medium">My device</span>
              <span className="ml-1 text-xs text-muted-foreground">{shortTimezoneLabel(browserTz)}</span>
            </span>
            {tz === browserTz && <Check className="w-3.5 h-3.5 text-accent" />}
          </button>
          <div className="my-1 border-t border-border" />
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id, false)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-muted transition-colors"
            >
              <span className="truncate">{t.label}</span>
              {tz === t.id && <Check className="w-3.5 h-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
