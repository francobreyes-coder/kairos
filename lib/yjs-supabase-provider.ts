'use client'

// Minimal Yjs provider that uses a Supabase Realtime broadcast channel as the
// transport between connected clients in the same session. Bytes are sent as
// base64 — broadcast payloads are JSON, so we can't send raw Uint8Array.
//
// Sync model:
//   1. On connect, broadcast { type: 'sync-request' }
//   2. Peers reply with { type: 'sync-state', state: base64(encodeStateAsUpdate(doc)) }
//   3. Local edits → { type: 'update', update: base64(update) } broadcast to others
//   4. Each peer applies received updates with applyUpdate.
//
// Persistence is the editor's job (it debounces and PUTs to the API) — the
// provider only handles in-memory sync. We assume the API layer handed the
// editor a freshly loaded server snapshot before this provider connects, so
// late-joiners are still up to date even if they're alone in the channel.

import * as Y from 'yjs'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

type Outgoing =
  | { type: 'sync-request'; from: string }
  | { type: 'sync-state'; from: string; to: string; state: string }
  | { type: 'update'; from: string; update: string }

function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

export type ProviderStatus = 'connecting' | 'connected' | 'error'

export class SupabaseYjsProvider {
  readonly doc: Y.Doc
  private channel: RealtimeChannel
  private clientId: string
  private onUpdateListener: (update: Uint8Array, origin: unknown) => void
  private statusListeners = new Set<(s: ProviderStatus) => void>()
  private status: ProviderStatus = 'connecting'
  private destroyed = false

  constructor(
    private supabase: SupabaseClient,
    private channelName: string,
    doc: Y.Doc,
  ) {
    this.doc = doc
    this.clientId = Math.random().toString(36).slice(2)

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    this.channel.on('broadcast', { event: 'yjs' }, (payload) => {
      this.handleMessage(payload.payload as Outgoing)
    })

    this.onUpdateListener = (update, origin) => {
      // Skip updates we just applied from a remote peer (origin === this).
      if (origin === this) return
      this.send({
        type: 'update',
        from: this.clientId,
        update: bytesToBase64(update),
      })
    }
    this.doc.on('update', this.onUpdateListener)

    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setStatus('connected')
        // Ask peers for their state in case we missed updates while loading.
        this.send({ type: 'sync-request', from: this.clientId })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setStatus('error')
      }
    })
  }

  onStatus(cb: (s: ProviderStatus) => void): () => void {
    this.statusListeners.add(cb)
    cb(this.status)
    return () => this.statusListeners.delete(cb)
  }

  private setStatus(s: ProviderStatus) {
    this.status = s
    this.statusListeners.forEach((cb) => cb(s))
  }

  private send(msg: Outgoing) {
    if (this.destroyed) return
    this.channel.send({ type: 'broadcast', event: 'yjs', payload: msg })
  }

  private handleMessage(msg: Outgoing) {
    if (msg.from === this.clientId) return
    if (msg.type === 'update') {
      Y.applyUpdate(this.doc, base64ToBytes(msg.update), this)
      return
    }
    if (msg.type === 'sync-request') {
      // Reply with our full state so the peer catches up.
      const state = Y.encodeStateAsUpdate(this.doc)
      this.send({
        type: 'sync-state',
        from: this.clientId,
        to: msg.from,
        state: bytesToBase64(state),
      })
      return
    }
    if (msg.type === 'sync-state' && msg.to === this.clientId) {
      Y.applyUpdate(this.doc, base64ToBytes(msg.state), this)
      return
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.doc.off('update', this.onUpdateListener)
    this.supabase.removeChannel(this.channel)
    this.statusListeners.clear()
  }
}
