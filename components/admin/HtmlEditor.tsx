'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Code2, Eye } from 'lucide-react'

type Props = {
  value: string
  onChange: (html: string) => void
  minHeight?: number
  placeholder?: string
}

// Rich-text editor for question_text / explanation. Two modes:
//  - WYSIWYG (Tiptap StarterKit): bold/italic/headings/lists
//  - Raw HTML (textarea): lets the user fix mangled markup from the PDF
//    extractor. Switching back to WYSIWYG re-parses the HTML via setContent.
export function HtmlEditor({ value, onChange, minHeight = 180, placeholder }: Props) {
  const [rawMode, setRawMode] = useState(false)
  const [rawValue, setRawValue] = useState(value)
  // Track which side of the toggle is the source of truth so we don't echo
  // updates back into the editor mid-keystroke.
  const updatingFromProp = useRef(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none px-3 py-2 text-sm leading-relaxed',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate({ editor }) {
      if (updatingFromProp.current) return
      const html = editor.getHTML()
      setRawValue(html)
      onChange(html)
    },
    immediatelyRender: false,
  })

  // Sync external value changes (e.g. selecting a different question) into
  // the editor and raw textarea without firing onUpdate.
  useEffect(() => {
    if (!editor) return
    if (value === editor.getHTML()) return
    updatingFromProp.current = true
    editor.commands.setContent(value || '', false)
    setRawValue(value)
    updatingFromProp.current = false
  }, [value, editor])

  function toggleRaw() {
    if (!rawMode) {
      // Going into raw: capture current editor HTML.
      setRawValue(editor?.getHTML() ?? value)
      setRawMode(true)
    } else {
      // Coming out: push raw HTML back into the editor.
      if (editor) {
        updatingFromProp.current = true
        editor.commands.setContent(rawValue, false)
        updatingFromProp.current = false
      }
      onChange(rawValue)
      setRawMode(false)
    }
  }

  function handleRawChange(next: string) {
    setRawValue(next)
    onChange(next)
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolbarButton
          active={editor?.isActive('bold')}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('italic')}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('heading', { level: 2 })}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('heading', { level: 3 })}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('bulletList')}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bulleted list"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('orderedList')}
          disabled={rawMode || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleRaw}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            rawMode
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title={rawMode ? 'Back to rich text' : 'Edit raw HTML'}
        >
          {rawMode ? <Eye className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
          {rawMode ? 'Preview' : 'HTML'}
        </button>
      </div>

      {rawMode ? (
        <textarea
          value={rawValue}
          onChange={(e) => handleRawChange(e.target.value)}
          spellCheck={false}
          style={{ minHeight: minHeight + 40 }}
          className="block w-full resize-y rounded-b-lg bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none"
        />
      ) : (
        <div className="relative">
          {!value && placeholder && (
            <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
              {placeholder}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? 'bg-purple-500/15 text-purple-700'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
