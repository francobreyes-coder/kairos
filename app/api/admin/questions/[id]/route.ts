import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

const EDITABLE = [
  'subject',
  'question_type',
  'topic',
  'difficulty',
  'question_text',
  'answer_choices',
  'correct_answer',
  'explanation',
  'tags',
  'time_estimate',
  'figures',
  'data_table',
] as const
type EditableField = (typeof EDITABLE)[number]

async function requireAdmin() {
  const session = await auth()
  return session?.user?.email === ADMIN_EMAIL
}

// PATCH /api/admin/questions/[id]
// Body: partial set of editable fields. Unknown fields are ignored.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = (await req.json()) as Record<string, unknown>
  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) updates[key as EditableField] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields in body' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}
