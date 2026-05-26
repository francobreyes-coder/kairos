import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { PauseCircle, Ban } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function loadStatus(opts: { id: string; email?: string | null }) {
  const supabase = getSupabase()

  const { data: byId } = await supabase
    .from('tutor_applications')
    .select('application_status')
    .eq('user_id', opts.id)
    .in('application_status', ['approved', 'suspended', 'banned'])
    .maybeSingle()
  if (byId) return byId.application_status as string

  if (opts.email) {
    const { data: byEmail } = await supabase
      .from('tutor_applications')
      .select('application_status')
      .eq('email', opts.email)
      .in('application_status', ['approved', 'suspended', 'banned'])
      .maybeSingle()
    if (byEmail) return byEmail.application_status as string
  }

  return null
}

export default async function TutorSuspendedPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth')

  const status = await loadStatus({ id: session.user.id, email: session.user.email })

  if (!status) redirect('/home')
  if (status === 'approved') redirect('/tutor/dashboard')

  const banned = status === 'banned'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border p-8 ${
          banned
            ? 'bg-red-500/5 border-red-500/30'
            : 'bg-orange-500/5 border-orange-500/30'
        }`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-5 ${
            banned ? 'bg-red-500/10' : 'bg-orange-500/10'
          }`}>
            {banned ? (
              <Ban className="w-6 h-6 text-red-600" />
            ) : (
              <PauseCircle className="w-6 h-6 text-orange-600" />
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            {banned ? 'Your tutor account has been banned' : 'Your tutor account is suspended'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            {banned
              ? 'Your Kairos tutor account is no longer active. You cannot accept new bookings, message students, or access the tutor dashboard.'
              : "Your Kairos tutor account is temporarily on hold. While suspended you won't appear in student matching and you can't accept new bookings."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            If you think this is a mistake or you'd like to appeal, please reach out to us.
          </p>
          <a
            href="mailto:kairos@kairosguidance.com"
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Contact Kairos
          </a>
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/home"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
