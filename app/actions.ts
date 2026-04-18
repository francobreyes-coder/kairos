'use server'

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
}): Promise<{ success: boolean }> {
  const url = process.env.GOOGLE_SHEETS_APPLICATIONS_URL
  if (!url) {
    console.error('GOOGLE_SHEETS_APPLICATIONS_URL is not configured')
    return { success: false }
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
    return { success: res.ok || res.status === 302 }
  } catch (err) {
    console.error('Application submission failed:', err)
    return { success: false }
  }
}
