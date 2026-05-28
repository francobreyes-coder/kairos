'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, ArrowLeft, AlertCircle } from 'lucide-react'
import { MOBILE_GRAD, MOBILE_SH1 } from './mobile-shell'

interface ApiConversation {
  partner_id: string
  partner_name: string
  last_message: string
  last_message_at: string
  last_message_is_mine: boolean
}

interface ApiMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

const AVATAR_PALETTE = ['#6C52E0', '#7A62EA', '#9B86F0', '#B47AE8', '#8177C9', '#7A3AE8', '#BDB0F5', '#5B24CC']
function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatStamp(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return t
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${t}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`
}

export function MobileMessages({
  myFullName,
  myPhoto = null,
  partnerLabel = 'Conversations',
  initialPartnerId = null,
}: {
  myFullName: string
  myPhoto?: string | null
  partnerLabel?: string
  initialPartnerId?: string | null
}) {
  const [conversations, setConversations] = useState<ApiConversation[]>([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [active, setActive] = useState<{ id: string; name: string } | null>(null)
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const myInitials = initialsOf(myFullName || 'You')

  // Load conversations once on mount, then jump straight into the requested
  // partner thread if the parent passed one.
  useEffect(() => {
    fetch('/api/messages')
      .then((r) => r.json())
      .then((d) => {
        const convos: ApiConversation[] = d.conversations ?? []
        setConversations(convos)
        if (d.myIds) setMyIds(d.myIds)
        if (initialPartnerId) {
          const match = convos.find((c) => c.partner_id === initialPartnerId)
          if (match) setActive({ id: match.partner_id, name: match.partner_name })
        }
      })
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoadingConvos(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active) {
      setMessages([])
      return
    }
    let cancelled = false
    setLoadingThread(true)
    setError(null)
    fetch(`/api/messages?with=${encodeURIComponent(active.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setMessages(d.messages ?? [])
        if (d.myIds) setMyIds(d.myIds)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load thread')
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text || !active || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: active.id, content: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to send')
      }
      const { message } = await res.json()
      if (message) setMessages((prev) => [...prev, message])
      setDraft('')
      setConversations((prev) => {
        const next = prev.filter((c) => c.partner_id !== active.id)
        return [
          {
            partner_id: active.id,
            partner_name: active.name,
            last_message: text,
            last_message_at: new Date().toISOString(),
            last_message_is_mine: true,
          },
          ...next,
        ]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const isMine = (senderId: string) => (myIds.length > 0 ? myIds.includes(senderId) : false)

  // ── THREAD VIEW ─────────────────────────────────────────────────────
  if (active) {
    return (
      <div style={{ padding: '0 0 12px' }}>
        <ThreadHeader name={active.name} id={active.id} onBack={() => setActive(null)} />
        <div
          ref={bodyRef}
          style={{
            background: '#FFFFFF',
            margin: '0 16px',
            borderRadius: 16,
            boxShadow: MOBILE_SH1,
            minHeight: 280,
            maxHeight: 'calc(100vh - 280px)',
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {loadingThread ? (
            <div style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
              <Loader2 size={20} className="animate-spin" color="#7A3AE8" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8A8792', textAlign: 'center', padding: 24 }}>
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((m) => {
              const mine = isMine(m.sender_id)
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-end',
                    flexDirection: mine ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    initials={mine ? myInitials : initialsOf(active.name)}
                    color={mine ? avatarColor(myFullName || 'me') : avatarColor(active.id)}
                    src={mine ? myPhoto : null}
                    size={26}
                  />
                  <div style={{ maxWidth: '78%' }}>
                    <div
                      style={{
                        padding: '9px 13px',
                        borderRadius: 16,
                        fontSize: 13,
                        lineHeight: 1.45,
                        background: mine ? MOBILE_GRAD : '#F1EFE9',
                        color: mine ? 'white' : '#1C1B1F',
                        borderBottomRightRadius: mine ? 4 : 16,
                        borderBottomLeftRadius: mine ? 16 : 4,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#8A8792',
                        marginTop: 4,
                        textAlign: mine ? 'right' : 'left',
                      }}
                    >
                      {formatStamp(m.created_at)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {error && (
          <div
            style={{
              margin: '8px 16px 0',
              padding: 8,
              background: '#FDE7E7',
              color: '#B12727',
              fontSize: 12,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div
          style={{
            position: 'sticky',
            bottom: 84,
            zIndex: 5,
            margin: '12px 16px 0',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            background: '#F7F5F0',
            paddingTop: 4,
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={`Message ${active.name.split(' ')[0]}…`}
            style={{
              flex: 1,
              minHeight: 42,
              maxHeight: 110,
              borderRadius: 12,
              border: '1.5px solid #E6E3E8',
              background: '#FFFFFF',
              padding: '11px 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              color: '#1C1B1F',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: 'none',
              cursor: !draft.trim() || sending ? 'not-allowed' : 'pointer',
              background: MOBILE_GRAD,
              color: 'white',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(122,58,232,0.3)',
              opacity: !draft.trim() || sending ? 0.5 : 1,
            }}
            aria-label="Send"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 16px 8px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#8A8792',
          padding: '6px 2px 10px',
        }}
      >
        {partnerLabel}
      </div>
      <div style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: MOBILE_SH1, padding: '4px 16px' }}>
        {loadingConvos ? (
          <div style={{ padding: 32, display: 'grid', placeItems: 'center' }}>
            <Loader2 size={20} className="animate-spin" color="#7A3AE8" />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '24px 4px', fontSize: 13, color: '#8A8792', textAlign: 'center' }}>
            No conversations yet. They&apos;ll show up here once a message is exchanged.
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.partner_id}
              onClick={() => setActive({ id: c.partner_id, name: c.partner_name })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid #E6E3E8',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Avatar initials={initialsOf(c.partner_name)} color={avatarColor(c.partner_id)} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1B1F' }}>{c.partner_name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#8A8792',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.last_message_is_mine ? 'You: ' : ''}
                  {c.last_message}
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#8A8792', flexShrink: 0 }}>{relativeTime(c.last_message_at)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function ThreadHeader({ name, id, onBack }: { name: string; id: string; onBack: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px 14px',
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: '1.5px solid #E6E3E8',
          background: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          color: '#5A5862',
          cursor: 'pointer',
        }}
      >
        <ArrowLeft size={18} />
      </button>
      <Avatar initials={initialsOf(name)} color={avatarColor(id)} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1B1F' }}>{name}</div>
      </div>
    </div>
  )
}

function Avatar({
  initials,
  color,
  size = 40,
  src = null,
}: {
  initials: string
  color: string
  size?: number
  src?: string | null
}) {
  if (src) {
    return (
      <img
        src={src.startsWith('/api/') || src.startsWith('http') ? src : `/api/storage?path=${encodeURIComponent(src)}`}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: color,
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}
