import { getSupabase } from './supabase'

// Decide where a signed-in user should land. Tutors with an approved
// application + completed profile go straight to the tutor dashboard;
// approved tutors who haven't finished onboarding are sent to /tutor/onboarding.
// Everyone else falls back to role-based routing.
export async function landingForUser(opts: {
  id?: string | null
  email?: string | null
  role?: string | null
}): Promise<string> {
  const { id, email, role } = opts
  if (!id) return '/auth'

  const supabase = getSupabase()

  // Look up an application by id first, then by email — tutors who applied
  // via credentials and later signed in with Google end up keyed under a
  // different users.id, so the email fallback heals that drift. We pull the
  // status here so suspended/banned tutors can be routed to an explainer
  // page instead of silently demoted to /home.
  let app: { user_id: string; application_status: string } | null = null

  const { data: appById } = await supabase
    .from('tutor_applications')
    .select('user_id, application_status')
    .eq('user_id', id)
    .in('application_status', ['approved', 'suspended', 'banned'])
    .maybeSingle()
  if (appById) app = appById

  if (!app && email) {
    const { data: appByEmail } = await supabase
      .from('tutor_applications')
      .select('user_id, application_status')
      .eq('email', email)
      .in('application_status', ['approved', 'suspended', 'banned'])
      .maybeSingle()
    if (appByEmail) app = appByEmail
  }

  if (app && (app.application_status === 'suspended' || app.application_status === 'banned')) {
    return '/tutor/suspended'
  }

  if (app) {
    // Profile may live under either the current id or the original
    // application user_id — check both.
    const candidateIds = Array.from(new Set([id, app.user_id]))
    const { data: profiles } = await supabase
      .from('tutor_profiles')
      .select('profile_completed')
      .in('user_id', candidateIds)

    const completed = (profiles ?? []).some((p) => p.profile_completed)
    return completed ? '/tutor/dashboard' : '/tutor/onboarding'
  }

  if (role === 'high_school') return '/student/dashboard'
  return '/home'
}
