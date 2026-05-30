// Fire-and-forget broadcast to Supabase Realtime. We use broadcast instead of
// postgres_changes so the messages table can stay locked down by RLS: only the
// server (service role) ever reads from it, and the client subscribes to a
// topic that the server explicitly publishes to after each insert.
//
// Topic naming: `messages:${conversationId}` — same as the client subscriber.
// Event name: `new_message`. Payload: the inserted row exactly as returned to
// the sender, so subscribers can append it to the thread.

export async function broadcastNewMessage(
  conversationId: string,
  message: unknown,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `messages:${conversationId}`,
            event: 'new_message',
            payload: message,
          },
        ],
      }),
    })
  } catch (err) {
    // Broadcast is best-effort: the receiver can always pick the message up
    // on next fetch / page load. Don't fail the send just because realtime
    // had a hiccup.
    console.warn('[broadcast] failed:', err)
  }
}
