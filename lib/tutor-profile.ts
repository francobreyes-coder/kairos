import { getSupabase } from './supabase'

// Resolve the tutor's profile row + approved application for a given session
// user. Handles identity drift between Google / credentials sign-ins by
// falling back to email-based lookup the same way /api/tutor/profile does.
export async function findTutorProfile(opts: {
  id: string
  email?: string | null
}) {
  const supabase = getSupabase()

  let { data: profile } = await supabase
    .from('tutor_profiles')
    .select('user_id, stripe_account_id, profile_completed')
    .eq('user_id', opts.id)
    .single()

  let { data: application } = await supabase
    .from('tutor_applications')
    .select('id, user_id, name, email')
    .eq('user_id', opts.id)
    .eq('application_status', 'approved')
    .single()

  if (!application && opts.email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('id, user_id, name, email')
      .eq('email', opts.email)
      .eq('application_status', 'approved')
      .single()
    if (appByEmail) {
      application = appByEmail
      if (!profile) {
        const { data: profileByOriginal } = await supabase
          .from('tutor_profiles')
          .select('user_id, stripe_account_id, profile_completed')
          .eq('user_id', appByEmail.user_id)
          .single()
        if (profileByOriginal) profile = profileByOriginal
      }
    }
  }

  return { profile, application }
}
