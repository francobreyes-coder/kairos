'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

type Props = {
  sessionId: string
}

// Read-only TipTap viewer for past sessions. Reads the persisted JSON
// content (NOT the Yjs state) — no provider, no realtime, no autosave.
// We split load/render the same way CollaborativeEditor does so the editor
// only mounts once content is in hand.
export function NotesViewer({ sessionId }: Props) {
  const [content, setContent] = useState<unknown>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/session-documents/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load notes')
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        setContent(d.content ?? null)
        setUpdatedAt(d.updatedAt ?? null)
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message ?? 'Failed to load notes')
      })
    return () => {
      cancelled = true
    }
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
        <span className="text-sm">Loading notes…</span>
      </div>
    )
  }

  return <NotesBody content={content} updatedAt={updatedAt} />
}

function NotesBody({
  content,
  updatedAt,
}: {
  content: unknown
  updatedAt: string | null
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ history: false })],
    content: content as any,
    editable: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose-base max-w-none min-h-[400px] px-5 py-4 focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  if (!editor) return null

  const isEmpty = editor.isEmpty

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="w-4 h-4" /> Session Notes
        </span>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            Last updated {formatTimestamp(updatedAt)}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto bg-background">
        {isEmpty ? (
          <div className="flex items-center justify-center h-full p-8 text-muted-foreground text-sm">
            No notes were taken in this session.
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
