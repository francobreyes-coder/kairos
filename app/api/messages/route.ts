import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

// Resolve all user IDs associated with this session (handles Google OAuth vs Credentials mismatch)
async function resolveUserIds(sessionUserId: string, sessionEmail: string | null | undefined) {
  const ids = new Set<string>([sessionUserId])
  if (!sessionEmail) return ids

  const supabase = getSupabase()

  // Check if there's a credentials-based account with the same email
  const { data: userByEmail } = await supabase
    .from('users')
    .select('id')
    .eq('contact_email', sessionEmail)
    .single()

  if (userByEmail) ids.add(userByEmail.id)

  // Check if there's a tutor application with the same email
  const { data: appByEmail } = await supabase
    .from('tutor_applications')
    .select('user_id')
    .eq('email', sessionEmail)
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
  const userIds = await resolveUserIds(session.user.id, session.user.email)
  const idArray = Array.from(userIds)
  const withUser = req.nextUrl.searchParams.get('with')

  if (withUser) {
    // Fetch messages between current user (any of their IDs) and specified user
    const orClauses = idArray.flatMap((uid) => [
      `and(sender_id.eq.${uid},receiver_id.eq.${withUser})`,
      `and(sender_id.eq.${withUser},receiver_id.eq.${uid})`,
    ])

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(orClauses.join(','))
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages ?? [] })
  }

  // Fetch conversation list — all unique users this user has messaged with
  const { data: sent, error: sentErr } = await supabase
    .from('messages')
    .select('receiver_id, content, created_at')
    .in('sender_id', idArray)
    .order('created_at', { ascending: false })

  const { data: received, error: recvErr } = await supabase
    .from('messages')
    .select('sender_id, content, created_at')
    .in('receiver_id', idArray)
    .order('created_at', { ascending: false })

  if (sentErr || recvErr) {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  // Build a map of conversations: other user ID -> latest message
  const convMap = new Map<string, { content: string; created_at: string; is_sender: boolean }>()

  for (const m of sent ?? []) {
    // Skip if the receiver is also one of our IDs (self-message across accounts)
    if (userIds.has(m.receiver_id)) continue
    const existing = convMap.get(m.receiver_id)
    if (!existing || m.created_at > existing.created_at) {
      convMap.set(m.receiver_id, { content: m.content, created_at: m.created_at, is_sender: true })
    }
  }

  for (const m of received ?? []) {
    if (userIds.has(m.sender_id)) continue
    const existing = convMap.get(m.sender_id)
    if (!existing || m.created_at > existing.created_at) {
      convMap.set(m.sender_id, { content: m.content, created_at: m.created_at, is_sender: false })
    }
  }

  // Get names for all conversation partners
  const partnerIds = Array.from(convMap.keys())
  const nameMap = new Map<string, string>()

  if (partnerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', partnerIds)

    if (users) {
      for (const u of users) {
        nameMap.set(u.id, u.name ?? 'Unknown')
      }
    }

    // Also check tutor_applications for better names
    const { data: apps } = await supabase
      .from('tutor_applications')
      .select('user_id, name')
      .in('user_id', partnerIds)
      .eq('application_status', 'approved')

    if (apps) {
      for (const a of apps) {
        nameMap.set(a.user_id, a.name)
      }
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

  return NextResponse.json({ conversations })
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

  // Resolve sender's canonical ID (use tutor application ID if they have one, otherwise session ID)
  const userIds = await resolveUserIds(session.user.id, session.user.email)

  if (userIds.has(receiverId)) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  // Use the session user ID as sender (consistent with what the client sees)
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
    .select()
    .single()

  if (error) {
    console.error('Failed to send message:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ message }, { status: 201 })
}
