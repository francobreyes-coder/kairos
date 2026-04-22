import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

// Resolve all user IDs linked to the same person.
// Works from a session (with email) or from just an ID (for partners).
async function resolveAllIds(userId: string, email?: string | null) {
  const ids = new Set<string>([userId])
  const supabase = getSupabase()

  // Step 1: find the user's real email if not provided
  let realEmail = email
  if (!realEmail) {
    const { data: user } = await supabase
      .from('users')
      .select('email, contact_email')
      .eq('id', userId)
      .single()

    if (user) {
      // Use email field (real email), not contact_email (might be "google:xxx")
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

  if (withUser) {
    // Resolve the PARTNER's IDs too — they may have sent messages from a different auth account
    const partnerIds = await resolveAllIds(withUser)
    const partnerIdArray = Array.from(partnerIds)

    // Find all messages between any of my IDs and any of the partner's IDs
    const orClauses = myIdArray.flatMap((uid) =>
      partnerIdArray.flatMap((pid) => [
        `and(sender_id.eq.${uid},receiver_id.eq.${pid})`,
        `and(sender_id.eq.${pid},receiver_id.eq.${uid})`,
      ])
    )

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(orClauses.join(','))
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages ?? [], myIds: myIdArray })
  }

  // Fetch conversation list — all messages involving any of my IDs
  const { data: sent, error: sentErr } = await supabase
    .from('messages')
    .select('receiver_id, content, created_at')
    .in('sender_id', myIdArray)
    .order('created_at', { ascending: false })

  const { data: received, error: recvErr } = await supabase
    .from('messages')
    .select('sender_id, sender_name, content, created_at')
    .in('receiver_id', myIdArray)
    .order('created_at', { ascending: false })

  if (sentErr || recvErr) {
    console.error('Failed to fetch conversations:', sentErr, recvErr)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  // For each partner, resolve ALL their IDs so we can merge conversations
  // First, collect all unique partner IDs
  const rawPartnerIds = new Set<string>()
  for (const m of sent ?? []) {
    if (!myIds.has(m.receiver_id)) rawPartnerIds.add(m.receiver_id)
  }
  for (const m of received ?? []) {
    if (!myIds.has(m.sender_id)) rawPartnerIds.add(m.sender_id)
  }

  // Resolve each partner's IDs and build a mapping: any partner ID -> canonical partner ID
  const canonicalMap = new Map<string, string>() // partnerId -> canonical (first resolved ID)
  const resolvedGroups: { canonical: string; allIds: Set<string> }[] = []

  for (const pid of rawPartnerIds) {
    if (canonicalMap.has(pid)) continue // already resolved via another ID
    const allIds = await resolveAllIds(pid)
    const canonical = pid // use the first-seen ID as canonical
    for (const id of allIds) {
      canonicalMap.set(id, canonical)
    }
    resolvedGroups.push({ canonical, allIds })
  }

  // Build conversation map using canonical IDs
  const convMap = new Map<string, { content: string; created_at: string; is_sender: boolean }>()
  const senderNameMap = new Map<string, string>()

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
    if (m.sender_name) {
      senderNameMap.set(canonical, m.sender_name)
    }
  }

  // Get names for all conversation partners
  const partnerIds = Array.from(convMap.keys())
  const nameMap = new Map<string, string>()

  if (partnerIds.length > 0) {
    // Collect all IDs across all resolved groups for these partners
    const allPartnerIds = new Set<string>()
    for (const pid of partnerIds) {
      allPartnerIds.add(pid)
      const group = resolvedGroups.find((g) => g.canonical === pid)
      if (group) {
        for (const id of group.allIds) allPartnerIds.add(id)
      }
    }
    const allPartnerIdArray = Array.from(allPartnerIds)

    // Check users table
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

    // Check tutor_applications
    const { data: apps } = await supabase
      .from('tutor_applications')
      .select('user_id, name')
      .in('user_id', allPartnerIdArray)
      .eq('application_status', 'approved')

    if (apps) {
      for (const a of apps) {
        const canonical = canonicalMap.get(a.user_id) ?? a.user_id
        nameMap.set(canonical, a.name) // tutor app name takes priority
      }
    }

    // Check students table
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

    // Use sender_name from messages as final fallback
    for (const [id, name] of senderNameMap) {
      if (!nameMap.has(id)) nameMap.set(id, name)
    }
  }

  const conversations = partnerIds
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

  // Resolve the sender's display name
  let senderName = session.user.name ?? ''
  if (!senderName && session.user.email) {
    const { data: u } = await supabase
      .from('users')
      .select('name')
      .eq('contact_email', session.user.email)
      .single()
    if (u?.name) senderName = u.name
  }

  const insertData: Record<string, unknown> = {
    sender_id: session.user.id,
    receiver_id: receiverId,
    sender_name: senderName,
    content: content.trim(),
  }

  if (sessionId) {
    insertData.session_id = sessionId
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Failed to send message:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ message }, { status: 201 })
}
