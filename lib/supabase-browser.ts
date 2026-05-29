'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — required for collaborative notes.',
    )
  }
  client = createClient(url, key, {
    // App handles its own auth via cookies/middleware; we never sign in to
    // Supabase. Disabling session management stops gotrue-js from holding the
    // Web Locks auth lock, which otherwise contends with realtime subs +
    // concurrent inserts and surfaces the 5s "lock not released" warning.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return client
}
