import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ draft: null })
  }

  const supabase = getSupabase()
  const { data } = await supabase
    .from('application_drafts')
    .select('form_data')
    .eq('user_id', session.user.id)
    .single()

  return NextResponse.json({ draft: data?.form_data ?? null })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { formData } = await req.json()
  const supabase = getSupabase()

  await supabase.from('application_drafts').upsert(
    {
      user_id: session.user.id,
      form_data: formData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ ok: true })
}
