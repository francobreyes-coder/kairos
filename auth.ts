import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { getSupabase } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/email'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      id: 'signup',
      name: 'Sign Up',
      credentials: {
        firstName: { type: 'text' },
        lastName: { type: 'text' },
        email: { type: 'email' },
        age: { type: 'text' },
        password: { type: 'password' },
        emailOptin: { type: 'text' },
        role: { type: 'text' },
      },
      async authorize(credentials) {
        const { firstName, lastName, email, age, password, emailOptin, role } = credentials as {
          firstName: string
          lastName: string
          email: string
          age: string
          password: string
          emailOptin: string
          role: string
        }

        if (!firstName || !lastName || !email || !age || !password) return null

        const supabase = getSupabase()

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single()

        if (existing) return null

        const id = crypto.randomUUID()
        const passwordHash = await hashPassword(password)

        await supabase.from('users').insert({
          id,
          email,
          name: `${firstName} ${lastName}`,
          role: role || 'high_school',
          updated_at: new Date().toISOString(),
        })

        try {
          await sendWelcomeEmail(email, firstName)
        } catch (e) {
          console.error('Failed to send welcome email:', e)
        }

        return { id, email, name: `${firstName} ${lastName}` }
      },
    }),
    Credentials({
      id: 'login',
      name: 'Sign In',
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        const { email, password } = credentials as {
          email: string
          password: string
        }

        if (!email || !password) return null

        const supabase = getSupabase()
        const passwordHash = await hashPassword(password)

        const { data: user } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('email', email)
          .eq('password_hash', passwordHash)
          .single()

        if (!user) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  pages: {
    signIn: '/auth',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Ensure Google OAuth users have a row in the users table
      if (account?.provider === 'google' && user.id && user.email) {
        try {
          const supabase = getSupabase()
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

          if (!existing) {
            // Carry over name/role from any existing row with this email so
            // a tutor signing in via Google for the first time keeps their
            // 'college' role instead of being silently demoted to
            // 'high_school' (which would route them to the student dashboard).
            const { data: byEmail } = await supabase
              .from('users')
              .select('name, role')
              .eq('email', user.email)
              .order('updated_at', { ascending: false })
              .limit(1)
            const source = byEmail?.[0] ?? null

            await supabase.from('users').insert({
              id: user.id,
              email: user.email ?? '',
              name: user.name ?? source?.name ?? '',
              role: source?.role ?? 'high_school',
              updated_at: new Date().toISOString(),
            })
          }
        } catch (e) {
          console.error('Failed to upsert Google user:', e)
        }
      }
      return true
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
      }
      // Fetch role from DB on first sign-in or when refreshed.
      //
      // Pull every row matching either the current user id OR the email and
      // pick the most specific role. Tutors who originally signed up with
      // credentials (role='college') and later sign in with Google end up
      // with a second users row keyed by the Google sub; an id-first lookup
      // would land on that row, see role='high_school', and route them to
      // the student dashboard. Preferring any non-default role across rows
      // heals those accounts on next sign-in.
      if (user || trigger === 'update') {
        try {
          const supabase = getSupabase()
          const userId = token.sub ?? user?.id
          const email = token.email
          const orParts = [
            userId ? `id.eq.${userId}` : null,
            email ? `email.eq.${email}` : null,
          ].filter(Boolean) as string[]

          let role: string | null = null
          if (orParts.length > 0) {
            const { data: rows } = await supabase
              .from('users')
              .select('role')
              .or(orParts.join(','))

            for (const r of rows ?? []) {
              if (r.role && r.role !== 'high_school') {
                role = r.role
                break
              }
            }
            if (!role) role = rows?.[0]?.role ?? null
          }
          token.role = role
        } catch {
          token.role = null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      session.user.role = (token.role as string) ?? null
      return session
    },
  },
})
