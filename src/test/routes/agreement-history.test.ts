import { beforeEach, describe, expect, it, vi } from 'vitest'

import { agreementHistoryHandlers } from '@/routes/api/agreement/$id/history/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findAgreement: vi.fn(),
  getAgreementOnChainEvents: vi.fn(),
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
    user: { findUnique: mocks.findUser },
    agreement: { findFirst: mocks.findAgreement },
  },
}))

vi.mock('@/lib/blockchain/agreementEvents', () => ({
  getAgreementOnChainEvents: mocks.getAgreementOnChainEvents,
}))

describe('agreementHistoryHandlers.GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when there is no session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const response = await agreementHistoryHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/history'),
      params: { id: 'agr_1' },
    })
    expect(response.status).toBe(401)
    expect(mocks.getAgreementOnChainEvents).not.toHaveBeenCalled()
  })

  it('returns 404 when the agreement is outside the authorization scope', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'u1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce(null)

    const response = await agreementHistoryHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/history'),
      params: { id: 'agr_1' },
    })
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error).toBe('Agreement not found')
    expect(mocks.findAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'agr_1', OR: expect.any(Array) }),
      }),
    )
  })

  it('returns an empty event list for an unminted agreement', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'u1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce({ id: 'agr_1', tokenId: null, mintTxHash: null })

    const response = await agreementHistoryHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/history'),
      params: { id: 'agr_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.events).toEqual([])
    expect(body.tokenId).toBeNull()
    expect(mocks.getAgreementOnChainEvents).not.toHaveBeenCalled()
  })

  it('returns on-chain events for a minted agreement', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'u1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce({
      id: 'agr_1',
      tokenId: 9,
      mintTxHash: '0xmint',
    })
    mocks.getAgreementOnChainEvents.mockResolvedValueOnce([
      { type: 'AgreementMinted', label: 'Agreement NFT minted', txHash: '0xmint', blockNumber: 5 },
    ])

    const response = await agreementHistoryHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/history'),
      params: { id: 'agr_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tokenId).toBe(9)
    expect(body.events).toHaveLength(1)
    expect(mocks.getAgreementOnChainEvents).toHaveBeenCalledWith(9, '0xmint')
  })
})
