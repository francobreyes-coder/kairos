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
          .eq('contact_email', email)
          .single()

        if (existing) return null

        const id = crypto.randomUUID()
        const passwordHash = await hashPassword(password)

        await supabase.from('users').insert({
          id,
          email,
          name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          contact_email: email,
          age: parseInt(age, 10),
          password_hash: passwordHash,
          email_optin: emailOptin === 'true',
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
          .eq('contact_email', email)
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
