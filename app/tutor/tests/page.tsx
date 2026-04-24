'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/landing/header'
import {
  Loader2,
  Plus,
  ClipboardList,
  Trash2,
  Calendar,
  Hash,
  ChevronRight,
  AlertCircle,
  Eye,
} from 'lucide-react'

interface Test {
  id: string
  name: string
  exam_type: string
  question_count: number
  filters: Record<string, any>
  created_at: string
}

export default function TutorTestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/tests')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status])

  async function handleDelete(id: string) {
    if (!confirm('Delete this test? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/tests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTests((prev) => prev.filter((t) => t.id !== id))
    } catch {
      setError('Failed to delete test')
    } finally {
      setDeleting(null)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function filterSummary(filters: Record<string, any>): string {
    const parts: string[] = []
    if (filters.subject) parts.push(filters.subject)
    if (filters.question_type) parts.push(filters.question_type)
    if (filters.difficulty) parts.push(filters.difficulty)
    return parts.length > 0 ? parts.join(' / ') : 'All questions'
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-24 px-6">
          <div className="mx-auto max-w-4xl flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-24 px-6">
        <div className="mx-auto max-w-4xl">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/tutor/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">My Tests</span>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Tests</h1>
              <p className="text-muted-foreground mt-1">
                {tests.length} saved test{tests.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/tutor/create-test"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Test
            </Link>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm mb-6">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {tests.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <ClipboardList className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">No tests yet</h2>
              <p className="text-muted-foreground mb-6">
                Create a custom test by selecting questions from the question bank.
              </p>
              <Link
                href="/tutor/create-test"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Test
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-accent/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {test.name}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent flex-shrink-0">
                          {test.exam_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {test.question_count} questions
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(test.created_at)}
                        </span>
                        <span>{filterSummary(test.filters)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/tutor/tests/${test.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:border-accent/30 hover:text-foreground transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(test.id)}
                        disabled={deleting === test.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === test.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
