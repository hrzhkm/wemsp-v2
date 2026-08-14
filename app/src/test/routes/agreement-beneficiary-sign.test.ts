import { beforeEach, describe, expect, it, vi } from 'vitest'

import { beneficiarySignHandlers } from '@/routes/api/agreement/$id/sign/beneficiary/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  agreementFindUnique: vi.fn(),
  familyFindUnique: vi.fn(),
  beneficiaryUpdate: vi.fn(),
  beneficiaryFindMany: vi.fn(),
  agreementUpdate: vi.fn(),
  isContractConfigured: vi.fn(),
  ensureAgreementMintedWithMetadata: vi.fn(),
  getAgreementData: vi.fn(),
  getBeneficiarySignatureStatus: vi.fn(),
  recordBeneficiarySignature: vi.fn(),
  recordOwnerSignature: vi.fn(),
  getExplorerUrl: vi.fn(),
  getOnChainTimestampDate: vi.fn(),
  getOnChainErrorMessage: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: {
    agreement: {
      findUnique: mocks.agreementFindUnique,
      update: mocks.agreementUpdate,
    },
    familyMember: { findUnique: mocks.familyFindUnique },
    agreementBeneficiary: {
      update: mocks.beneficiaryUpdate,
      findMany: mocks.beneficiaryFindMany,
    },
  },
}))
vi.mock('@/lib/blockchain/contract', () => ({
  isContractConfigured: mocks.isContractConfigured,
  getAgreementData: mocks.getAgreementData,
  getBeneficiarySignatureStatus: mocks.getBeneficiarySignatureStatus,
  recordBeneficiarySignature: mocks.recordBeneficiarySignature,
  recordOwnerSignature: mocks.recordOwnerSignature,
  getExplorerUrl: mocks.getExplorerUrl,
  getOnChainTimestampDate: mocks.getOnChainTimestampDate,
  getOnChainErrorMessage: mocks.getOnChainErrorMessage,
}))
vi.mock('@/lib/agreement/agreement-metadata', () => ({
  ensureAgreementMintedWithMetadata: mocks.ensureAgreementMintedWithMetadata,
}))

describe('beneficiarySignHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOnChainTimestampDate.mockReturnValue(
      new Date('2026-01-01T00:00:00.000Z'),
    )
    mocks.getOnChainErrorMessage.mockReturnValue(null)
  })

  it('returns 400 when beneficiaryId is missing', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await beneficiarySignHandlers.POST({
      request: req,
      params: { id: 'a1' },
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not authorized beneficiary', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u2' } })
    mocks.agreementFindUnique.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      status: 'PENDING_SIGNATURES',
      beneficiaries: [
        {
          id: 99,
          familyMemberId: 50,
          nonRegisteredFamilyMemberId: null,
          hasSigned: false,
        },
      ],
    })
    mocks.familyFindUnique.mockResolvedValueOnce({
      id: 50,
      familyMemberUserId: 'u1',
    })

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ beneficiaryId: 99, accept: true }),
    })
    const res = await beneficiarySignHandlers.POST({
      request: req,
      params: { id: 'a1' },
    })
    expect(res.status).toBe(403)
  })

  it('signs beneficiary and transitions to PENDING_WITNESS when all signed', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.agreementFindUnique.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      ownerHasSigned: true,
      status: 'PENDING_SIGNATURES',
      beneficiaries: [
        {
          id: 99,
          familyMemberId: 50,
          nonRegisteredFamilyMemberId: null,
          hasSigned: false,
        },
      ],
    })
    mocks.familyFindUnique.mockResolvedValueOnce({
      id: 50,
      familyMemberUserId: 'u1',
    })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.ensureAgreementMintedWithMetadata.mockResolvedValueOnce({
      tokenId: 8,
      wasMinted: false,
      metadataUri: 'ipfs://bafy123',
    })
    mocks.getAgreementData.mockResolvedValueOnce({ ownerSigned: true })
    mocks.getBeneficiarySignatureStatus.mockResolvedValueOnce({
      hasSigned: false,
      signedAt: 0,
    })
    mocks.recordBeneficiarySignature.mockResolvedValueOnce({
      txHash: '0xbenef',
      timestamp: 1700000000,
    })
    mocks.beneficiaryUpdate.mockResolvedValueOnce({
      id: 99,
      hasSigned: true,
      signedAt: new Date(),
      isAccepted: true,
    })
    mocks.beneficiaryFindMany.mockResolvedValueOnce([
      { hasSigned: true, isAccepted: true },
    ])
    mocks.agreementUpdate.mockResolvedValueOnce({})

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ beneficiaryId: 99, accept: true }),
    })
    const res = await beneficiarySignHandlers.POST({
      request: req,
      params: { id: 'a1' },
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.agreementStatus).toBe('PENDING_WITNESS')
    expect(mocks.ensureAgreementMintedWithMetadata).toHaveBeenCalledWith('a1', [
      '99',
    ])
  })
})
