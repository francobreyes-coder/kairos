'use client'

import { X, ExternalLink } from 'lucide-react'
import type { UploadedFile } from './types'

type Props = {
  file: UploadedFile
  onClose: () => void
}

// PDFs are rendered via the browser's native viewer (iframe) — no worker
// setup, scrolling and zoom for free. Images render as <img>. If we add
// per-PDF highlighting later, swap the iframe for react-pdf and overlay an
// annotation layer.
export function DocumentViewer({ file, onClose }: Props) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {file.file_name}
          </span>
          <span className="text-xs text-muted-foreground uppercase">
            {file.file_type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={file.file_url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-neutral-900">
        {file.file_type === 'pdf' ? (
          <iframe
            src={file.file_url}
            className="w-full h-full border-0"
            title={file.file_name}
          />
        ) : file.file_type === 'image' ? (
          <div className="flex items-center justify-center w-full h-full p-4">
            <img
              src={file.file_url}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground text-sm">
            Preview not available — open in new tab.
          </div>
        )}
      </div>
    </div>
  )
}
