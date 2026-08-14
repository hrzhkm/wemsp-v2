import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adminSignOnBehalfHandlers } from '@/routes/api/admin/agreements/sign-on-behalf/$'

const mocks = vi.hoisted(() => ({
  requireAdminFromHeaders: vi.fn(),
  beneficiaryFindUnique: vi.fn(),
  beneficiaryUpdate: vi.fn(),
  beneficiaryFindMany: vi.fn(),
  agreementUpdate: vi.fn(),
  ensureAgreementMintedWithMetadata: vi.fn(),
  getAgreementData: vi.fn(),
  getBeneficiarySignatureStatus: vi.fn(),
  recordBeneficiarySignature: vi.fn(),
  recordOwnerSignature: vi.fn(),
  isContractConfigured: vi.fn(),
  getExplorerUrl: vi.fn(),
  getOnChainTimestampDate: vi.fn(),
  getOnChainErrorMessage: vi.fn(),
}))

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdminFromHeaders: mocks.requireAdminFromHeaders,
}))
vi.mock('@/db', () => ({
  prisma: {
    agreementBeneficiary: {
      findUnique: mocks.beneficiaryFindUnique,
      update: mocks.beneficiaryUpdate,
      findMany: mocks.beneficiaryFindMany,
    },
    agreement: {
      update: mocks.agreementUpdate,
    },
  },
}))
vi.mock('@/lib/agreement/agreement-metadata', () => ({
  ensureAgreementMintedWithMetadata: mocks.ensureAgreementMintedWithMetadata,
}))
vi.mock('@/lib/blockchain/contract', () => ({
  getAgreementData: mocks.getAgreementData,
  getBeneficiarySignatureStatus: mocks.getBeneficiarySignatureStatus,
  recordBeneficiarySignature: mocks.recordBeneficiarySignature,
  recordOwnerSignature: mocks.recordOwnerSignature,
  isContractConfigured: mocks.isContractConfigured,
  getExplorerUrl: mocks.getExplorerUrl,
  getOnChainTimestampDate: mocks.getOnChainTimestampDate,
  getOnChainErrorMessage: mocks.getOnChainErrorMessage,
}))

describe('adminSignOnBehalfHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOnChainTimestampDate.mockReturnValue(
      new Date('2026-01-01T00:00:00.000Z'),
    )
    mocks.getOnChainErrorMessage.mockReturnValue(null)
    mocks.getExplorerUrl.mockImplementation(
      (tx: string) => `https://explorer/tx/${tx}`,
    )
  })

  it('signs a non-registered beneficiary through encrypted metadata minting', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin-1',
      role: 'ADMIN',
    })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.beneficiaryFindUnique.mockResolvedValueOnce({
      id: 'beneficiary-1',
      nonRegisteredFamilyMemberId: 50,
      hasSigned: false,
      signatureRef: null,
      agreement: {
        id: 'agreement-1',
        ownerHasSigned: true,
        status: 'PENDING_SIGNATURES',
        beneficiaries: [{ id: 'beneficiary-1' }, { id: 'beneficiary-2' }],
      },
      nonRegisteredFamilyMember: {
        id: 50,
        name: 'Private',
        icNumber: 'private-ic',
      },
    })
    mocks.ensureAgreementMintedWithMetadata.mockResolvedValueOnce({
      tokenId: 7,
      wasMinted: true,
      metadataUri: 'ipfs://bafy123',
      mintResult: { txHash: '0xmint' },
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
    mocks.beneficiaryUpdate.mockResolvedValueOnce({})
    mocks.beneficiaryFindMany.mockResolvedValueOnce([
      { hasSigned: true, isAccepted: true },
    ])
    mocks.agreementUpdate.mockResolvedValueOnce({})

    const request = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        beneficiaryId: 'beneficiary-1',
        adminNotes: 'Verified in person',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await adminSignOnBehalfHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mocks.ensureAgreementMintedWithMetadata).toHaveBeenCalledWith(
      'agreement-1',
      ['beneficiary-1', 'beneficiary-2'],
    )
    expect(mocks.recordBeneficiarySignature).toHaveBeenCalledWith(
      7,
      'beneficiary-1',
    )
  })
})
