import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { broadcastNewMessage } from '@/lib/broadcast'

type Supa = ReturnType<typeof getSupabase>

// Resolve every users.id (and approved tutor_applications.user_id) that
// belongs to the same person. Used once when a chat is opened or a message
// is sent — after that, the conversation_id on each message anchors the
// thread regardless of which id the participant happens to be logged in as.
async function resolveAllIds(userId: string, email?: string | null): Promise<Set<string>> {
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

  if (!realEmail) {
    const { data: app } = await supabase
      .from('tutor_applications')
      .select('email, user_id')
      .eq('user_id', userId)
      .single()
    if (app?.email) {
      realEmail = app.email
      ids.add(app.user_id)
    }
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
    .single()
  if (appByEmail) ids.add(appByEmail.user_id)

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
  // Deterministic: oldest conversation wins, so drifted-id duplicates get
  // collapsed onto the original thread instead of forking off.
  const { data: oldest } = await supabase
    .from('conversations')
    .select('id')
    .in('id', sharedIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return oldest?.id ?? null
}

async function findOrCreateConversation(
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
  if (pErr) {
    throw new Error(`Failed to add participants: ${pErr.message}`)
  }

  // Race-safety: re-check after the insert. If another concurrent send
  // already created a conversation for this user pair, fall back to the
  // oldest one (findExistingConversation orders by created_at asc) so both
  // clients converge on the same thread instead of forking.
  const after = await findExistingConversation(supabase, myIds, partnerIds)
  if (after && after !== conv.id) {
    await supabase.from('conversations').delete().eq('id', conv.id)
    return after
  }

  return conv.id
}

// Best-effort display name for a list of user ids. Tries the users table,
// approved tutor_applications, students, then an email-bridge in case the
// id is one of the drifted variants we already know about.
async function fetchNameMap(
  supabase: Supa,
  userIds: string[],
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>()
  if (userIds.length === 0) return nameMap

  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds)
  if (users) for (const u of users) if (u.name) nameMap.set(u.id, u.name)

  const { data: students } = await supabase
    .from('students')
    .select('user_id, name')
    .in('user_id', userIds)
  if (students) for (const s of students) if (s.name) nameMap.set(s.user_id, s.name)

  // tutor_applications wins over students/users — it's the source of truth
  // for a tutor's display name.
  const { data: apps } = await supabase
    .from('tutor_applications')
    .select('user_id, name')
    .in('user_id', userIds)
    .eq('application_status', 'approved')
  if (apps) for (const a of apps) if (a.name) nameMap.set(a.user_id, a.name)

  const missing = userIds.filter((id) => !nameMap.has(id))
  if (missing.length > 0) {
    const { data: missingUsers } = await supabase
      .from('users')
      .select('id, email')
      .in('id', missing)
    if (missingUsers) {
      const emailToIds = new Map<string, string[]>()
      for (const u of missingUsers) {
        if (!u.email) continue
        const arr = emailToIds.get(u.email) ?? []
        arr.push(u.id)
        emailToIds.set(u.email, arr)
      }
      if (emailToIds.size > 0) {
        const { data: appsByEmail } = await supabase
          .from('tutor_applications')
          .select('email, name')
          .in('email', Array.from(emailToIds.keys()))
          .eq('application_status', 'approved')
        if (appsByEmail) {
          for (const a of appsByEmail) {
            const ids = emailToIds.get(a.email) ?? []
            for (const id of ids) {
              if (!nameMap.has(id) && a.name) nameMap.set(id, a.name)
            }
          }
        }
      }
    }
  }

  return nameMap
}

// GET /api/messages
//   no params              → conversation list for the current user
//   ?with=<partnerId>      → messages in the conversation with that partner
//                            (returns [] if no conversation exists yet)
//   ?conversationId=<uuid> → messages in that conversation (must be a member)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const myIds = await resolveAllIds(session.user.id, session.user.email)
  const myIdArray = Array.from(myIds)
  const withUser = req.nextUrl.searchParams.get('with')
  const conversationIdParam = req.nextUrl.searchParams.get('conversationId')

  // ── messages for a specific conversation ─────────────────────────────────
  if (conversationIdParam) {
    const { data: membership } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationIdParam)
      .in('user_id', myIdArray)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, conversation_id')
      .eq('conversation_id', conversationIdParam)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages by conversation:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: messages ?? [],
      myIds: myIdArray,
      conversationId: conversationIdParam,
    })
  }

  // ── messages with a specific partner ─────────────────────────────────────
  if (withUser) {
    const partnerIds = await resolveAllIds(withUser)
    const conversationId = await findExistingConversation(supabase, myIds, partnerIds)

    if (!conversationId) {
      return NextResponse.json({
        messages: [],
        myIds: myIdArray,
        conversationId: null,
      })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, conversation_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: messages ?? [],
      myIds: myIdArray,
      conversationId,
    })
  }

  // ── conversation list ────────────────────────────────────────────────────
  const { data: myMemberships, error: memErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('user_id', myIdArray)

  if (memErr) {
    console.error('Failed to fetch memberships:', memErr)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  const convIds = Array.from(new Set((myMemberships ?? []).map((m) => m.conversation_id)))
  if (convIds.length === 0) {
    return NextResponse.json({ conversations: [], myIds: myIdArray })
  }

  const { data: allParticipants } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds)

  const partnersByConv = new Map<string, string[]>()
  for (const p of allParticipants ?? []) {
    if (myIds.has(p.user_id)) continue
    const arr = partnersByConv.get(p.conversation_id) ?? []
    arr.push(p.user_id)
    partnersByConv.set(p.conversation_id, arr)
  }

  const { data: msgs } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at, sender_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const latestByConv = new Map<
    string,
    { content: string; created_at: string; sender_id: string }
  >()
  for (const m of msgs ?? []) {
    if (!latestByConv.has(m.conversation_id)) {
      latestByConv.set(m.conversation_id, {
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender_id,
      })
    }
  }

  const allPartnerIds = new Set<string>()
  for (const arr of partnersByConv.values()) for (const id of arr) allPartnerIds.add(id)
  const nameMap = await fetchNameMap(supabase, Array.from(allPartnerIds))

  const conversations = convIds
    .map((convId) => {
      const partnerIds = partnersByConv.get(convId) ?? []
      const partnerId = partnerIds[0] ?? ''
      const latest = latestByConv.get(convId)
      if (!latest) return null
      return {
        conversation_id: convId,
        partner_id: partnerId,
        partner_name: nameMap.get(partnerId) ?? 'Unknown',
        last_message: latest.content,
        last_message_at: latest.created_at,
        last_message_is_mine: myIds.has(latest.sender_id),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))

  return NextResponse.json({ conversations, myIds: myIdArray })
}

// POST /api/messages
//   body: { conversationId?, receiverId?, content, sessionId? }
//
// At least one of conversationId / receiverId must be present. If only
// receiverId is given, a conversation is found-or-created between the
// current user and that partner (using email-based id resolution to merge
// drifted ids onto the original thread).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { conversationId, receiverId, content, sessionId } = body as {
    conversationId?: string
    receiverId?: string
    content?: string
    sessionId?: string
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Missing content' }, { status: 400 })
  }
  if (!conversationId && !receiverId) {
    return NextResponse.json(
      { error: 'Missing conversationId or receiverId' },
      { status: 400 },
    )
  }

  const supabase = getSupabase()
  const myIds = await resolveAllIds(session.user.id, session.user.email)

  let resolvedConvId: string
  let resolvedReceiverId: string

  if (conversationId) {
    const { data: membership } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .in('user_id', Array.from(myIds))
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const { data: others } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)

    const otherId = (others ?? [])
      .map((o) => o.user_id)
      .find((id) => !myIds.has(id))

    if (!otherId) {
      return NextResponse.json({ error: 'Conversation has no other participant' }, { status: 400 })
    }

    resolvedConvId = conversationId
    resolvedReceiverId = otherId
  } else {
    if (myIds.has(receiverId!)) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    const partnerIds = await resolveAllIds(receiverId!)

    try {
      resolvedConvId = await findOrCreateConversation(
        supabase,
        myIds,
        partnerIds,
        session.user.id,
        receiverId!,
      )
    } catch (err) {
      console.error('findOrCreateConversation failed:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to open conversation' },
        { status: 500 },
      )
    }

    resolvedReceiverId = receiverId!
  }

  const insertData: Record<string, unknown> = {
    sender_id: session.user.id,
    receiver_id: resolvedReceiverId,
    content: content.trim(),
    conversation_id: resolvedConvId,
  }
  if (sessionId) insertData.session_id = sessionId

  const { data: message, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select('id, sender_id, receiver_id, content, created_at, conversation_id')
    .single()

  if (error) {
    console.error('Failed to send message:', error)
    return NextResponse.json(
      { error: `Failed to send message: ${error.message}` },
      { status: 500 },
    )
  }

  // Bump conversation updated_at so the chat list sorts correctly even when
  // we only had a single-row insert above.
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', resolvedConvId)

  // Push the new row to anyone subscribed to this conversation's broadcast
  // topic. Using broadcast (not postgres_changes) lets RLS on `messages` stay
  // strict — only the server ever reads from the table.
  await broadcastNewMessage(resolvedConvId, message)

  return NextResponse.json(
    { message, conversationId: resolvedConvId },
    { status: 201 },
  )
}
