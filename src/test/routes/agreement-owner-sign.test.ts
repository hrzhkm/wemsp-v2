import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ownerSignHandlers } from '@/routes/api/agreement/$id/sign/owner/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  isContractConfigured: vi.fn(),
  ensureAgreementMintedWithMetadata: vi.fn(),
  getAgreementData: vi.fn(),
  recordOwnerSignature: vi.fn(),
  getExplorerUrl: vi.fn(),
  getOnChainTimestampDate: vi.fn(),
  getOnChainErrorMessage: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: { agreement: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('@/lib/blockchain/contract', () => ({
  isContractConfigured: mocks.isContractConfigured,
  getAgreementData: mocks.getAgreementData,
  recordOwnerSignature: mocks.recordOwnerSignature,
  getExplorerUrl: mocks.getExplorerUrl,
  getOnChainTimestampDate: mocks.getOnChainTimestampDate,
  getOnChainErrorMessage: mocks.getOnChainErrorMessage,
}))
vi.mock('@/lib/agreement/agreementMetadata', () => ({
  ensureAgreementMintedWithMetadata: mocks.ensureAgreementMintedWithMetadata,
}))

describe('ownerSignHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getExplorerUrl.mockImplementation(
      (tx: string) => `https://explorer/tx/${tx}`,
    )
    mocks.getOnChainTimestampDate.mockReturnValue(
      new Date('2026-01-01T00:00:00.000Z'),
    )
    mocks.getOnChainErrorMessage.mockReturnValue(null)
  })

  it('returns 401 when no session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const response = await ownerSignHandlers.POST({
      request: new Request('http://x', { method: 'POST', body: '{}' }),
      params: { id: 'a1' },
    })
    expect(response.status).toBe(401)
  })

  it('returns 503 when on-chain config is missing', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.isContractConfigured.mockReturnValueOnce(false)

    const response = await ownerSignHandlers.POST({
      request: new Request('http://x', { method: 'POST', body: '{}' }),
      params: { id: 'a1' },
    })
    expect(response.status).toBe(503)
  })

  it('returns 403 when user is not owner', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u2' } })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.findUnique.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      status: 'DRAFT',
      ownerHasSigned: false,
      beneficiaries: [{ id: 1 }],
    })

    const response = await ownerSignHandlers.POST({
      request: new Request('http://x', { method: 'POST', body: '{}' }),
      params: { id: 'a1' },
    })
    expect(response.status).toBe(403)
  })

  it('signs and submits successfully', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.findUnique.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      status: 'DRAFT',
      ownerHasSigned: false,
      ownerSignedAt: null,
      ownerSignatureRef: null,
      beneficiaries: [{ id: 11 }, { id: 12 }],
    })
    mocks.ensureAgreementMintedWithMetadata.mockResolvedValueOnce({
      tokenId: 7,
      wasMinted: true,
      metadataUri: 'ipfs://bafy123',
      mintResult: { txHash: '0xmint' },
    })
    mocks.getAgreementData.mockResolvedValueOnce({
      ownerSigned: false,
      ownerSignedAt: 0,
    })
    mocks.recordOwnerSignature.mockResolvedValueOnce({
      txHash: '0xowner',
      timestamp: 1700000000,
    })
    mocks.update.mockResolvedValueOnce({
      id: 'a1',
      status: 'PENDING_SIGNATURES',
      ownerHasSigned: true,
      ownerSignedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ submit: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await ownerSignHandlers.POST({
      request: req,
      params: { id: 'a1' },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.agreement.status).toBe('PENDING_SIGNATURES')
    expect(body.onChain.tokenId).toBe(7)
    expect(mocks.ensureAgreementMintedWithMetadata).toHaveBeenCalledWith('a1', [
      '11',
      '12',
    ])
  })
})
