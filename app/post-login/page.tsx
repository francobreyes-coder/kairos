import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { landingForUser } from '@/lib/landing-for-user'

// Server-side router used as the callback URL for sign-in flows. Centralizes
// the "where do I go after login" decision so tutors with an approved app +
// completed profile land on /tutor/dashboard instead of the marketing home.
export default async function PostLoginPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth')

  const url = await landingForUser({
    id: session.user.id,
    email: session.user.email,
    role: (session.user as { role?: string | null }).role ?? null,
  })
  redirect(url)
}
