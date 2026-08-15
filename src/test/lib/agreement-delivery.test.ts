import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendFinalizedAgreementDocument } from '@/lib/agreement/agreementDelivery'

const mocks = vi.hoisted(() => ({
  findAgreement: vi.fn(),
  updateAgreement: vi.fn(),
  findSettings: vi.fn(),
  buildAgreementPdf: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/db', () => ({
  prisma: {
    agreement: {
      findUnique: mocks.findAgreement,
      update: mocks.updateAgreement,
    },
    userSetting: {
      findMany: mocks.findSettings,
    },
  },
}))

vi.mock('@/lib/agreement/agreementPdf', () => ({
  buildAgreementPdf: mocks.buildAgreementPdf,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
}))

const pdf = Buffer.from('%PDF-1.7 fake document')

function agreementFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agr_1',
    title: 'Hibah Apartment Agreement',
    ownerId: 'owner_1',
    owner: { id: 'owner_1', name: 'Owner One', email: 'owner@example.com' },
    witness: { id: 'admin_1', name: 'Admin', email: 'admin@example.com' },
    assets: [],
    beneficiaries: [
      {
        id: 'ben_1',
        sharePercentage: 100,
        shareDescription: 'Full share',
        hasSigned: true,
        signedAt: new Date(),
        signatureRef: '0xben',
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
          relation: 'OTHER',
        },
      },
    ],
    ...overrides,
  }
}

describe('sendFinalizedAgreementDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildAgreementPdf.mockResolvedValue(pdf)
    mocks.sendEmail.mockResolvedValue({ success: true })
    mocks.findSettings.mockResolvedValue([])
  })

  it('throws when the agreement does not exist', async () => {
    mocks.findAgreement.mockResolvedValueOnce(null)

    await expect(sendFinalizedAgreementDocument('missing')).rejects.toThrow(
      'Agreement not found',
    )
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('emails the PDF to the owner and registered beneficiaries', async () => {
    mocks.findAgreement.mockResolvedValueOnce(agreementFixture())
    mocks.updateAgreement.mockResolvedValueOnce({ id: 'agr_1' })

    const result = await sendFinalizedAgreementDocument('agr_1')

    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      'owner@example.com',
      expect.stringContaining('WEMSP Agreement Document'),
      expect.any(String),
      [
        {
          filename: 'agreement-agr_1.pdf',
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    )
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      'beneficiary@example.com',
      expect.any(String),
      expect.any(String),
      expect.any(Array),
    )
    expect(mocks.updateAgreement).toHaveBeenCalledWith({
      where: { id: 'agr_1' },
      data: { documentSentAt: expect.any(Date) },
    })
    expect(result.deliveredTo).toEqual([
      'owner@example.com',
      'beneficiary@example.com',
    ])
  })

  it('skips recipients who opted out of status-update emails', async () => {
    mocks.findAgreement.mockResolvedValueOnce(agreementFixture())
    mocks.findSettings.mockResolvedValueOnce([
      { userId: 'owner_1', emailAgreementStatusUpdates: false },
    ])
    mocks.updateAgreement.mockResolvedValueOnce({ id: 'agr_1' })

    const result = await sendFinalizedAgreementDocument('agr_1')

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      'beneficiary@example.com',
      expect.any(String),
      expect.any(String),
      expect.any(Array),
    )
    expect(result.deliveredTo).toEqual(['beneficiary@example.com'])
  })

  it('does not email the non-registered beneficiary and still records delivery', async () => {
    mocks.findAgreement.mockResolvedValueOnce(
      agreementFixture({
        owner: { id: 'owner_1', name: 'Owner', email: null },
      }),
    )
    mocks.updateAgreement.mockResolvedValueOnce({ id: 'agr_1' })

    const result = await sendFinalizedAgreementDocument('agr_1')

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      'beneficiary@example.com',
      expect.any(String),
      expect.any(String),
      expect.any(Array),
    )
    expect(mocks.updateAgreement).toHaveBeenCalled()
    expect(result.deliveredTo).toEqual(['beneficiary@example.com'])
  })

  it('still records delivery when there are no email recipients', async () => {
    mocks.findAgreement.mockResolvedValueOnce(
      agreementFixture({
        owner: { id: 'owner_1', name: 'Owner', email: null },
        beneficiaries: [
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
              relation: 'OTHER',
            },
          },
        ],
      }),
    )
    mocks.updateAgreement.mockResolvedValueOnce({ id: 'agr_1' })

    const result = await sendFinalizedAgreementDocument('agr_1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.updateAgreement).toHaveBeenCalled()
    expect(result.deliveredTo).toEqual([])
  })
})
