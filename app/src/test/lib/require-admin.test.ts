import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))

import { requireAdminFromHeaders } from '@/middleware'

describe('requireAdminFromHeaders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when there is no session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
  })

  it('returns null when the session user is not an admin', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1', role: 'USER' } })
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
  })

  it('returns the admin user when role is ADMIN', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: 'u1', role: 'ADMIN', name: 'Boss', email: 'a@b.com' },
    })
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toEqual({ id: 'u1', role: 'ADMIN', name: 'Boss', email: 'a@b.com' })
  })
})
