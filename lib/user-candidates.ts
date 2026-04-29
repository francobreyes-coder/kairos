import { getSupabase } from './supabase'

// Returns every user ID that should be treated as "this user" when looking
// up rows whose foreign key may have been written against a different
// users.id due to identity drift — e.g. tutor_profiles still pointing at an
// orphan id from the original application, or a session row written with
// the email-resolved users.id while the tutor signs in via a different
// row. Always includes the current signin id.
export async function getUserCandidateIds(opts: {
  id: string
  email?: string | null
}): Promise<string[]> {
  const ids = new Set<string>([opts.id])
  if (!opts.email) return Array.from(ids)

  const supabase = getSupabase()

  const { data: emailUsers } = await supabase
    .from('users')
    .select('id')
    .eq('email', opts.email)
  for (const u of emailUsers ?? []) ids.add(u.id)

  const { data: apps } = await supabase
    .from('tutor_applications')
    .select('user_id')
    .eq('email', opts.email)
  for (const a of apps ?? []) {
    if (a.user_id) ids.add(a.user_id)
  }

  return Array.from(ids)
}
