import { beforeEach, describe, expect, it, vi } from 'vitest'

import { statusHandlers } from '@/routes/api/agreement/$id/status/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
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
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    agreementBeneficiary: {
      count: vi.fn(),
    },
    agreementAsset: {
      count: vi.fn(),
    },
  },
}))

describe('statusHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets the owner complete an ACTIVE agreement', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'owner_1' } })
    mocks.findUnique.mockResolvedValueOnce({
      id: 'agr_1',
      ownerId: 'owner_1',
      status: 'ACTIVE',
    })
    mocks.update.mockResolvedValueOnce({
      id: 'agr_1',
      status: 'COMPLETED',
    })

    const response = await statusHandlers.POST({
      request: new Request('http://localhost/api/agreement/agr_1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }),
      params: { id: 'agr_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.agreement.status).toBe('COMPLETED')
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'agr_1' },
      data: { status: 'COMPLETED' },
    })
  })

  it('rejects completion outside ACTIVE status', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'owner_1' } })
    mocks.findUnique.mockResolvedValueOnce({
      id: 'agr_1',
      ownerId: 'owner_1',
      status: 'PENDING_WITNESS',
    })

    const response = await statusHandlers.POST({
      request: new Request('http://localhost/api/agreement/agr_1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }),
      params: { id: 'agr_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain(
      'Cannot complete agreement in PENDING_WITNESS status',
    )
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
