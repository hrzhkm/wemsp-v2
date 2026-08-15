import { beforeEach, describe, expect, it, vi } from 'vitest'

import { documentHandlers } from '@/routes/api/agreement/$id/document/$'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findAgreement: vi.fn(),
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
    user: {
      findUnique: mocks.findUser,
    },
    agreement: {
      findFirst: mocks.findAgreement,
    },
  },
}))

const agreementFixture = {
  id: 'agr_1',
  title: 'Hibah Apartment Agreement',
  description: 'Distribution of selected personal assets.',
  distributionType: 'HIBAH',
  status: 'ACTIVE',
  effectiveDate: new Date('2026-06-01T00:00:00.000Z'),
  expiryDate: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-02T00:00:00.000Z'),
  ownerHasSigned: true,
  ownerSignedAt: new Date('2026-06-02T00:00:00.000Z'),
  ownerSignatureRef: '0xowner',
  witnessedAt: new Date('2026-06-03T00:00:00.000Z'),
  witnessSignatureRef: '0xwitness',
  tokenId: 11,
  contractAddress: '0xcontract',
  metadataUri: 'ipfs://bafyagreement',
  mintTxHash: '0xmint',
  owner: {
    id: 'owner_1',
    name: 'Owner One',
    email: 'owner@example.com',
  },
  witness: {
    id: 'admin_1',
    name: 'Admin Witness',
    email: 'admin@example.com',
  },
  assets: [
    {
      id: 'aa_1',
      allocatedValue: 250000,
      allocatedPercentage: 100,
      notes: 'Primary allocation',
      asset: {
        id: 1,
        name: 'Apartment',
        type: 'PROPERTY',
        description: 'Main property',
        value: 250000,
      },
    },
  ],
  beneficiaries: [
    {
      id: 'ben_1',
      sharePercentage: 100,
      shareDescription: 'Full share',
      hasSigned: true,
      signedAt: new Date('2026-06-02T12:00:00.000Z'),
      signatureRef: '0xbeneficiary',
      isAccepted: true,
      familyMember: {
        id: 7,
        relation: 'DAUGHTER',
        familyMemberUser: {
          id: 'beneficiary_1',
          name: 'Beneficiary One',
          email: 'beneficiary@example.com',
        },
      },
      nonRegisteredFamilyMember: null,
    },
    {
      id: 'ben_2',
      sharePercentage: 0,
      shareDescription: 'Record only',
      hasSigned: false,
      signedAt: null,
      signatureRef: null,
      isAccepted: null,
      familyMember: null,
      nonRegisteredFamilyMember: {
        id: 9,
        name: 'Private Person',
        icNumber: '900101011234',
        relation: 'OTHER',
        phoneNumber: '0123456789',
        address: 'Private Address',
      },
    },
  ],
}

describe('documentHandlers.GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session exists', async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const response = await documentHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/document'),
      params: { id: 'agr_1' },
    })

    expect(response.status).toBe(401)
    expect(mocks.findAgreement).not.toHaveBeenCalled()
  })

  it('returns 404 when the agreement is outside the user authorization boundary', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'outsider_1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'outsider_1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce(null)

    const response = await documentHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/document'),
      params: { id: 'agr_1' },
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Agreement not found')
    expect(mocks.findAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'agr_1',
          OR: expect.any(Array),
        }),
      }),
    )
  })

  it('returns an attachment PDF for an authorized owner without exposing IC numbers', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'owner_1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'owner_1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce(agreementFixture)

    const response = await documentHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/document'),
      params: { id: 'agr_1' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain(
      'attachment; filename="agreement-agr_1.pdf"',
    )

    const pdfText = Buffer.from(await response.arrayBuffer()).toString('latin1')
    expect(pdfText.startsWith('%PDF-')).toBe(true)
    expect(pdfText).toContain('/FontFile2')
    expect(pdfText).toContain('/ToUnicode')
    expect(pdfText).not.toContain('900101011234')
    expect(pdfText).not.toContain('Private Address')
  })

  it('embeds a Unicode font for non-ASCII agreement text', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'owner_1' } })
    mocks.findUser.mockResolvedValueOnce({ id: 'owner_1', role: 'USER' })
    mocks.findAgreement.mockResolvedValueOnce({
      ...agreementFixture,
      title: 'Hibah 王 فاطمة தமிழ்',
    })

    const response = await documentHandlers.GET({
      request: new Request('http://localhost/api/agreement/agr_1/document'),
      params: { id: 'agr_1' },
    })
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1')

    expect(response.status).toBe(200)
    expect(pdf).toContain('/FontFile2')
    expect(pdf).toContain('/ToUnicode')
  })
})
