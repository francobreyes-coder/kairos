import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const FROM = 'Kairos <kairos@kairosguidance.com>'

function wrap(content: string) {
  return `
    <div style="background-color: #f9f5ff; padding: 32px 16px;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e9d5ff;">
        <div style="background: linear-gradient(135deg, #7c3aed, #9333ea); padding: 24px 32px;">
          <h2 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; letter-spacing: -0.3px;">kairos</h2>
        </div>
        <div style="padding: 32px;">
          ${content}
        </div>
        <div style="padding: 20px 32px; background-color: #faf5ff; border-top: 1px solid #e9d5ff; text-align: center;">
          <p style="font-size: 13px; color: #7c3aed; margin: 0;">— The Kairos Team</p>
        </div>
      </div>
    </div>
  `
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Kairos!',
    html: wrap(`
      <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 16px;">Welcome to Kairos, ${firstName}!</h1>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 12px;">
        We're excited to have you join our community. Kairos connects high school students with current undergraduates at top universities for personalized help with essays, test prep, and activities.
      </p>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
        Whether you're looking for guidance or ready to become a tutor yourself, we're here to help you succeed.
      </p>
      <div style="text-align: center;">
        <a href="https://kairosguidance.com/auth" style="display: inline-block; padding: 12px 28px; background-color: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          Get Started
        </a>
      </div>
    `),
  })
}

export async function sendApplicationReceivedEmail(to: string, name: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Your Kairos Tutor Application is Under Review',
    html: wrap(`
      <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 16px;">Thanks for applying, ${name}!</h1>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 12px;">
        We've received your tutor application and it's now <strong style="color: #7c3aed;">under review</strong>. Our team will carefully review your background, experience, and responses.
      </p>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0;">
        You'll hear back from us soon with a decision. In the meantime, feel free to reach out if you have any questions.
      </p>
    `),
  })
}

export async function sendApprovalEmail(to: string, name: string, services: string[]) {
  const serviceList = services.length > 0
    ? `<ul style="margin: 12px 0;">${services.map((s) => `<li style="font-size: 15px; color: #555; padding: 4px 0;">${s}</li>`).join('')}</ul>`
    : ''

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Congratulations! Your Kairos Tutor Application is Approved',
    html: wrap(`
      <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 16px;">Congratulations, ${name}!</h1>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 12px;">
        We're thrilled to let you know that your application to become a Kairos tutor has been <strong style="color: #7c3aed;">approved</strong>!
      </p>
      ${serviceList ? `<p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 4px;">You've been approved to tutor in the following services:</p>${serviceList}` : ''}
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
        Your next step is to set up your tutor profile so students can find and book sessions with you. Log in to your Kairos account to get started.
      </p>
      <div style="text-align: center;">
        <a href="https://kairosguidance.com/auth" style="display: inline-block; padding: 12px 28px; background-color: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          Set Up Your Profile
        </a>
      </div>
    `),
  })
}

export async function sendBookingConfirmationEmail(
  to: string,
  name: string,
  tutorName: string,
  date: string,
  timeSlot: string,
) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Session Booked with ${tutorName}`,
    html: wrap(`
      <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 16px;">Session Confirmed!</h1>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 12px;">
        Hi ${name}, your tutoring session has been booked!
      </p>
      <div style="margin: 16px 0; padding: 16px; background-color: #faf5ff; border-radius: 8px; border-left: 4px solid #7c3aed;">
        <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 8px;"><strong>Tutor:</strong> ${tutorName}</p>
        <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 8px;"><strong>Date:</strong> ${date}</p>
        <p style="font-size: 15px; color: #1a1a1a; margin: 0;"><strong>Time:</strong> ${timeSlot}</p>
      </div>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px;">
        You can view and manage your sessions from your Kairos dashboard.
      </p>
      <div style="text-align: center;">
        <a href="https://kairosguidance.com/sessions" style="display: inline-block; padding: 12px 28px; background-color: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          View My Sessions
        </a>
      </div>
    `),
  })
}

export async function sendDenialEmail(to: string, name: string, reason: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Update on Your Kairos Tutor Application',
    html: wrap(`
      <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 16px;">Hi ${name},</h1>
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 12px;">
        Thank you for your interest in becoming a Kairos tutor. After careful review, we regret to inform you that your application has not been approved at this time.
      </p>
      ${reason ? `
      <div style="margin: 16px 0; padding: 16px; background-color: #faf5ff; border-radius: 8px; border-left: 4px solid #7c3aed;">
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0;">${reason.replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}
      <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0;">
        We encourage you to review the feedback above and consider reapplying in the future. We appreciate your interest in helping students succeed.
      </p>
    `),
  })
}
