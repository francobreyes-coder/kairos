import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getSessionMembership } from '@/lib/session-access'

const BUCKET = 'session-uploads'

function classifyMime(mime: string): 'pdf' | 'image' | 'other' {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  return 'other'
}

// GET ?sessionId=... — list files for a session.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const member = await getSessionMembership(sessionId)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  return NextResponse.json({ files: data ?? [] })
}

// POST — upload a file to a session. multipart form: file, sessionId.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const sessionId = form.get('sessionId') as string | null

  if (!file || !sessionId) {
    return NextResponse.json(
      { error: 'Missing file or sessionId' },
      { status: 400 },
    )
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (25MB max)' }, { status: 413 })
  }

  const member = await getSessionMembership(sessionId)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `sessions/${sessionId}/${Date.now()}_${safeName}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const fileType = classifyMime(file.type)

  const { data: row, error: insertErr } = await supabase
    .from('uploaded_files')
    .insert({
      session_id: sessionId,
      uploaded_by: member.userId,
      file_path: path,
      file_url: pub.publicUrl,
      file_type: fileType,
      file_name: file.name,
      size_bytes: file.size,
    })
    .select('*')
    .single()

  if (insertErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  return NextResponse.json({ file: row })
}

// DELETE — remove a file. Body: { id, sessionId }.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.sessionId) {
    return NextResponse.json({ error: 'Missing id or sessionId' }, { status: 400 })
  }

  const member = await getSessionMembership(body.sessionId)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()

  const { data: file } = await supabase
    .from('uploaded_files')
    .select('id, file_path, session_id')
    .eq('id', body.id)
    .single()

  if (!file || file.session_id !== body.sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase.storage.from(BUCKET).remove([file.file_path])
  await supabase.from('uploaded_files').delete().eq('id', file.id)

  return NextResponse.json({ ok: true })
}
