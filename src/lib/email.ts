import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ADMIN,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
})

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  attachments?: Array<EmailAttachment>,
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_ADMIN,
    to,
    subject,
    text,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  }
  try {
    await transporter.sendMail(mailOptions)
    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error(error)
    return { success: false, message: 'Failed to send email' }
  }
}
