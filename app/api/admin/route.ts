import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { sendApprovalEmail, sendDenialEmail } from '@/lib/email'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

const SERVICE_LABELS: Record<string, string> = {
  essays: 'Essay Writing',
  'sat-act': 'SAT/ACT Prep',
  activities: 'Activities List Building',
}

async function checkAdmin() {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) return null
  return session
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tutor_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ applications: data })
}

export async function PATCH(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, action, services_approved, denial_reason } = await req.json()
  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
  }

  const supabase = getSupabase()

  if (action === 'approve' || action === 'deny') {
    const updates: Record<string, unknown> = {
      application_status: action === 'approve' ? 'approved' : 'denied',
      updated_at: new Date().toISOString(),
    }
    if (action === 'approve' && services_approved) {
      updates.services_approved = services_approved
    }
    if (action === 'deny' && denial_reason) {
      updates.denial_reason = denial_reason
    }

    const { error } = await supabase
      .from('tutor_applications')
      .update(updates)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: app } = await supabase
      .from('tutor_applications')
      .select('name, email')
      .eq('id', id)
      .single()

    if (app?.email) {
      try {
        if (action === 'approve') {
          const labels = (services_approved ?? []).map((s: string) => SERVICE_LABELS[s] ?? s)
          await sendApprovalEmail(app.email, app.name, labels)
        } else {
          await sendDenialEmail(app.email, app.name, denial_reason ?? '')
        }
      } catch (e) {
        console.error('Failed to send email:', e)
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'update_services') {
    const { error } = await supabase
      .from('tutor_applications')
      .update({
        services_approved: services_approved ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
