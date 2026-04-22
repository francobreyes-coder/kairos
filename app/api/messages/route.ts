import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

// Resolve all user IDs linked to the same person.
async function resolveAllIds(userId: string, email?: string | null) {
  const ids = new Set<string>([userId])
  const supabase = getSupabase()

  // Step 1: find the user's real email if not provided
  let realEmail = email ?? null
  if (!realEmail) {
    const { data: user } = await supabase
      .from('users')
      .select('email, contact_email')
      .eq('id', userId)
      .single()

    if (user) {
      realEmail = user.email || (user.contact_email?.startsWith('google:') ? null : user.contact_email)
    }
  }

  // Step 2: if we still don't have an email, check tutor_applications
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

  // Step 3: find ALL user IDs sharing this email
  const { data: usersByEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', realEmail)

  if (usersByEmail) {
    for (const u of usersByEmail) ids.add(u.id)
  }

  const { data: usersByContact } = await supabase
    .from('users')
    .select('id')
    .eq('contact_email', realEmail)

  if (usersByContact) {
    for (const u of usersByContact) ids.add(u.id)
  }

  // Step 4: check tutor_applications for this email
  const { data: appByEmail } = await supabase
    .from('tutor_applications')
    .select('user_id')
    .eq('email', realEmail)
    .eq('application_status', 'approved')
    .single()

  if (appByEmail) ids.add(appByEmail.user_id)

  return ids
}

// GET /api/messages — fetch conversations or messages with a specific user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const myIds = await resolveAllIds(session.user.id, session.user.email)
  const myIdArray = Array.from(myIds)
  const withUser = req.nextUrl.searchParams.get('with')

  // Debug param — add ?debug=1 to see ID resolution
  const debug = req.nextUrl.searchParams.get('debug')

  if (withUser) {
    // Resolve the PARTNER's IDs too
    const partnerIds = await resolveAllIds(withUser)
    const partnerIdArray = Array.from(partnerIds)

    if (debug) {
      return NextResponse.json({
        myIds: myIdArray,
        partnerIds: partnerIdArray,
        sessionUserId: session.user.id,
        sessionEmail: session.user.email,
        sessionName: session.user.name,
      })
    }

    // Find all messages between any of my IDs and any of the partner's IDs
    const orClauses = myIdArray.flatMap((uid) =>
      partnerIdArray.flatMap((pid) => [
        `and(sender_id.eq.${uid},receiver_id.eq.${pid})`,
        `and(sender_id.eq.${pid},receiver_id.eq.${uid})`,
      ])
    )

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(orClauses.join(','))
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages ?? [], myIds: myIdArray })
  }

  if (debug) {
    // Show all messages involving my IDs for debugging
    const { data: allMsgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(myIdArray.map(id => `sender_id.eq.${id},receiver_id.eq.${id}`).join(','))
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      myIds: myIdArray,
      sessionUserId: session.user.id,
      sessionEmail: session.user.email,
      messages: allMsgs ?? [],
    })
  }

  // Fetch conversation list
  const { data: sent, error: sentErr } = await supabase
    .from('messages')
    .select('receiver_id, content, created_at')
    .in('sender_id', myIdArray)
    .order('created_at', { ascending: false })

  const { data: received, error: recvErr } = await supabase
    .from('messages')
    .select('sender_id, content, created_at')
    .in('receiver_id', myIdArray)
    .order('created_at', { ascending: false })

  if (sentErr || recvErr) {
    console.error('Conv list error:', sentErr, recvErr)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  // Collect all raw partner IDs
  const rawPartnerIds = new Set<string>()
  for (const m of sent ?? []) {
    if (!myIds.has(m.receiver_id)) rawPartnerIds.add(m.receiver_id)
  }
  for (const m of received ?? []) {
    if (!myIds.has(m.sender_id)) rawPartnerIds.add(m.sender_id)
  }

  // Resolve each partner's IDs and build canonical mapping
  const canonicalMap = new Map<string, string>()
  const resolvedGroups: { canonical: string; allIds: Set<string> }[] = []

  for (const pid of rawPartnerIds) {
    if (canonicalMap.has(pid)) continue
    const allIds = await resolveAllIds(pid)
    const canonical = pid
    for (const id of allIds) {
      canonicalMap.set(id, canonical)
    }
    resolvedGroups.push({ canonical, allIds })
  }

  // Build conversation map using canonical IDs
  const convMap = new Map<string, { content: string; created_at: string; is_sender: boolean }>()

  for (const m of sent ?? []) {
    if (myIds.has(m.receiver_id)) continue
    const canonical = canonicalMap.get(m.receiver_id) ?? m.receiver_id
    const existing = convMap.get(canonical)
    if (!existing || m.created_at > existing.created_at) {
      convMap.set(canonical, { content: m.content, created_at: m.created_at, is_sender: true })
    }
  }

  for (const m of received ?? []) {
    if (myIds.has(m.sender_id)) continue
    const canonical = canonicalMap.get(m.sender_id) ?? m.sender_id
    const existing = convMap.get(canonical)
    if (!existing || m.created_at > existing.created_at) {
      convMap.set(canonical, { content: m.content, created_at: m.created_at, is_sender: false })
    }
  }

  // Get names for all conversation partners
  const convPartnerIds = Array.from(convMap.keys())
  const nameMap = new Map<string, string>()

  if (convPartnerIds.length > 0) {
    const allPartnerIds = new Set<string>()
    for (const pid of convPartnerIds) {
      allPartnerIds.add(pid)
      const group = resolvedGroups.find((g) => g.canonical === pid)
      if (group) {
        for (const id of group.allIds) allPartnerIds.add(id)
      }
    }
    const allPartnerIdArray = Array.from(allPartnerIds)

    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', allPartnerIdArray)

    if (users) {
      for (const u of users) {
        if (u.name) {
          const canonical = canonicalMap.get(u.id) ?? u.id
          if (!nameMap.has(canonical)) nameMap.set(canonical, u.name)
        }
      }
    }

    const { data: apps } = await supabase
      .from('tutor_applications')
      .select('user_id, name')
      .in('user_id', allPartnerIdArray)
      .eq('application_status', 'approved')

    if (apps) {
      for (const a of apps) {
        const canonical = canonicalMap.get(a.user_id) ?? a.user_id
        nameMap.set(canonical, a.name)
      }
    }

    const { data: students } = await supabase
      .from('students')
      .select('user_id, name')
      .in('user_id', allPartnerIdArray)

    if (students) {
      for (const s of students) {
        if (s.name) {
          const canonical = canonicalMap.get(s.user_id) ?? s.user_id
          if (!nameMap.has(canonical)) nameMap.set(canonical, s.name)
        }
      }
    }
  }

  const conversations = convPartnerIds
    .map((partnerId) => {
      const conv = convMap.get(partnerId)!
      return {
        partner_id: partnerId,
        partner_name: nameMap.get(partnerId) ?? 'Unknown',
        last_message: conv.content,
        last_message_at: conv.created_at,
        last_message_is_mine: conv.is_sender,
      }
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))

  return NextResponse.json({ conversations, myIds: myIdArray })
}

// POST /api/messages — send a message
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { receiverId, content, sessionId } = body

  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: 'Missing receiver or content' }, { status: 400 })
  }

  const myIds = await resolveAllIds(session.user.id, session.user.email)

  if (myIds.has(receiverId)) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  const supabase = getSupabase()

  const insertData: Record<string, unknown> = {
    sender_id: session.user.id,
    receiver_id: receiverId,
    content: content.trim(),
  }

  if (sessionId) {
    insertData.session_id = sessionId
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select('id, sender_id, receiver_id, content, created_at')
    .single()

  if (error) {
    console.error('Failed to send message:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ message }, { status: 201 })
}
