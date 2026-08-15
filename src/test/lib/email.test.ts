import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '@/lib/email'

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}))

describe('sendEmail', () => {
  beforeEach(() => {
    sendMail.mockResolvedValue(undefined)
    process.env.EMAIL_ADMIN = 'smtp@example.com'
  })

  afterEach(() => {
    delete process.env.EMAIL_FROM
    delete process.env.EMAIL_ADMIN
    vi.clearAllMocks()
  })

  it('uses the configured sender address', async () => {
    process.env.EMAIL_FROM = 'hello@example.com'

    await sendEmail('user@example.com', 'Subject', 'Message')

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'hello@example.com' }),
    )
  })

  it('falls back to the SMTP account when no sender is configured', async () => {
    await sendEmail('user@example.com', 'Subject', 'Message')

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'smtp@example.com' }),
    )
  })

  it('includes attachments when provided', async () => {
    const attachment = {
      filename: 'agreement.pdf',
      content: Buffer.from('%PDF-1.7'),
      contentType: 'application/pdf',
    }

    await sendEmail('user@example.com', 'Subject', 'Message', [attachment])

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [attachment] }),
    )
  })

  it('omits the attachments key when none are provided', async () => {
    await sendEmail('user@example.com', 'Subject', 'Message')

    expect(sendMail).toHaveBeenCalledWith(
      expect.not.objectContaining({ attachments: expect.anything() }),
    )
  })
})
