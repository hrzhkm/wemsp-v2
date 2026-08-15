import { beforeEach, describe, expect, it, vi } from 'vitest'

import { agreementHandlers } from '@/routes/api/agreement/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  assetFindMany: vi.fn(),
  familyMemberFindFirst: vi.fn(),
  nonRegisteredFamilyMemberFindFirst: vi.fn(),
  transaction: vi.fn(),
  isContractConfigured: vi.fn(),
  getExplorerUrl: vi.fn(),
  updateAgreementMetadata: vi.fn(),
  ensureAgreementMintedWithMetadata: vi.fn(),
  refreshAgreementMetadataUri: vi.fn(),
  agreementDelete: vi.fn(),
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
      create: vi.fn(),
      delete: mocks.agreementDelete,
    },
    asset: { findMany: mocks.assetFindMany },
    familyMember: { findFirst: mocks.familyMemberFindFirst },
    nonRegisteredFamilyMember: {
      findFirst: mocks.nonRegisteredFamilyMemberFindFirst,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/blockchain/contract', () => ({
  isContractConfigured: mocks.isContractConfigured,
  getExplorerUrl: mocks.getExplorerUrl,
  updateAgreementMetadata: mocks.updateAgreementMetadata,
}))

vi.mock('@/lib/agreement/agreementMetadata', () => ({
  ensureAgreementMintedWithMetadata: mocks.ensureAgreementMintedWithMetadata,
  refreshAgreementMetadataUri: mocks.refreshAgreementMetadataUri,
}))

describe('agreementHandlers auth + lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getExplorerUrl.mockImplementation(
      (hash: string) => `https://explorer/${hash}`,
    )
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
      tokenId: null,
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

  it('PUT refreshes on-chain metadata when a minted DRAFT is edited', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.findFirst.mockResolvedValueOnce({
      id: 'a1',
      ownerId: 'u1',
      status: 'DRAFT',
      title: 'Old',
      description: null,
      distributionType: 'HIBAH',
      effectiveDate: null,
      expiryDate: null,
      tokenId: 7,
    })
    mocks.update.mockResolvedValueOnce({
      id: 'a1',
      title: 'Updated title',
      description: null,
      distributionType: 'HIBAH',
      status: 'DRAFT',
      effectiveDate: null,
      expiryDate: null,
    })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.refreshAgreementMetadataUri.mockResolvedValueOnce({
      metadataUri: 'ipfs://fresh',
      cid: 'cid',
      encryptedEnvelope: null,
    })
    mocks.updateAgreementMetadata.mockResolvedValueOnce({
      txHash: '0xmetaupdate',
      blockNumber: 1,
      timestamp: 1700000000,
    })

    const request = new Request('http://localhost/api/agreement/a1', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated title' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.PUT({ request })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.refreshAgreementMetadataUri).toHaveBeenCalledWith('a1')
    expect(mocks.updateAgreementMetadata).toHaveBeenCalledWith(
      7,
      'ipfs://fresh',
    )
    expect(body.onChain.metadataUpdateTxHash).toBe('0xmetaupdate')
  })

  it('POST mints the agreement NFT when the contract is configured', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.assetFindMany.mockResolvedValueOnce([{ id: 1, userId: 'u1' }])
    mocks.familyMemberFindFirst.mockResolvedValueOnce({ id: 1, userId: 'u1' })
    mocks.transaction.mockImplementationOnce((callback) => {
      return callback({
        agreement: {
          create: vi.fn().mockResolvedValueOnce({
            id: 'agr_new',
            title: 'Hibah Car',
            status: 'DRAFT',
          }),
        },
        agreementAsset: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
        },
        agreementBeneficiary: {
          create: vi.fn().mockResolvedValueOnce({ id: 'ben_1' }),
        },
      })
    })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.ensureAgreementMintedWithMetadata.mockResolvedValueOnce({
      tokenId: 5,
      wasMinted: true,
      metadataUri: 'ipfs://bafy',
      mintResult: { txHash: '0xmint', blockNumber: 1 },
    })

    const request = new Request('http://localhost/api/agreement/agreement', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Hibah Car',
        description: null,
        distributionType: 'HIBAH',
        assets: [{ assetId: 1 }],
        beneficiaries: [
          { familyMemberId: 1, relation: 'DAUGHTER', sharePercentage: 100 },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.ensureAgreementMintedWithMetadata).toHaveBeenCalledWith(
      'agr_new',
      ['ben_1'],
    )
    expect(body.onChain.tokenId).toBe(5)
    expect(body.onChain.mintTxHash).toBe('0xmint')
    expect(body.onChain.mintExplorerUrl).toBe('https://explorer/0xmint')
  })

  it('POST skips minting when the contract is not configured', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.assetFindMany.mockResolvedValueOnce([{ id: 1, userId: 'u1' }])
    mocks.familyMemberFindFirst.mockResolvedValueOnce({ id: 1, userId: 'u1' })
    mocks.transaction.mockImplementationOnce((callback) => {
      return callback({
        agreement: {
          create: vi.fn().mockResolvedValueOnce({
            id: 'agr_new',
            title: 'Hibah Car',
            status: 'DRAFT',
          }),
        },
        agreementAsset: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
        },
        agreementBeneficiary: {
          create: vi.fn().mockResolvedValueOnce({ id: 'ben_1' }),
        },
      })
    })
    mocks.isContractConfigured.mockReturnValueOnce(false)

    const request = new Request('http://localhost/api/agreement/agreement', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Hibah Car',
        description: null,
        distributionType: 'HIBAH',
        assets: [{ assetId: 1 }],
        beneficiaries: [
          { familyMemberId: 1, relation: 'DAUGHTER', sharePercentage: 100 },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.ensureAgreementMintedWithMetadata).not.toHaveBeenCalled()
    expect(body.onChain).toBeNull()
  })

  it('POST rolls back the agreement and returns 503 when minting fails', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1' } })
    mocks.assetFindMany.mockResolvedValueOnce([{ id: 1, userId: 'u1' }])
    mocks.familyMemberFindFirst.mockResolvedValueOnce({ id: 1, userId: 'u1' })
    mocks.transaction.mockImplementationOnce((callback) => {
      return callback({
        agreement: {
          create: vi.fn().mockResolvedValueOnce({
            id: 'agr_new',
            title: 'Hibah Car',
            status: 'DRAFT',
          }),
        },
        agreementAsset: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
        },
        agreementBeneficiary: {
          create: vi.fn().mockResolvedValueOnce({ id: 'ben_1' }),
        },
      })
    })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.ensureAgreementMintedWithMetadata.mockRejectedValueOnce(
      new Error('request timeout'),
    )
    mocks.agreementDelete.mockResolvedValueOnce({ id: 'agr_new' })

    const request = new Request('http://localhost/api/agreement/agreement', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Hibah Car',
        description: null,
        distributionType: 'HIBAH',
        assets: [{ assetId: 1 }],
        beneficiaries: [
          { familyMemberId: 1, relation: 'DAUGHTER', sharePercentage: 100 },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await agreementHandlers.POST({ request })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toContain('On-chain minting is temporarily unavailable')
    expect(mocks.agreementDelete).toHaveBeenCalledWith({
      where: { id: 'agr_new' },
    })
  })
})
