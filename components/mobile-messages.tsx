'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, ArrowLeft, AlertCircle } from 'lucide-react'
import { MOBILE_GRAD, MOBILE_SH1 } from './mobile-shell'
import { getBrowserSupabase } from '@/lib/supabase-browser'

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
  conversation_id?: string | null
}

// Messages from the same sender within this window render as a single
// conjoined visual group (no avatar repeat, shared timestamp at the bottom).
const GROUP_WINDOW_MS = 60_000

function isGroupedWithPrev(curr: ApiMessage, prev: ApiMessage | null | undefined): boolean {
  if (!prev) return false
  if (prev.sender_id !== curr.sender_id) return false
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
  return diff >= 0 && diff < GROUP_WINDOW_MS
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
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Refs so the realtime effect can read the latest myIds / active without
  // re-subscribing every time a fetch returns a new array reference. Channel
  // thrash on the iOS WKWebView is the suspected cause of the WebKit
  // "this page couldn't load" page-process crash.
  const myIdsRef = useRef<string[]>([])
  const activeRef = useRef<{ id: string; name: string } | null>(null)
  useEffect(() => { myIdsRef.current = myIds }, [myIds])
  useEffect(() => { activeRef.current = active }, [active])

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
      setConversationId(null)
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
        setConversationId(d.conversationId ?? null)
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

  // Realtime: append inserts on this conversation as they arrive. De-dupe by
  // id since the sender already appended via the POST response. Deps are
  // intentionally just conversationId — the channel must outlive any fetch-
  // induced state changes; reading the latest myIds / active through refs
  // keeps the subscription stable for the lifetime of the open thread.
  useEffect(() => {
    if (!conversationId) return
    let supabase
    try {
      supabase = getBrowserSupabase()
    } catch {
      // Missing NEXT_PUBLIC_SUPABASE_* — render keeps working, live
      // updates just don't arrive. We don't want a render-time throw to
      // crash the page (the iOS WKWebView surfaces that as
      // "this page couldn't load").
      return
    }
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          const incoming = payload.payload as ApiMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
          setConversations((prev) => {
            const partnerId = activeRef.current?.id
            if (!partnerId) return prev
            const idx = prev.findIndex((c) => c.partner_id === partnerId)
            if (idx === -1) return prev
            const updated: ApiConversation = {
              ...prev[idx],
              last_message: incoming.content,
              last_message_at: incoming.created_at,
              last_message_is_mine: myIdsRef.current.includes(incoming.sender_id),
            }
            return [updated, ...prev.filter((_, i) => i !== idx)]
          })
        },
      )
      .subscribe((status, err) => {
        console.info('[mobile messages] realtime', status, conversationId, err)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

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
        // Reuse the resolved conversation when known; receiverId-only would
        // re-run find-or-create on every send and can fork a new thread.
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          receiverId: active.id,
          content: text,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to send')
      }
      const { message, conversationId: newConvId } = await res.json()
      if (message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
      }
      if (newConvId && newConvId !== conversationId) setConversationId(newConvId)
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
            messages.map((m, idx) => {
              const mine = isMine(m.sender_id)
              const prev = idx > 0 ? messages[idx - 1] : null
              const next = idx < messages.length - 1 ? messages[idx + 1] : null
              const groupedPrev = isGroupedWithPrev(m, prev)
              // Guard: next can be null for the last message in the thread.
              // Passing it as the `curr` arg used to crash the page with
              // "Cannot read properties of null (reading 'sender_id')".
              const groupedNext = next ? isGroupedWithPrev(next, m) : false
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-end',
                    flexDirection: mine ? 'row-reverse' : 'row',
                    marginTop: groupedPrev ? 2 : idx === 0 ? 0 : 14,
                  }}
                >
                  {groupedNext ? (
                    <div style={{ width: 26, flexShrink: 0 }} />
                  ) : (
                    <Avatar
                      initials={mine ? myInitials : initialsOf(active.name)}
                      color={mine ? avatarColor(myFullName || 'me') : avatarColor(active.id)}
                      src={mine ? myPhoto : null}
                      size={26}
                    />
                  )}
                  <div style={{ maxWidth: '78%' }}>
                    <div
                      style={{
                        padding: '9px 13px',
                        borderRadius: 16,
                        fontSize: 13,
                        lineHeight: 1.45,
                        background: mine ? MOBILE_GRAD : '#F1EFE9',
                        color: mine ? 'white' : '#1C1B1F',
                        borderBottomRightRadius: mine && !groupedNext ? 4 : 16,
                        borderBottomLeftRadius: !mine && !groupedNext ? 4 : 16,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </div>
                    {!groupedNext && (
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
                    )}
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
