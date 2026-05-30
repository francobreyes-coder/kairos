'use client'

import { Plus, Trash2, X } from 'lucide-react'

export type DataTable = {
  caption?: string
  headers: string[]
  rows: string[][]
}

type Props = {
  value: DataTable | null
  onChange: (next: DataTable | null) => void
}

export function emptyDataTable(): DataTable {
  return { caption: '', headers: ['', ''], rows: [['', ''], ['', '']] }
}

// Per-question structured data table. Stored on questions.data_table as
// { caption, headers: string[], rows: string[][] }. Rows are kept rectangular
// against headers — adding/removing a column patches every row.
export function DataTableEditor({ value, onChange }: Props) {
  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center">
        <p className="text-xs text-muted-foreground mb-2">
          No data table attached to this question.
        </p>
        <button
          type="button"
          onClick={() => onChange(emptyDataTable())}
          className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
        >
          <Plus className="w-3 h-3" /> Add data table
        </button>
      </div>
    )
  }

  // Narrow once so TS keeps the non-null type inside the inner closures.
  const table: DataTable = value
  const cols = table.headers.length

  function setHeader(i: number, next: string) {
    const headers = [...table.headers]
    headers[i] = next
    onChange({ ...table, headers })
  }

  function setCell(r: number, c: number, next: string) {
    const rows = table.rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? next : cell)) : row
    )
    onChange({ ...table, rows })
  }

  function addRow() {
    onChange({ ...table, rows: [...table.rows, Array(cols).fill('')] })
  }

  function removeRow(r: number) {
    onChange({ ...table, rows: table.rows.filter((_, ri) => ri !== r) })
  }

  function addColumn() {
    onChange({
      ...table,
      headers: [...table.headers, ''],
      rows: table.rows.map((row) => [...row, '']),
    })
  }

  function removeColumn(c: number) {
    if (cols <= 1) return
    onChange({
      ...table,
      headers: table.headers.filter((_, ci) => ci !== c),
      rows: table.rows.map((row) => row.filter((_, ci) => ci !== c)),
    })
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={table.caption ?? ''}
          onChange={(e) => onChange({ ...table, caption: e.target.value })}
          placeholder="Table caption (optional)"
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-purple-500/30"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Remove data table"
        >
          <X className="w-3 h-3" /> Remove
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {table.headers.map((h, c) => (
                <th key={c} className="border border-border bg-secondary/40 p-0">
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={h}
                      onChange={(e) => setHeader(c, e.target.value)}
                      placeholder={`col ${c + 1}`}
                      className="w-full bg-transparent px-2 py-1 text-xs font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(c)}
                      disabled={cols <= 1}
                      className="px-1 text-muted-foreground hover:text-red-600 disabled:opacity-30"
                      title="Remove column"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="border border-transparent p-0 w-8">
                <button
                  type="button"
                  onClick={addColumn}
                  className="m-0.5 inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title="Add column"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-border p-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className="w-full bg-transparent px-2 py-1 text-xs outline-none"
                    />
                  </td>
                ))}
                <td className="border border-transparent p-0 w-8 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(r)}
                    className="m-0.5 inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-secondary hover:text-red-600"
                    title="Remove row"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Plus className="w-3 h-3" /> Add row
      </button>
    </div>
  )
}
