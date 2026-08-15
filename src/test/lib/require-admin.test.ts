import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))

vi.mock('@/db', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}))

describe('requireAdminFromHeaders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when there is no session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when the DB role is not ADMIN (even if session claims otherwise)', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: 'u1', role: 'ADMIN' },
    })
    mocks.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'USER',
      name: null,
      email: null,
    })
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
  })

  it('returns the admin user when the DB role is ADMIN', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'ADMIN',
      name: 'Boss',
      email: 'a@b.com',
    })
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toEqual({
      id: 'u1',
      role: 'ADMIN',
      name: 'Boss',
      email: 'a@b.com',
    })
  })

  it('returns null when the session has no user', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: undefined })
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when the DB user no longer exists', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: 'u1', role: 'ADMIN' },
    })
    mocks.findUnique.mockResolvedValueOnce(null)
    const result = await requireAdminFromHeaders(new Headers())
    expect(result).toBeNull()
  })
})
