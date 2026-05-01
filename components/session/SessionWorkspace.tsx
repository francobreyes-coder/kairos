'use client'

import { useEffect, useState } from 'react'
import { FileText, ImageIcon, Trash2, Eye } from 'lucide-react'
import { CollaborativeEditor } from './CollaborativeEditor'
import { DocumentUploader } from './DocumentUploader'
import { DocumentViewer } from './DocumentViewer'
import type { UploadedFile } from './types'

type Props = {
  sessionId: string
  /** The video panel (Daily iframe + controls) is owned by the page; we
   *  receive it as a slot so the page can keep its existing wiring. */
  videoSlot: React.ReactNode
}

export function SessionWorkspace({ sessionId, videoSlot }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [openFile, setOpenFile] = useState<UploadedFile | null>(null)

  useEffect(() => {
    fetch(`/api/session-uploads?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files ?? []))
      .catch(() => {})
  }, [sessionId])

  function handleUploaded(file: UploadedFile) {
    setFiles((prev) => [...prev, file])
    setOpenFile(file)
  }

  async function handleDelete(file: UploadedFile) {
    if (!confirm(`Delete ${file.file_name}?`)) return
    await fetch('/api/session-uploads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: file.id, sessionId }),
    })
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
    if (openFile?.id === file.id) setOpenFile(null)
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 h-[calc(100vh-180px)] min-h-[560px]">
      {/* Left column: video on top, files strip below */}
      <div className="flex flex-col gap-4 min-h-0">
        <div className="rounded-2xl border border-border bg-black overflow-hidden flex-1 min-h-[260px]">
          {videoSlot}
        </div>

        <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Files
            </span>
            <DocumentUploader sessionId={sessionId} onUploaded={handleUploaded} />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4">
                No files yet. Upload a PDF or image to discuss.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${
                      openFile?.id === file.id ? 'bg-accent/10' : ''
                    }`}
                  >
                    {file.file_type === 'pdf' ? (
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                    <button
                      onClick={() => setOpenFile(file)}
                      className="flex-1 text-left truncate hover:text-accent"
                      title={file.file_name}
                    >
                      {file.file_name}
                    </button>
                    <button
                      onClick={() => setOpenFile(file)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Open"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1 text-muted-foreground hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Right column: when a doc is open, show viewer + editor stacked;
          otherwise editor takes full height. */}
      {openFile ? (
        <div className="grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 min-h-0">
          <div className="rounded-2xl border border-border overflow-hidden">
            <DocumentViewer file={openFile} onClose={() => setOpenFile(null)} />
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <CollaborativeEditor sessionId={sessionId} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden min-h-0">
          <CollaborativeEditor sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}
