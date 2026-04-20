import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { emailOptin, firstName, lastName, contactEmail, age } = await req.json()
  const supabase = getSupabase()

  await supabase.from('users').upsert(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? '',
      image: session.user.image ?? '',
      email_optin: !!emailOptin,
      first_name: firstName ?? '',
      last_name: lastName ?? '',
      contact_email: contactEmail ?? session.user.email,
      age: age ? parseInt(age, 10) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  return NextResponse.json({ ok: true })
}
