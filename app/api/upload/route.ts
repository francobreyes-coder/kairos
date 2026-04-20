import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const fileType = formData.get('fileType') as string | null

  if (!file || !fileType) {
    return NextResponse.json({ error: 'Missing file or fileType' }, { status: 400 })
  }

  const supabase = getSupabase()
  const path = `${session.user.id}/${fileType}_${file.name}`

  const { error } = await supabase.storage
    .from('application-files')
    .upload(path, file, { upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ path, filename: file.name })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await req.json()
  if (!path || !path.startsWith(session.user.id + '/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const supabase = getSupabase()
  await supabase.storage.from('application-files').remove([path])

  return NextResponse.json({ ok: true })
}
