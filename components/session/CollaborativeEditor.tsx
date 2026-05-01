'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import {
  SupabaseYjsProvider,
  type ProviderStatus,
} from '@/lib/yjs-supabase-provider'

type Props = {
  sessionId: string
}

// We split loading from editing because TipTap's useEditor mounts
// synchronously and would otherwise inject an initial empty paragraph
// into the Y.Doc *before* we applied the persisted state — that races
// with the loaded content and shows up as a duplicate blank paragraph.
// Loading the state first, then mounting the editor against the
// pre-populated doc, sidesteps that.
export function CollaborativeEditor({ sessionId }: Props) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  if (!docRef.current) docRef.current = new Y.Doc()
  const ydoc = docRef.current

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/session-documents/${sessionId}`)
        if (!res.ok) throw new Error('Failed to load document')
        const data = await res.json()
        if (cancelled) return

        if (data.yjsState) {
          try {
            const bin = Uint8Array.from(atob(data.yjsState), (c) => c.charCodeAt(0))
            Y.applyUpdate(ydoc, bin)
          } catch (e) {
            // A malformed snapshot shouldn't brick the editor — start
            // empty and let the user re-type. Logged so we notice.
            console.error('Failed to apply persisted Yjs state:', e)
          }
        }
        setReady(true)
      } catch (e: any) {
        console.error('CollaborativeEditor load failed:', e)
        setError(e?.message ?? 'Failed to load shared notes')
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-red-600 text-sm">
        {error}
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mb-2" />
        <span className="text-sm">Loading shared notes…</span>
      </div>
    )
  }

  return <EditorBody sessionId={sessionId} ydoc={ydoc} />
}

function EditorBody({
  sessionId,
  ydoc,
}: {
  sessionId: string
  ydoc: Y.Doc
}) {
  const [status, setStatus] = useState<ProviderStatus>('connecting')
  const [saving, setSaving] = useState(false)
  const providerRef = useRef<SupabaseYjsProvider | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // StarterKit's history is disabled because Yjs ships its own UndoManager
  // via the Collaboration extension; mixing them corrupts undo state.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      Placeholder.configure({ placeholder: 'Start taking shared notes…' }),
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose-base max-w-none min-h-[400px] px-5 py-4 focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Connect the realtime provider after the editor has bound to the doc.
  useEffect(() => {
    const supabase = getBrowserSupabase()
    const provider = new SupabaseYjsProvider(
      supabase,
      `session-doc:${sessionId}`,
      ydoc,
    )
    provider.onStatus(setStatus)
    providerRef.current = provider
    return () => {
      provider.destroy()
      providerRef.current = null
    }
  }, [sessionId, ydoc])

  // Debounced persistence: every local edit schedules a save 1.5s out.
  // Yjs state for a notes doc is small and idempotent, so a "last write
  // wins" snapshot is fine.
  useEffect(() => {
    if (!editor) return

    function scheduleSave() {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const state = Y.encodeStateAsUpdate(ydoc)
          let s = ''
          for (let i = 0; i < state.length; i++) s += String.fromCharCode(state[i])
          const yjsState = btoa(s)
          await fetch(`/api/session-documents/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yjsState, content: editor!.getJSON() }),
          })
        } catch (e) {
          console.error('Auto-save failed:', e)
        } finally {
          setSaving(false)
        }
      }, 1500)
    }

    const update = () => scheduleSave()
    ydoc.on('update', update)
    return () => {
      ydoc.off('update', update)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        // Flush the pending edit before we unmount. Without this, typing
        // "hello" and clicking End Call inside the 1.5s debounce window
        // dropped the write and the notes came back empty later.
        // keepalive lets the request outlive the page navigation.
        try {
          const state = Y.encodeStateAsUpdate(ydoc)
          let s = ''
          for (let i = 0; i < state.length; i++) s += String.fromCharCode(state[i])
          const yjsState = btoa(s)
          fetch(`/api/session-documents/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yjsState, content: editor!.getJSON() }),
            keepalive: true,
          }).catch(() => {})
        } catch (e) {
          console.error('Failed to flush notes on unmount:', e)
        }
      }
    }
  }, [editor, sessionId, ydoc])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} status={status} saving={saving} />
      <div className="flex-1 overflow-y-auto bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Toolbar({
  editor,
  status,
  saving,
}: {
  editor: Editor
  status: ProviderStatus
  saving: boolean
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-3 py-2">
      <ToolbarButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <div className="mx-1 w-px h-5 bg-border" />
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <div className="mx-1 w-px h-5 bg-border" />
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-2 text-xs">
        {saving && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        )}
        {!saving && status === 'connected' && (
          <span className="flex items-center gap-1 text-green-600">
            <Wifi className="w-3 h-3" /> Live
          </span>
        )}
        {status !== 'connected' && !saving && (
          <span className="flex items-center gap-1 text-amber-600">
            <WifiOff className="w-3 h-3" />{' '}
            {status === 'error' ? 'Offline' : 'Connecting'}
          </span>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
