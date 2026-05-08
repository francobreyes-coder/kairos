import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'francobreyes@gmail.com'

const FIELD_BY_TYPE: Record<string, 'video_filename' | 'resume_filename' | 'proof_filename'> = {
  video: 'video_filename',
  resume: 'resume_filename',
  proof: 'proof_filename',
}

export async function GET(req: Request) {
  const session = await auth()
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const applicationId = searchParams.get('applicationId')
  const fileType = searchParams.get('fileType')

  if (!applicationId || !fileType) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const field = FIELD_BY_TYPE[fileType]
  if (!field) {
    return NextResponse.json({ error: 'Invalid fileType' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data: app, error: appErr } = await supabase
    .from('tutor_applications')
    .select(`user_id, email, ${field}`)
    .eq('id', applicationId)
    .single<{ user_id: string | null; email: string | null } & Record<string, string | null>>()

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const filename = app[field]
  if (!filename) {
    return NextResponse.json({ error: 'No file recorded' }, { status: 404 })
  }

  // Build the list of candidate user_ids to try. Identity drift between
  // Google / credentials sign-ins means files may live under a different
  // users.id than the one stored on the application.
  const candidateIds = new Set<string>()
  if (app.user_id) candidateIds.add(app.user_id)

  if (app.email) {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', app.email)
    for (const u of users ?? []) candidateIds.add(u.id)

    const { data: otherApps } = await supabase
      .from('tutor_applications')
      .select('user_id')
      .eq('email', app.email)
    for (const a of otherApps ?? []) {
      if (a.user_id) candidateIds.add(a.user_id)
    }
  }

  for (const candidateId of candidateIds) {
    const path = `${candidateId}/${fileType}_${filename}`
    const { data, error } = await supabase.storage
      .from('application-files')
      .createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) {
      return NextResponse.json({ url: data.signedUrl, path })
    }
  }

  // Brute-force fallback: list user folders in the bucket and probe each
  // for a matching file. Only run when the normal candidate lookup failed,
  // since this is O(n) over folders. Capped at 500 folders.
  const triedPaths = new Set<string>(
    Array.from(candidateIds).map((id) => `${id}/${fileType}_${filename}`),
  )
  let bruteFound: { url: string; path: string } | null = null

  const { data: folders } = await supabase.storage
    .from('application-files')
    .list('', { limit: 500 })

  for (const folder of folders ?? []) {
    if (!folder.name || folder.name === '.emptyFolderPlaceholder') continue
    const path = `${folder.name}/${fileType}_${filename}`
    if (triedPaths.has(path)) continue
    triedPaths.add(path)
    const { data, error } = await supabase.storage
      .from('application-files')
      .createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) {
      bruteFound = { url: data.signedUrl, path }
      break
    }
  }

  if (bruteFound) {
    return NextResponse.json(bruteFound)
  }

  const reason = candidateIds.size === 0
    ? 'Application has no user_id or email recorded. Uploads only happen when the applicant is signed in, so the file may never have reached storage.'
    : 'File not found in storage at any known path. The applicant may not have completed the upload.'

  return NextResponse.json(
    { error: reason, tried: Array.from(triedPaths) },
    { status: 404 },
  )
}
