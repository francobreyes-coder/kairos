'use client'

import * as React from 'react'
import Link from 'next/link'

const SIDEBAR_BG = '#2E2C34'
const GRAD = 'linear-gradient(135deg,#3C1EE0 0%,#7A3AE8 45%,#C93FD8 100%)'

const SidebarIcon = {
  home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  essay: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
  testing: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  activities: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  messages: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
  discover: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
}

export type SidebarItemId = 'home' | 'essays' | 'testing' | 'activities' | 'messages' | 'discover'

const ITEMS: { id: SidebarItemId; label: string; icon: () => React.ReactElement }[] = [
  { id: 'home', label: 'Home', icon: SidebarIcon.home },
  { id: 'essays', label: 'Essays', icon: SidebarIcon.essay },
  { id: 'testing', label: 'Testing', icon: SidebarIcon.testing },
  { id: 'activities', label: 'Activities', icon: SidebarIcon.activities },
  { id: 'messages', label: 'Messages', icon: SidebarIcon.messages },
  { id: 'discover', label: 'Discover', icon: SidebarIcon.discover },
]

export function StudentSidebar({
  activeId,
  initials,
  hasMessageBadge = false,
  onSelect,
  onSettingsClick,
  onProfileClick,
  profilePhotoUrl,
  isProfileActive = false,
}: {
  activeId: SidebarItemId | 'settings' | 'profile'
  initials: string
  hasMessageBadge?: boolean
  onSelect: (id: SidebarItemId) => void
  onSettingsClick: () => void
  onProfileClick?: () => void
  profilePhotoUrl?: string
  isProfileActive?: boolean
}) {
  return (
    <aside style={{
      width: 72, background: SIDEBAR_BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 0 24px', flexShrink: 0, zIndex: 10, gap: 4,
      height: '100vh',
    }}>
      <Link href="/home" style={{
        width: 40, height: 40, borderRadius: 12, background: GRAD,
        display: 'grid', placeItems: 'center', marginBottom: 28, flexShrink: 0,
        cursor: 'pointer', textDecoration: 'none',
      }}>
        <span style={{ fontFamily: '"Shrikhand",serif', color: 'white', fontSize: 22, lineHeight: 1 }}>k</span>
      </Link>

      {ITEMS.map((item) => {
        const active = activeId === item.id
        const showBadge = item.id === 'messages' && hasMessageBadge
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{
            width: 48, height: 48, borderRadius: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 4, border: 'none', position: 'relative',
            background: active ? 'rgba(122,98,234,0.28)' : 'transparent',
            transition: 'background .15s',
          }}>
            <div style={{ color: active ? '#BDB0F5' : 'rgba(255,255,255,0.45)' }}>{item.icon()}</div>
            <span style={{ fontSize: 9, fontWeight: 600, color: active ? '#BDB0F5' : 'rgba(255,255,255,0.35)', letterSpacing: '0.03em', lineHeight: 1 }}>{item.label}</span>
            {showBadge && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#E882CC', border: `1.5px solid ${SIDEBAR_BG}` }} />}
          </button>
        )
      })}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button onClick={onSettingsClick} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: activeId === 'settings' ? 'rgba(122,98,234,0.28)' : 'rgba(255,255,255,0.07)',
          color: activeId === 'settings' ? '#BDB0F5' : 'rgba(255,255,255,0.4)',
          display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'background .15s',
        }}>{SidebarIcon.settings()}</button>
        <button
          onClick={onProfileClick}
          aria-label="Edit profile"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: profilePhotoUrl ? 'transparent' : '#7A62EA',
            backgroundImage: profilePhotoUrl ? `url(${profilePhotoUrl})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            color: 'white',
            display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: 13,
            cursor: onProfileClick ? 'pointer' : 'default',
            border: isProfileActive
              ? '2px solid #BDB0F5'
              : '2px solid rgba(255,255,255,0.15)',
            padding: 0,
            overflow: 'hidden',
          }}
        >{profilePhotoUrl ? '' : initials}</button>
      </div>
    </aside>
  )
}
