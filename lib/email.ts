import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const FROM = 'Kairos <kairos@kairosguidance.com>'

export async function sendWelcomeEmail(to: string, firstName: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Kairos!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Welcome to Kairos, ${firstName}!</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          We're excited to have you join our community. Kairos connects high school students with current undergraduates at top universities for personalized help with essays, test prep, and activities.
        </p>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          Whether you're looking for guidance or ready to become a tutor yourself, we're here to help you succeed.
        </p>
        <p style="font-size: 14px; color: #999; margin-top: 32px;">
          — The Kairos Team
        </p>
      </div>
    `,
  })
}

export async function sendApplicationReceivedEmail(to: string, name: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Your Kairos Tutor Application is Under Review',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Thanks for applying, ${name}!</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          We've received your tutor application and it's now <strong>under review</strong>. Our team will carefully review your background, experience, and responses.
        </p>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          You'll hear back from us soon with a decision. In the meantime, feel free to reach out if you have any questions.
        </p>
        <p style="font-size: 14px; color: #999; margin-top: 32px;">
          — The Kairos Team
        </p>
      </div>
    `,
  })
}

export async function sendApprovalEmail(to: string, name: string, services: string[]) {
  const serviceList = services.length > 0
    ? `<ul style="margin: 12px 0;">${services.map((s) => `<li style="font-size: 16px; color: #555; padding: 4px 0;">${s}</li>`).join('')}</ul>`
    : ''

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Congratulations! Your Kairos Tutor Application is Approved',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Congratulations, ${name}!</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          We're thrilled to let you know that your application to become a Kairos tutor has been <strong style="color: #16a34a;">approved</strong>!
        </p>
        ${serviceList ? `<p style="font-size: 16px; color: #555; line-height: 1.6;">You've been approved to tutor in the following services:</p>${serviceList}` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          Your next step is to set up your tutor profile so students can find and book sessions with you. Log in to your Kairos account to get started.
        </p>
        <div style="margin-top: 24px;">
          <a href="https://kairosguidance.com/auth" style="display: inline-block; padding: 12px 24px; background-color: #9333ea; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
            Set Up Your Profile
          </a>
        </div>
        <p style="font-size: 14px; color: #999; margin-top: 32px;">
          — The Kairos Team
        </p>
      </div>
    `,
  })
}

export async function sendDenialEmail(to: string, name: string, reason: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Update on Your Kairos Tutor Application',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Hi ${name},</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          Thank you for your interest in becoming a Kairos tutor. After careful review, we regret to inform you that your application has not been approved at this time.
        </p>
        ${reason ? `
        <div style="margin: 20px 0; padding: 16px; background-color: #f5f5f5; border-radius: 8px; border-left: 3px solid #9333ea;">
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0;">${reason.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          We encourage you to review the feedback above and consider reapplying in the future. We appreciate your interest in helping students succeed.
        </p>
        <p style="font-size: 14px; color: #999; margin-top: 32px;">
          — The Kairos Team
        </p>
      </div>
    `,
  })
}
