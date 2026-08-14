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
})
