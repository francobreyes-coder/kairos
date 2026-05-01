import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getSessionMembership } from '@/lib/session-access'

// GET — fetch the (single) document for a session, creating it lazily.
// Returns Yjs state as base64 so the client can apply it to its Y.Doc.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params

  const member = await getSessionMembership(sessionId)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()

  let { data: doc } = await supabase
    .from('session_documents')
    .select('id, title, content, yjs_state, updated_at')
    .eq('session_id', sessionId)
    .single()

  if (!doc) {
    const inserted = await supabase
      .from('session_documents')
      .insert({ session_id: sessionId, title: 'Notes' })
      .select('id, title, content, yjs_state, updated_at')
      .single()
    if (inserted.error) {
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 },
      )
    }
    doc = inserted.data
  }

  // yjs_state comes back from Supabase as a hex string ("\\x...") for bytea.
  // Normalise to base64 for the client.
  let yjsStateB64: string | null = null
  if (doc!.yjs_state) {
    const raw = doc!.yjs_state as unknown as string
    if (typeof raw === 'string' && raw.startsWith('\\x')) {
      const hex = raw.slice(2)
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
      }
      yjsStateB64 = Buffer.from(bytes).toString('base64')
    }
  }

  return NextResponse.json({
    id: doc!.id,
    title: doc!.title,
    content: doc!.content,
    yjsState: yjsStateB64,
    updatedAt: doc!.updated_at,
  })
}

// PUT — persist the latest Yjs snapshot. Body: { yjsState: base64, content: tiptapJson }.
// Called on a debounce by the editor; full state replace is fine because Yjs
// state vectors are small and idempotent.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params

  const member = await getSessionMembership(sessionId)
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.yjsState || typeof body.yjsState !== 'string') {
    return NextResponse.json({ error: 'Missing yjsState' }, { status: 400 })
  }

  const stateBytes = Buffer.from(body.yjsState, 'base64')
  const supabase = getSupabase()

  const { error } = await supabase
    .from('session_documents')
    .update({
      yjs_state: stateBytes,
      content: body.content ?? null,
      updated_by: member.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)

  if (error) {
    console.error('Failed to persist session document:', error)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
