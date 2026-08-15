import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reconcileAgreement } from '@/lib/agreement/agreementReconciliation'

const mocks = vi.hoisted(() => ({
  findAgreement: vi.fn(),
  updateAgreement: vi.fn(),
  updateBeneficiary: vi.fn(),
  getTokenId: vi.fn(),
  getAgreementData: vi.fn(),
  getBeneficiarySignatureStatus: vi.fn(),
  getContractAddress: vi.fn(),
  getTokenURI: vi.fn(),
}))

vi.mock('@/db', () => ({
  prisma: {
    agreement: {
      findUnique: mocks.findAgreement,
      update: mocks.updateAgreement,
    },
    agreementBeneficiary: {
      update: mocks.updateBeneficiary,
    },
  },
}))

vi.mock('@/lib/blockchain/contract', () => ({
  getTokenIdByAgreementId: mocks.getTokenId,
  getAgreementData: mocks.getAgreementData,
  getBeneficiarySignatureStatus: mocks.getBeneficiarySignatureStatus,
  getContractAddress: mocks.getContractAddress,
  getTokenURI: mocks.getTokenURI,
  getOnChainTimestampDate: (timestamp: number) =>
    new Date((timestamp > 0 ? timestamp : Math.floor(Date.now() / 1000)) * 1000),
}))

function agreementFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agr_1',
    tokenId: null,
    contractAddress: null,
    metadataUri: null,
    ownerHasSigned: false,
    witnessedAt: null,
    status: 'PENDING_WITNESS',
    beneficiaries: [{ id: 'ben_1', hasSigned: false }],
    ...overrides,
  }
}

describe('reconcileAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTokenId.mockResolvedValue(5)
    mocks.getContractAddress.mockReturnValue('0xcontract')
    mocks.getAgreementData.mockResolvedValue({
      ownerSigned: true,
      ownerSignedAt: 1700000000,
      witnessSigned: true,
      witnessedAt: 1700000100,
      isFinalized: true,
      signedCount: 1,
      beneficiaryCount: 1,
    })
    mocks.getBeneficiarySignatureStatus.mockResolvedValue({
      hasSigned: true,
      signedAt: 1700000050,
    })
  })

  it('returns without changes when the agreement is not minted on-chain', async () => {
    mocks.getTokenId.mockResolvedValue(0)
    mocks.findAgreement.mockResolvedValueOnce(agreementFixture())

    const result = await reconcileAgreement('agr_1')

    expect(result.updatedFields).toEqual([])
    expect(mocks.updateAgreement).not.toHaveBeenCalled()
  })

  it('gap-fills tokenId, contractAddress, metadataUri and signature flags', async () => {
    mocks.findAgreement.mockResolvedValueOnce(agreementFixture())
    mocks.getTokenURI.mockResolvedValue('ipfs://bafy')
    mocks.updateAgreement.mockResolvedValueOnce({ id: 'agr_1' })
    mocks.updateBeneficiary.mockResolvedValueOnce({ id: 'ben_1' })

    const result = await reconcileAgreement('agr_1')

    expect(mocks.updateAgreement).toHaveBeenCalledWith({
      where: { id: 'agr_1' },
      data: expect.objectContaining({
        tokenId: 5,
        contractAddress: '0xcontract',
        metadataUri: 'ipfs://bafy',
        ownerHasSigned: true,
        witnessedAt: expect.any(Date),
        status: 'ACTIVE',
      }),
    })
    expect(mocks.updateBeneficiary).toHaveBeenCalledWith({
      where: { id: 'ben_1' },
      data: expect.objectContaining({ hasSigned: true, isAccepted: true }),
    })
    expect(result.updatedFields).toContain('tokenId')
    expect(result.updatedFields).toContain('status')
    expect(result.updatedFields).toContain('beneficiary:ben_1')
  })

  it('does not overwrite already-consistent state', async () => {
    mocks.findAgreement.mockResolvedValueOnce(
      agreementFixture({
        tokenId: 5,
        contractAddress: '0xcontract',
        metadataUri: 'ipfs://bafy',
        ownerHasSigned: true,
        witnessedAt: new Date('2026-01-01T00:00:00Z'),
        status: 'ACTIVE',
        beneficiaries: [{ id: 'ben_1', hasSigned: true }],
      }),
    )

    const result = await reconcileAgreement('agr_1')

    expect(mocks.updateAgreement).not.toHaveBeenCalled()
    expect(mocks.updateBeneficiary).not.toHaveBeenCalled()
    expect(result.updatedFields).toEqual([])
  })
})
