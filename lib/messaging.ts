import { getSupabase } from './supabase'

type Supa = ReturnType<typeof getSupabase>

// Best-effort: every users.id (and approved tutor_applications.user_id) we
// consider equivalent to the same person. Same shape as the resolver inside
// app/api/messages/route.ts; duplicated here so non-message routes (e.g.
// auto-posting a "test submitted" notification) can find the right inbox
// thread without going through the HTTP API.
export async function resolveAllUserIds(
  userId: string,
  email?: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>([userId])
  const supabase = getSupabase()

  let realEmail = email ?? null
  if (!realEmail) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()
    if (user) realEmail = user.email || null
  }
  if (!realEmail) return ids

  const { data: usersByEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', realEmail)
  if (usersByEmail) for (const u of usersByEmail) ids.add(u.id)

  const { data: appByEmail } = await supabase
    .from('tutor_applications')
    .select('user_id')
    .eq('email', realEmail)
    .eq('application_status', 'approved')
    .maybeSingle()
  if (appByEmail?.user_id) ids.add(appByEmail.user_id)

  return ids
}

async function findExistingConversation(
  supabase: Supa,
  myIds: Set<string>,
  partnerIds: Set<string>,
): Promise<string | null> {
  const myArr = Array.from(myIds)
  const partnerArr = Array.from(partnerIds)
  if (myArr.length === 0 || partnerArr.length === 0) return null

  const { data: myConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('user_id', myArr)
  if (!myConvs || myConvs.length === 0) return null

  const myConvIds = Array.from(new Set(myConvs.map((c) => c.conversation_id)))
  const { data: partnerConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('user_id', partnerArr)
    .in('conversation_id', myConvIds)
  if (!partnerConvs || partnerConvs.length === 0) return null

  const sharedIds = Array.from(new Set(partnerConvs.map((c) => c.conversation_id)))
  const { data: oldest } = await supabase
    .from('conversations')
    .select('id')
    .in('id', sharedIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return oldest?.id ?? null
}

export async function findOrCreateConversation(
  supabase: Supa,
  myIds: Set<string>,
  partnerIds: Set<string>,
  myCanonicalId: string,
  partnerCanonicalId: string,
): Promise<string> {
  const existing = await findExistingConversation(supabase, myIds, partnerIds)
  if (existing) return existing

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert([{}])
    .select('id')
    .single()
  if (convErr || !conv) {
    throw new Error(`Failed to create conversation: ${convErr?.message ?? 'unknown'}`)
  }

  const { error: pErr } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, user_id: myCanonicalId },
      { conversation_id: conv.id, user_id: partnerCanonicalId },
    ])
  if (pErr) throw new Error(`Failed to add participants: ${pErr.message}`)
  return conv.id
}

// Open (or reuse) the conversation between the sender and partner, then
// insert a single message into it. Returns the new message row.
export async function sendSystemMessage(opts: {
  senderId: string
  senderEmail?: string | null
  partnerId: string
  partnerEmail?: string | null
  content: string
}): Promise<{ id: string; conversation_id: string }> {
  const supabase = getSupabase()
  const myIds = await resolveAllUserIds(opts.senderId, opts.senderEmail)
  const partnerIds = await resolveAllUserIds(opts.partnerId, opts.partnerEmail)

  const conversationId = await findOrCreateConversation(
    supabase,
    myIds,
    partnerIds,
    opts.senderId,
    opts.partnerId,
  )

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      sender_id: opts.senderId,
      receiver_id: opts.partnerId,
      content: opts.content,
      conversation_id: conversationId,
    })
    .select('id, conversation_id')
    .single()

  if (error || !message) {
    throw new Error(`Failed to insert message: ${error?.message ?? 'unknown'}`)
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return message
}
