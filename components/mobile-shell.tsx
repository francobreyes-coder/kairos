'use client'

import * as React from 'react'

// ─── Design tokens (kept inline so this matches mobile/*.html exactly) ──
export const MOBILE_GRAD = 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)'
export const MOBILE_GRAD_SOFT = 'linear-gradient(135deg,#82AAEE 0%,#B47AE8 52%,#E882CC 100%)'
export const MOBILE_SH1 = '0 1px 2px rgba(28,27,31,.04),0 2px 6px rgba(28,27,31,.05)'
export const MOBILE_SH2 = '0 2px 4px rgba(28,27,31,.04),0 8px 20px rgba(28,27,31,.07)'

const Icon = {
  bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  ),
  home: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  search: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  calendar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  dollar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ),
  msg: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
  profile: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
  ),
}

export const MobileIcons = Icon

export function MobileAppBar({ hasNotifDot = false }: { hasNotifDot?: boolean }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px 10px',
        background: '#F7F5F0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: MOBILE_GRAD,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span style={{ fontFamily: '"Shrikhand",serif', color: 'white', fontSize: 18, lineHeight: 1 }}>k</span>
        </div>
        <span style={{ fontFamily: '"Shrikhand",serif', fontSize: 20, color: '#1C1B1F' }}>kairos</span>
      </div>
      <div
        aria-label="Notifications"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: '1.5px solid #E6E3E8',
          background: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          color: '#5A5862',
          position: 'relative',
        }}
      >
        <Icon.bell />
        {hasNotifDot && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#E882CC',
              border: '1.5px solid #FFFFFF',
            }}
          />
        )}
      </div>
    </header>
  )
}

export type MobileTabId =
  | 'home'
  | 'tutors'
  | 'sessions'
  | 'earnings'
  | 'messages'
  | 'profile'

export interface MobileTabItem {
  id: MobileTabId
  label: string
  icon: 'home' | 'search' | 'calendar' | 'dollar' | 'msg' | 'profile'
  badge?: boolean
}

export function MobileTabBar({
  items,
  activeId,
  onSelect,
}: {
  items: MobileTabItem[]
  activeId: MobileTabId
  onSelect: (id: MobileTabId) => void
}) {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid #E6E3E8',
        padding: '8px 6px 22px',
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId
        const IconCmp = Icon[item.icon]
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 0',
              cursor: 'pointer',
              position: 'relative',
              color: active ? '#6C52E0' : '#8A8792',
              background: 'transparent',
              border: 'none',
              fontFamily: 'inherit',
            }}
            aria-current={active ? 'page' : undefined}
          >
            <IconCmp />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.01em' }}>{item.label}</span>
            {item.badge && (
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 'calc(50% - 18px)',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#E882CC',
                }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// Wrapper applied to the page body when in mobile mode. Resets the global
// height:100vh / overflow:hidden the dashboard pages set so the page scrolls
// naturally and the fixed tab bar sits over it.
export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { height: auto !important; overflow: visible !important; }
        body { background: #F7F5F0; padding-bottom: 84px; }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          background: '#F7F5F0',
          color: '#1C1B1F',
          fontFamily: 'var(--font-montserrat), system-ui, sans-serif',
        }}
      >
        {children}
      </div>
    </>
  )
}
