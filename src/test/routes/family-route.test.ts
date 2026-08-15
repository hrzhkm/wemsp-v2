import { beforeEach, describe, expect, it, vi } from 'vitest'
import { familyHandlers } from '@/routes/api/family/$'

const mocks = vi.hoisted(() => ({
  deleteNonRegistered: vi.fn(),
  findIc: vi.fn(),
  getSession: vi.fn(),
  updateNonRegistered: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: {
    familyMember: { findFirst: vi.fn() },
    icRegistry: { findUnique: mocks.findIc },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/family/family', () => ({
  createBidirectionalFamilyRelation: vi.fn(),
  deleteBidirectionalFamilyRelation: vi.fn(),
  deleteNonRegisteredFamilyMember: mocks.deleteNonRegistered,
  getFamilyMembers: vi.fn(),
  getNonRegisteredFamilyMembers: vi.fn(),
  updateBidirectionalFamilyRelation: vi.fn(),
  updateNonRegisteredFamilyMember: mocks.updateNonRegistered,
}))

const request = (method: string, body: unknown, query = '') =>
  new Request(`http://localhost/api/family${query}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method,
  })

describe('familyHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } })
  })

  it('rejects whitespace names, invalid IC dates, and arbitrary phone text', async () => {
    const response = await familyHandlers.POST({
      request: request('POST', {
        type: 'non-registered',
        memberData: {
          name: '   ',
          icNumber: '990231101234',
          phoneNumber: 'anything',
          relation: 'SIBLING',
        },
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid family member details',
    })
  })

  it('returns a JSON conflict envelope for duplicate IC numbers', async () => {
    mocks.findIc.mockResolvedValue({ icNumber: '950815105567' })
    const response = await familyHandlers.POST({
      request: request('POST', {
        type: 'non-registered',
        memberData: {
          name: 'Relative',
          icNumber: '950815105567',
          phoneNumber: '+60123456789',
          relation: 'SIBLING',
        },
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'This IC number is unavailable',
      code: 'IC_UNAVAILABLE',
    })
  })

  it('does not update a non-registered member outside the session owner boundary', async () => {
    mocks.updateNonRegistered.mockResolvedValue(null)
    const response = await familyHandlers.PUT({
      request: request(
        'PUT',
        {
          name: 'Relative',
          icNumber: '950815105567',
          phoneNumber: null,
          relation: 'SIBLING',
        },
        '?type=non-registered&id=42',
      ),
    })

    expect(response.status).toBe(404)
    expect(mocks.updateNonRegistered).toHaveBeenCalledWith(
      'user_1',
      42,
      expect.any(Object),
    )
  })
})
