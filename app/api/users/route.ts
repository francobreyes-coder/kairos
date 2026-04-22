import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { emailOptin, firstName, lastName, contactEmail, age, role } = await req.json()
  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', session.user.id)
    .single()

  await supabase.from('users').upsert(
    {
      id: session.user.id,
      email: contactEmail ?? session.user.email,
      name: session.user.name ?? '',
      ...(role && { role }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (!existing) {
    try {
      const name = firstName || session.user.name?.split(' ')[0] || 'there'
      await sendWelcomeEmail(session.user.email, name)
    } catch (e) {
      console.error('Failed to send welcome email:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
