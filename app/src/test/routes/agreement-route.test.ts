import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock('@/db', () => ({
  prisma: {
    agreement: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}))

import { agreementHandlers } from '@/routes/api/agreement/$'

describe('agreementHandlers auth + lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when no session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const request = new Request('http://localhost/api/agreement/agreement', {
      method: 'GET',
    })

    const response = await agreementHandlers.GET({ request })

    expect(response.status).toBe(401)
  })

  it('PUT returns 404 when agreement does not belong to user', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findFirst.mockResolvedValueOnce(null)

    const request = new Request('http://localhost/api/agreement/abc-1', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated title' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.PUT({ request })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Agreement not found')
  })

  it('PUT blocks editing outside DRAFT lifecycle', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findFirst.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      status: 'PENDING_SIGNATURES',
      title: 'Old',
      description: null,
      distributionType: 'HIBAH',
      effectiveDate: null,
      expiryDate: null,
    })

    const request = new Request('http://localhost/api/agreement/a1', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated title' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.PUT({ request })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('Agreement can only be edited in DRAFT status')
  })
})
