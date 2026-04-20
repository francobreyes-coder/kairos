import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { emailOptin } = await req.json()
  const supabase = getSupabase()

  await supabase.from('users').upsert(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? '',
      image: session.user.image ?? '',
      email_optin: !!emailOptin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  return NextResponse.json({ ok: true })
}
