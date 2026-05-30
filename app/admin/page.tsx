'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle, XCircle, ChevronLeft, Loader2, Clock, Filter, ExternalLink, FileText, Video, ImageIcon, Pencil, X, Save, AlertCircle, PauseCircle, Ban, RotateCcw, BookOpen } from 'lucide-react'
import Link from 'next/link'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

const SERVICES = [
  { id: 'essays', label: 'Essay Writing' },
  { id: 'sat', label: 'SAT Prep' },
  { id: 'act', label: 'ACT Prep' },
  { id: 'activities', label: 'Activities List Building' },
]

interface Application {
  id: string
  user_id: string | null
  name: string
  email: string
  dob: string
  university: string
  graduation_year: string
  major: string
  hobbies: string
  college_acceptances: string
  services_applied: string[]
  services_approved: string[]
  sat_score: string
  prior_sat_act_tutoring: string
  passion: string
  why_kairos: string
  video_filename: string
  resume_filename: string
  proof_filename: string
  application_status: 'pending' | 'approved' | 'denied' | 'suspended' | 'banned'
  denial_reason: string | null
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-600 border-green-500/20',
    denied: 'bg-red-500/10 text-red-600 border-red-500/20',
    suspended: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    banned: 'bg-zinc-700/10 text-zinc-700 border-zinc-700/30',
  }[status] ?? 'bg-gray-500/10 text-gray-600 border-gray-500/20'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}

