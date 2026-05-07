'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, Check, X, AlertCircle, UserPlus } from 'lucide-react'

interface SessionStudent {
  id: string
  name: string
  email: string | null
  last_session_date: string
  last_session_status: string
  is_upcoming: boolean
}

interface Assignment {
  student_id: string
  assigned_at: string
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function TestAssignPanel({ testId }: { testId: string }) {
  const [students, setStudents] = useState<SessionStudent[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [sRes, aRes] = await Promise.all([
          fetch('/api/tutor/students'),
          fetch(`/api/tests/${testId}/assignments`),
        ])
        const sData = await sRes.json()
        const aData = await aRes.json()
        if (cancelled) return
        if (!sRes.ok) throw new Error(sData.error || 'Failed to load students')
        if (!aRes.ok) throw new Error(aData.error || 'Failed to load assignments')
        setStudents(sData.students ?? [])
        setAssignments(aData.assignments ?? [])
      } catch (err: any) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [testId])

  const assignedSet = new Set(assignments.map((a) => a.student_id))

  async function assign(studentId: string) {
    setSavingFor(studentId)
    setError(null)
    try {
      const res = await fetch(`/api/tests/${testId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: [studentId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign')
      setAssignments((prev) => [
        { student_id: studentId, assigned_at: new Date().toISOString() },
        ...prev.filter((a) => a.student_id !== studentId),
      ])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingFor(null)
    }
  }

  async function unassign(studentId: string) {
    setSavingFor(studentId)
    setError(null)
    try {
      const res = await fetch(
        `/api/tests/${testId}/assignments?studentId=${encodeURIComponent(studentId)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to unassign')
      setAssignments((prev) => prev.filter((a) => a.student_id !== studentId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingFor(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Assign to Students
        </h2>
        {assignments.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {assignments.length} assigned
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-xs mb-4">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any students yet. Once a student books a session with
            you, you&apos;ll be able to assign them tests here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {students.map((s) => {
            const isAssigned = assignedSet.has(s.id)
            const busy = savingFor === s.id
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    {s.is_upcoming && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        Upcoming
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.is_upcoming ? 'Next session' : 'Last session'} · {formatDate(s.last_session_date)}
                    {s.email ? ` · ${s.email}` : ''}
                  </p>
                </div>

                {isAssigned ? (
                  <button
                    onClick={() => unassign(s.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-red-700 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    Unassign
                  </button>
                ) : (
                  <button
                    onClick={() => assign(s.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Assign
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
