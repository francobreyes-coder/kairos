'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { Header } from '@/components/landing/header'
import {
  MessageSquare,
  Send,
  Loader2,
  ArrowLeft,
  User,
  AlertCircle,
} from 'lucide-react'

interface Conversation {
  partner_id: string
  partner_name: string
  last_message: string
  last_message_at: string
  last_message_is_mine: boolean
}

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatMessageDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function MessagesContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialWith = searchParams.get('with')
  const initialName = searchParams.get('name')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [myIds, setMyIds] = useState<string[]>([])
  const [activePartner, setActivePartner] = useState<{ id: string; name: string } | null>(
    initialWith && initialName ? { id: initialWith, name: initialName } : null
  )
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  // Load conversations
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/messages')
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations ?? [])
        if (data.myIds) setMyIds(data.myIds)
      })
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoadingConvos(false))
  }, [status])

  // Load messages when partner changes
  useEffect(() => {
    if (!activePartner) return
    setLoadingMessages(true)
    setError(null)
    fetch(`/api/messages?with=${activePartner.id}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? [])
        if (data.myIds) setMyIds(data.myIds)
      })
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoadingMessages(false))
  }, [activePartner?.id])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isMine = useCallback(
    (senderId: string) => {
      if (myIds.length > 0) return myIds.includes(senderId)
      return senderId === session?.user?.id
    },
    [myIds, session?.user?.id]
  )

  async function handleSend() {
    if (!draft.trim() || !activePartner || sending) return
    setSending(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: activePartner.id,
          content: draft.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      const { message } = await res.json()
      setMessages((prev) => [...prev, message])
      setDraft('')

      // Update conversation list
      setConversations((prev) => {
        const existing = prev.find((c) => c.partner_id === activePartner.id)
        if (existing) {
          return prev
            .map((c) =>
              c.partner_id === activePartner.id
                ? { ...c, last_message: draft.trim(), last_message_at: new Date().toISOString(), last_message_is_mine: true }
                : c
            )
            .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
        } else {
          return [
            {
              partner_id: activePartner.id,
              partner_name: activePartner.name,
              last_message: draft.trim(),
              last_message_at: new Date().toISOString(),
              last_message_is_mine: true,
            },
            ...prev,
          ]
        }
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function selectPartner(id: string, name: string) {
    setActivePartner({ id, name })
    setMessages([])
  }

  if (status === 'loading') {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        </main>
      </>
    )
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const dateStr = new Date(msg.created_at).toDateString()
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && new Date(lastGroup.messages[0].created_at).toDateString() === dateStr) {
      lastGroup.messages.push(msg)
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] })
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-6 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground mb-6">Messages</h1>

          <div className="rounded-2xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="flex h-full">
              {/* Conversation list */}
              <div className={`w-full sm:w-80 border-r border-border flex flex-col ${activePartner ? 'hidden sm:flex' : 'flex'}`}>
                <div className="p-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Conversations
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loadingConvos ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 text-accent animate-spin" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No conversations yet. Send a message to a tutor from their profile!
                      </p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.partner_id}
                        onClick={() => selectPartner(conv.partner_id, conv.partner_name)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 ${
                          activePartner?.id === conv.partner_id ? 'bg-accent/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {conv.partner_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                {timeAgo(conv.last_message_at)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conv.last_message_is_mine ? 'You: ' : ''}{conv.last_message}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Message thread */}
              <div className={`flex-1 flex flex-col ${!activePartner ? 'hidden sm:flex' : 'flex'}`}>
                {!activePartner ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Select a conversation to start messaging</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Thread header */}
                    <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                      <button
                        onClick={() => setActivePartner(null)}
                        className="sm:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-accent" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {activePartner.name}
                      </span>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-1">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-5 h-5 text-accent animate-spin" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-sm text-muted-foreground">
                            No messages yet. Say hello!
                          </p>
                        </div>
                      ) : (
                        groupedMessages.map((group) => (
                          <div key={group.date}>
                            <div className="text-center my-4">
                              <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                                {formatMessageDate(group.messages[0].created_at)}
                              </span>
                            </div>
                            {group.messages.map((msg) => {
                              const mine = isMine(msg.sender_id)
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex mb-1.5 ${mine ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${
                                      mine
                                        ? 'bg-accent text-accent-foreground rounded-br-md'
                                        : 'bg-muted text-foreground rounded-bl-md'
                                    }`}
                                  >
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${mine ? 'text-accent-foreground/60' : 'text-muted-foreground'}`}>
                                      {formatMessageTime(msg.created_at)}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="mx-4 mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </div>
                    )}

                    {/* Compose */}
                    <div className="p-3 border-t border-border">
                      <div className="flex items-end gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Type a message..."
                          rows={1}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm resize-none max-h-24"
                        />
                        <button
                          onClick={handleSend}
                          disabled={!draft.trim() || sending}
                          className="p-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="min-h-screen pt-28 pb-6 px-6">
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          </main>
        </>
      }
    >
      <MessagesContent />
    </Suspense>
  )
}
