import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

export async function GET(req: Request) {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const filename = searchParams.get('filename')
  const fileType = searchParams.get('fileType')

  if (!userId || !filename || !fileType) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const supabase = getSupabase()
  const path = `${userId}/${fileType}_${filename}`

  const { data, error } = await supabase.storage
    .from('application-files')
    .createSignedUrl(path, 3600)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
