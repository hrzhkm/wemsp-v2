import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildAgreementMetadataPayload,
  ensureAgreementMetadataUri,
  ensureAgreementMintedWithMetadata,
} from '@/lib/agreement/agreementMetadata'

const mocks = vi.hoisted(() => ({
  agreementFindUnique: vi.fn(),
  agreementUpdate: vi.fn(),
  uploadEncryptedJsonToIpfs: vi.fn(),
  getIpfsEncryptionKeyFromEnv: vi.fn(),
  encryptForIpfs: vi.fn(),
  ensureAgreementMinted: vi.fn(),
  getContractAddress: vi.fn(),
}))

vi.mock('@/db', () => ({
  prisma: {
    agreement: {
      findUnique: mocks.agreementFindUnique,
      update: mocks.agreementUpdate,
    },
  },
}))

vi.mock('@/lib/storage/ipfsEncryption', () => ({
  getIpfsEncryptionKeyFromEnv: mocks.getIpfsEncryptionKeyFromEnv,
  encryptForIpfs: mocks.encryptForIpfs,
}))

vi.mock('@/lib/storage/ipfs', () => ({
  uploadEncryptedJsonToIpfs: mocks.uploadEncryptedJsonToIpfs,
}))

vi.mock('@/lib/blockchain/contract', () => ({
  ensureAgreementMinted: mocks.ensureAgreementMinted,
  getContractAddress: mocks.getContractAddress,
}))

const baseAgreement = {
  id: 'agreement-1',
  title: 'Hibah plan',
  description: 'Private description',
  distributionType: 'HIBAH',
  status: 'DRAFT',
  ownerId: 'owner-1',
  metadataUri: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  assets: [
    {
      assetId: 10,
      allocatedValue: 100,
      allocatedPercentage: 50,
      notes: 'Private asset note',
    },
  ],
  beneficiaries: [
    {
      id: 'beneficiary-1',
      familyMemberId: 1,
      nonRegisteredFamilyMemberId: null,
      sharePercentage: 50,
      shareDescription: 'Private share note',
    },
  ],
}

describe('agreement metadata service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getIpfsEncryptionKeyFromEnv.mockReturnValue(Buffer.alloc(32, 1))
    mocks.encryptForIpfs.mockReturnValue({
      version: 1,
      algorithm: 'aes-256-gcm',
      keyRef: 'server:v1',
      contentType: 'application/json',
      iv: 'iv',
      authTag: 'tag',
      ciphertext: 'ciphertext',
    })
    mocks.uploadEncryptedJsonToIpfs.mockResolvedValue({
      cid: 'bafy123',
      uri: 'ipfs://bafy123',
      gatewayUrl: 'https://gateway/ipfs/bafy123',
    })
    mocks.getContractAddress.mockReturnValue('0xcontract')
  })

  it('builds minimal audit metadata without private descriptions or notes', () => {
    const payload = buildAgreementMetadataPayload(baseAgreement)
    const serialized = JSON.stringify(payload)

    expect(payload).toEqual({
      schema: 'wemsp.agreement.metadata',
      version: 1,
      agreementId: 'agreement-1',
      distributionType: 'HIBAH',
      status: 'DRAFT',
      ownerId: 'owner-1',
      assetIds: [10],
      beneficiaryIds: ['beneficiary-1'],
      beneficiaryCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(serialized).not.toContain('Private description')
    expect(serialized).not.toContain('Private asset note')
    expect(serialized).not.toContain('Private share note')
  })

  it('encrypts, uploads, and stores metadata when missing', async () => {
    mocks.agreementFindUnique.mockResolvedValueOnce(baseAgreement)
    mocks.agreementUpdate.mockResolvedValueOnce({
      ...baseAgreement,
      metadataUri: 'ipfs://bafy123',
    })

    const result = await ensureAgreementMetadataUri('agreement-1')

    expect(result.metadataUri).toBe('ipfs://bafy123')
    expect(mocks.encryptForIpfs).toHaveBeenCalledTimes(1)
    expect(mocks.uploadEncryptedJsonToIpfs).toHaveBeenCalledTimes(1)
    expect(mocks.agreementUpdate).toHaveBeenCalledWith({
      where: { id: 'agreement-1' },
      data: { metadataUri: 'ipfs://bafy123' },
    })
  })

  it('reuses existing metadata URI without re-uploading', async () => {
    mocks.agreementFindUnique.mockResolvedValueOnce({
      ...baseAgreement,
      metadataUri: 'ipfs://existing',
    })

    const result = await ensureAgreementMetadataUri('agreement-1')

    expect(result.metadataUri).toBe('ipfs://existing')
    expect(mocks.uploadEncryptedJsonToIpfs).not.toHaveBeenCalled()
    expect(mocks.agreementUpdate).not.toHaveBeenCalled()
  })

  it('fails closed when an agreement is already minted without stored metadata URI', async () => {
    mocks.agreementFindUnique.mockResolvedValueOnce({
      ...baseAgreement,
      tokenId: 7,
      metadataUri: null,
    })

    await expect(
      ensureAgreementMetadataUri('agreement-1'),
    ).rejects.toThrowError(/already minted/)
    expect(mocks.uploadEncryptedJsonToIpfs).not.toHaveBeenCalled()
    expect(mocks.agreementUpdate).not.toHaveBeenCalled()
  })

  it('returns a generic error when metadata encryption setup fails', async () => {
    mocks.agreementFindUnique.mockResolvedValueOnce(baseAgreement)
    mocks.getIpfsEncryptionKeyFromEnv.mockImplementationOnce(() => {
      throw new Error('IPFS_ENCRYPTION_KEY is required')
    })

    const promise = ensureAgreementMetadataUri('agreement-1')

    await expect(promise).rejects.toThrowError(
      'Failed to prepare encrypted agreement metadata',
    )
    await expect(promise).rejects.not.toThrowError(/IPFS_ENCRYPTION_KEY/)
  })

  it('mints with encrypted metadata URI and stores mint synchronization fields', async () => {
    mocks.agreementFindUnique.mockResolvedValueOnce(baseAgreement)
    mocks.agreementUpdate
      .mockResolvedValueOnce({
        ...baseAgreement,
        metadataUri: 'ipfs://bafy123',
      })
      .mockResolvedValueOnce({
        ...baseAgreement,
        metadataUri: 'ipfs://bafy123',
        tokenId: 7,
        contractAddress: '0xcontract',
        mintTxHash: '0xmint',
      })
    mocks.ensureAgreementMinted.mockResolvedValueOnce({
      tokenId: 7,
      wasMinted: true,
      mintResult: { txHash: '0xmint', tokenId: 7, blockNumber: 1 },
    })

    const result = await ensureAgreementMintedWithMetadata('agreement-1', [
      'beneficiary-1',
    ])

    expect(mocks.ensureAgreementMinted).toHaveBeenCalledWith(
      'agreement-1',
      ['beneficiary-1'],
      'ipfs://bafy123',
    )
    expect(mocks.agreementUpdate).toHaveBeenLastCalledWith({
      where: { id: 'agreement-1' },
      data: {
        tokenId: 7,
        contractAddress: '0xcontract',
        metadataUri: 'ipfs://bafy123',
        mintTxHash: '0xmint',
      },
    })
    expect(result.metadataUri).toBe('ipfs://bafy123')
    expect(result.tokenId).toBe(7)
  })
})
