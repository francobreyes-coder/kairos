import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

// POST /api/admin/questions/rename
// Body: { field: 'difficulty' | 'question_type' | 'subject',
//         from: string,
//         to: string,
//         exam_type?: string,   // scope (optional)
//         subject?: string }    // scope (optional, only for question_type)
//
// Bulk UPDATE that renames one category label to another. Returns the row
// count that was changed so the UI can confirm. Scope filters are AND-ed.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const field = body.field as string
  const from = (body.from ?? '').toString()
  const to = (body.to ?? '').toString().trim()
  const examType = body.exam_type as string | undefined
  const subject = body.subject as string | undefined

  if (!['difficulty', 'question_type', 'subject'].includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }
  if (from === to) {
    return NextResponse.json({ updated: 0, noop: true })
  }

  const supabase = getSupabase()
  let query = supabase
    .from('questions')
    .update({ [field]: to, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq(field, from)

  if (examType) query = query.eq('exam_type', examType)
  if (subject && field !== 'subject') query = query.eq('subject', subject)

  const { error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: count ?? 0 })
}
