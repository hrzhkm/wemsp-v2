import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  agreementFindUnique: vi.fn(),
  agreementUpdate: vi.fn(),
  isContractConfigured: vi.fn(),
  ensureAgreementMinted: vi.fn(),
  getAgreementData: vi.fn(),
  getBeneficiarySignatureStatus: vi.fn(),
  recordOwnerSignature: vi.fn(),
  recordBeneficiarySignature: vi.fn(),
  recordWitnessSignature: vi.fn(),
  isAgreementFullySigned: vi.fn(),
  finalizeAgreement: vi.fn(),
  getExplorerUrl: vi.fn(),
  getOnChainTimestampDate: vi.fn(),
  getOnChainErrorMessage: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/db', () => ({
  prisma: {
    agreement: { findUnique: mocks.agreementFindUnique, update: mocks.agreementUpdate },
  },
}))
vi.mock('@/lib/blockchain/contract', () => ({
  isContractConfigured: mocks.isContractConfigured,
  ensureAgreementMinted: mocks.ensureAgreementMinted,
  getAgreementData: mocks.getAgreementData,
  getBeneficiarySignatureStatus: mocks.getBeneficiarySignatureStatus,
  recordOwnerSignature: mocks.recordOwnerSignature,
  recordBeneficiarySignature: mocks.recordBeneficiarySignature,
  recordWitnessSignature: mocks.recordWitnessSignature,
  isAgreementFullySigned: mocks.isAgreementFullySigned,
  finalizeAgreement: mocks.finalizeAgreement,
  getExplorerUrl: mocks.getExplorerUrl,
  getOnChainTimestampDate: mocks.getOnChainTimestampDate,
  getOnChainErrorMessage: mocks.getOnChainErrorMessage,
}))

import { witnessSignHandlers } from '@/routes/api/agreement/$id/sign/witness/$'

describe('witnessSignHandlers.POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOnChainTimestampDate.mockReturnValue(new Date('2026-01-01T00:00:00.000Z'))
    mocks.getOnChainErrorMessage.mockReturnValue(null)
  })

  it('returns 401 when there is no admin session', async () => {
    mocks.getSession.mockResolvedValueOnce(null)
    const res = await witnessSignHandlers.POST({ request: new Request('http://x', { method: 'POST' }), params: { id: 'a1' } })
    expect(res.status).toBe(401)
  })

  it('returns 401 when the session user is not an admin', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'u1', role: 'USER' } })
    const res = await witnessSignHandlers.POST({ request: new Request('http://x', { method: 'POST' }), params: { id: 'a1' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 when agreement not in PENDING_WITNESS', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'ad1', role: 'ADMIN' } })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.agreementFindUnique.mockResolvedValueOnce({ id: 'a1', status: 'DRAFT', witnessedAt: null, beneficiaries: [] })

    const res = await witnessSignHandlers.POST({ request: new Request('http://x', { method: 'POST' }), params: { id: 'a1' } })
    expect(res.status).toBe(400)
  })

  it('witnesses and finalizes agreement', async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'ad1', role: 'ADMIN' } })
    mocks.isContractConfigured.mockReturnValueOnce(true)
    mocks.agreementFindUnique.mockResolvedValueOnce({
      id: 'a1', status: 'PENDING_WITNESS', witnessedAt: null, ownerHasSigned: true,
      beneficiaries: [{ id: 1, hasSigned: true }, { id: 2, hasSigned: true }],
    })
    mocks.ensureAgreementMinted.mockResolvedValueOnce({ tokenId: 9, wasMinted: false })
    mocks.getAgreementData.mockResolvedValueOnce({ ownerSigned: true, witnessedAt: 0, witnessSigned: false })
    mocks.getBeneficiarySignatureStatus.mockResolvedValue({ hasSigned: true, signedAt: 1700000000 })
    mocks.recordWitnessSignature.mockResolvedValueOnce({ txHash: '0xwit', timestamp: 1700000000 })
    mocks.isAgreementFullySigned.mockResolvedValueOnce(true)
    mocks.finalizeAgreement.mockResolvedValueOnce({ txHash: '0xfin', timestamp: 1700000001 })
    mocks.agreementUpdate.mockResolvedValueOnce({ id: 'a1', status: 'ACTIVE', witnessId: 'ad1', witnessedAt: new Date() })

    const res = await witnessSignHandlers.POST({ request: new Request('http://x', { method: 'POST' }), params: { id: 'a1' } })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.agreement.status).toBe('ACTIVE')
    expect(body.agreement.witnessId).toBe('ad1')
    expect(body.onChain.tokenId).toBe(9)
  })
})