function FileLink({ label, filename, applicationId, fileType, icon: Icon }: {
  label: string
  filename: string
  applicationId: string
  fileType: string
  icon: typeof FileText
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!filename) {
    return (
      <div className="flex items-center gap-3 w-full p-3 rounded-lg bg-secondary/30 text-left">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground italic">Not uploaded</p>
        </div>
      </div>
    )
  }

  async function openFile() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ applicationId, fileType })
      const res = await fetch(`/api/admin/files?${params}`)
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, '_blank')
      } else {
        setError(data.error ?? 'Could not retrieve file')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={openFile}
        disabled={loading}
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left group"
      >
        <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{filename}</p>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
        ) : (
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
        )}
      </button>
      {error && (
        <div className="mt-1.5 flex items-start gap-1.5 px-3 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Application | null>(null)
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied' | 'suspended' | 'banned'>('pending')
  const [confirmAction, setConfirmAction] = useState<null | 'suspend' | 'ban' | 'reinstate'>(null)
  const [approvedServices, setApprovedServices] = useState<string[]>([])
  const [denialReason, setDenialReason] = useState('')
  const [showDenyForm, setShowDenyForm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session || !isAdmin) {
      router.push('/home')
      return
    }
    fetchApplications()
  }, [session, sessionStatus, isAdmin, router])

  async function fetchApplications() {
    setLoading(true)
    const res = await fetch('/api/admin')
    const data = await res.json()
    setApplications(data.applications ?? [])
    setLoading(false)
  }

  function openDetail(app: Application) {
    setSelected(app)
    setApprovedServices(app.services_approved ?? app.services_applied ?? [])
    setDenialReason('')
    setShowDenyForm(false)
    setEditingName(false)
    setNameDraft(app.name)
    setConfirmAction(null)
  }

  async function handleSaveName() {
    if (!selected) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === selected.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action: 'update_name',
        name: trimmed,
      }),
    })
    setSavingName(false)
    if (res.ok) {
      setSelected((prev) => prev ? { ...prev, name: trimmed } : null)
      setApplications((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, name: trimmed } : a))
      )
      setEditingName(false)
    }
  }

  async function handleApprove() {
    if (!selected) return
    setActing(true)
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action: 'approve',
        services_approved: approvedServices,
      }),
    })
    setSelected(null)
    setActing(false)
    fetchApplications()
  }

  async function handleDeny() {
    if (!selected) return
    setActing(true)
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action: 'deny',
        denial_reason: denialReason,
      }),
    })
    setSelected(null)
    setActing(false)
    setShowDenyForm(false)
    setDenialReason('')
    fetchApplications()
  }

  async function handleStatusChange(action: 'suspend' | 'ban' | 'reinstate') {
    if (!selected) return
    setActing(true)
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, action }),
    })
    setActing(false)
    setConfirmAction(null)
    if (res.ok) {
      const nextStatus =
        action === 'suspend' ? 'suspended'
        : action === 'ban' ? 'banned'
        : 'approved'
      setSelected((prev) => prev ? { ...prev, application_status: nextStatus } : null)
      fetchApplications()
    }
  }

  async function handleUpdateServices() {
    if (!selected) return
    setActing(true)
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action: 'update_services',
        services_approved: approvedServices,
      }),
    })
    setActing(false)
    setSelected((prev) => prev ? { ...prev, services_approved: approvedServices } : null)
    fetchApplications()
  }

  function toggleService(id: string) {
    setApprovedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const filtered = filter === 'all'
    ? applications
    : applications.filter((a) => a.application_status === filter)

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.application_status === 'pending').length,
    approved: applications.filter((a) => a.application_status === 'approved').length,
    suspended: applications.filter((a) => a.application_status === 'suspended').length,
    banned: applications.filter((a) => a.application_status === 'banned').length,
    denied: applications.filter((a) => a.application_status === 'denied').length,
  }

  if (selected) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <button
            onClick={() => { setSelected(null); setShowDenyForm(false); setDenialReason(''); setConfirmAction(null) }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" /> Back to list
          </button>

          <div className="flex items-start justify-between mb-6 gap-4">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') { setEditingName(false); setNameDraft(selected.name) }
                    }}
                    className="text-2xl font-semibold text-foreground bg-card border border-border rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-purple-500/30 transition w-full"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !nameDraft.trim()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameDraft(selected.name) }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">{selected.name}</h1>
                  <button
                    onClick={() => { setEditingName(true); setNameDraft(selected.name) }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Edit name"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-1">{selected.email}</p>
            </div>
            <StatusBadge status={selected.application_status} />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Personal Information</h2>
              <dl className="grid grid-cols-2 gap-4">
                <DetailRow label="Date of Birth" value={selected.dob} />
                <DetailRow label="Hobbies" value={selected.hobbies} />
              </dl>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Academic Background</h2>
              <dl className="grid grid-cols-2 gap-4">
                <DetailRow label="University" value={selected.university} />
                <DetailRow label="Graduation Year" value={selected.graduation_year} />
                <DetailRow label="Major" value={selected.major} />
                <DetailRow label="SAT/ACT Score" value={selected.sat_score} />
                <DetailRow label="Prior SAT/ACT Tutoring" value={selected.prior_sat_act_tutoring === 'yes' ? 'Yes' : selected.prior_sat_act_tutoring === 'no' ? 'No' : ''} />
                <div className="col-span-2">
                  <DetailRow label="College Acceptances" value={selected.college_acceptances} />
                </div>
              </dl>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Services</h2>
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2">Applied for:</p>
                <div className="flex flex-wrap gap-2">
                  {(selected.services_applied ?? []).map((s) => (
                    <span key={s} className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-xs font-medium border border-purple-500/20">
                      {SERVICES.find((sv) => sv.id === s)?.label ?? s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Approve for services:</p>
                <div className="space-y-2">
                  {SERVICES.filter((s) => (selected.services_applied ?? []).includes(s.id)).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvedServices.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                        className="w-4 h-4 rounded border-border text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-foreground">{s.label}</span>
                    </label>
                  ))}
                </div>
                {selected.application_status === 'approved' && (
                  <button
                    onClick={handleUpdateServices}
                    disabled={acting}
                    className="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    Update Services
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Short Answers</h2>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Something they are passionate about:</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.passion}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Why Kairos:</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.why_kairos}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Attachments</h2>
              <div className="space-y-3">
                <FileLink
                  label="Video Introduction"
                  filename={selected.video_filename}
                  applicationId={selected.id}
                  fileType="video"
                  icon={Video}
                />
                <FileLink
                  label="Resume"
                  filename={selected.resume_filename}
                  applicationId={selected.id}
                  fileType="resume"
                  icon={FileText}
                />
                <FileLink
                  label="Proof of Admission"
                  filename={selected.proof_filename}
                  applicationId={selected.id}
                  fileType="proof"
                  icon={ImageIcon}
                />
              </div>
            </div>

            {selected.application_status === 'denied' && selected.denial_reason && (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600 mb-2">Denial Reason</h2>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.denial_reason}</p>
              </div>
            )}

            {(selected.application_status === 'approved' || selected.application_status === 'suspended' || selected.application_status === 'banned') && (
              <div className="space-y-4 pt-2">
                {confirmAction ? (
                  <div className={`rounded-2xl bg-card border p-6 space-y-4 ${
                    confirmAction === 'ban' ? 'border-red-500/30' :
                    confirmAction === 'suspend' ? 'border-orange-500/30' :
                    'border-green-500/30'
                  }`}>
                    <h2 className={`text-sm font-semibold ${
                      confirmAction === 'ban' ? 'text-red-600' :
                      confirmAction === 'suspend' ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {confirmAction === 'ban' ? 'Ban this tutor?' :
                       confirmAction === 'suspend' ? 'Suspend this tutor?' :
                       'Reinstate this tutor?'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {confirmAction === 'ban'
                        ? 'They will be permanently removed from tutor matching, bookings, and messaging. Existing sessions remain visible to students but the tutor loses access to their dashboard.'
                        : confirmAction === 'suspend'
                        ? 'They will be hidden from tutor matching and unable to take new bookings. Suspension is reversible — you can reinstate them anytime.'
                        : 'They will be restored to active approved status and become visible to students again.'}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStatusChange(confirmAction)}
                        disabled={acting}
                        className={`flex-1 h-10 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 ${
                          confirmAction === 'ban' ? 'bg-red-600 hover:bg-red-700' :
                          confirmAction === 'suspend' ? 'bg-orange-600 hover:bg-orange-700' :
                          'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {acting ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         confirmAction === 'ban' ? <Ban className="w-4 h-4" /> :
                         confirmAction === 'suspend' ? <PauseCircle className="w-4 h-4" /> :
                         <RotateCcw className="w-4 h-4" />}
                        Confirm {confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="px-4 h-10 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {selected.application_status === 'approved' && (
                      <>
                        <button
                          onClick={() => setConfirmAction('suspend')}
                          className="flex-1 min-w-[140px] h-12 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <PauseCircle className="w-4 h-4" />
                          Suspend
                        </button>
                        <button
                          onClick={() => setConfirmAction('ban')}
                          className="flex-1 min-w-[140px] h-12 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Ban
                        </button>
                      </>
                    )}
                    {selected.application_status === 'suspended' && (
                      <>
                        <button
                          onClick={() => setConfirmAction('reinstate')}
                          className="flex-1 min-w-[140px] h-12 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reinstate
                        </button>
                        <button
                          onClick={() => setConfirmAction('ban')}
                          className="flex-1 min-w-[140px] h-12 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Ban
                        </button>
                      </>
                    )}
                    {selected.application_status === 'banned' && (
                      <button
                        onClick={() => setConfirmAction('reinstate')}
                        className="flex-1 min-w-[140px] h-12 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reinstate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {selected.application_status === 'pending' && (
              <div className="space-y-4 pt-2">
                {showDenyForm ? (
                  <div className="rounded-2xl bg-card border border-red-500/20 p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-red-600">Deny Application</h2>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Reason for denial (included in email to applicant)
                      </label>
                      <textarea
                        value={denialReason}
                        onChange={(e) => setDenialReason(e.target.value)}
                        rows={4}
                        placeholder="Explain why the application is being denied or what the applicant needs to resubmit..."
                        className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-red-500/30 transition resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeny}
                        disabled={acting || !denialReason.trim()}
                        className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Confirm Deny
                      </button>
                      <button
                        onClick={() => { setShowDenyForm(false); setDenialReason('') }}
                        className="px-4 h-10 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={acting}
                      className="flex-1 h-12 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setShowDenyForm(true)}
                      className="flex-1 h-12 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Deny
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Applied {new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Kairos" width={36} height={36} className="rounded-xl" />
            <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
          </div>
          <Link
            href="/admin/questions"
            className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-purple-500/30 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Question bank
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'pending', 'approved', 'suspended', 'banned', 'denied'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No {filter === 'all' ? '' : filter} applications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => openDetail(app)}
                className="w-full text-left rounded-2xl bg-card border border-border p-5 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {app.university} &middot; {app.major} &middot; Class of {app.graduation_year}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(app.services_applied ?? []).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
                          {SERVICES.find((sv) => sv.id === s)?.label ?? s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={app.application_status} />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
