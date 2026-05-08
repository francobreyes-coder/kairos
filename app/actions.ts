'use server'

import { auth } from '@/auth'
import { getSupabase } from '@/lib/supabase'
import { sendApplicationReceivedEmail } from '@/lib/email'

export async function submitWaitlist(
  email: string,
  userType: string
): Promise<{ success: boolean }> {
  const url = process.env.GOOGLE_SHEETS_WAITLIST_URL
  if (!url) {
    console.error('GOOGLE_SHEETS_WAITLIST_URL is not configured')
    return { success: false }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        userType,
        timestamp: new Date().toISOString(),
      }),
      redirect: 'follow',
    })
    return { success: res.ok || res.status === 302 }
  } catch (err) {
    console.error('Waitlist submission failed:', err)
    return { success: false }
  }
}

export async function submitApplication(data: {
  name: string
  email: string
  dob: string
  university: string
  graduationYear: string
  major: string
  hobbies: string
  collegeAcceptances: string
  services: string[]
  satScore: string
  passion: string
  whyKairos: string
  videoFilename: string
  resumeFilename: string
  proofFilename: string
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to apply.' }
  }
  if (session.user.role !== 'college') {
    return { success: false, error: 'Tutor applications are only open to college students.' }
  }

  const url = process.env.GOOGLE_SHEETS_APPLICATIONS_URL
  if (!url) {
    console.error('GOOGLE_SHEETS_APPLICATIONS_URL is not configured')
    return { success: false, error: 'Submission service not configured.' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        services: data.services.join(', '),
        timestamp: new Date().toISOString(),
      }),
      redirect: 'follow',
    })

    const supabase = getSupabase()
    const email = data.email?.trim() || session?.user?.email || ''
    await supabase.from('tutor_applications').insert({
      user_id: session?.user?.id ?? null,
      name: data.name,
      email,
      dob: data.dob,
      university: data.university,
      graduation_year: data.graduationYear,
      major: data.major,
      hobbies: data.hobbies,
      college_acceptances: data.collegeAcceptances,
      services_applied: data.services,
      sat_score: data.satScore,
      passion: data.passion,
      why_kairos: data.whyKairos,
      video_filename: data.videoFilename,
      resume_filename: data.resumeFilename,
      proof_filename: data.proofFilename,
      application_status: 'pending',
    })

    if (email) {
      try {
        await sendApplicationReceivedEmail(email, data.name)
      } catch (e) {
        console.error('Failed to send application received email:', e)
      }
    }

    return { success: res.ok || res.status === 302 }
  } catch (err) {
    console.error('Application submission failed:', err)
    return { success: false }
  }
}
