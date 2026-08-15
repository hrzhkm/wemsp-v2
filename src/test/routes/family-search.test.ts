import { beforeEach, describe, expect, it, vi } from 'vitest'
import { familySearchHandlers } from '@/routes/api/family/search'

const mocks = vi.hoisted(() => ({
  findNonRegistered: vi.fn(),
  findRegistered: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('@/db', () => ({
  prisma: {
    familyMember: { findFirst: vi.fn() },
    nonRegisteredFamilyMember: { findFirst: mocks.findNonRegistered },
    user: { findUnique: mocks.findRegistered },
  },
}))

describe('familySearchHandlers.GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    mocks.findRegistered.mockResolvedValue(null)
  })

  it('rejects impossible IC birth dates before querying records', async () => {
    const response = await familySearchHandlers.GET({
      request: new Request(
        'http://localhost/api/family/search?icNumber=990231101234',
      ),
    })
    expect(response.status).toBe(400)
    expect(mocks.findRegistered).not.toHaveBeenCalled()
  })

  it('does not disclose another owner non-registered record', async () => {
    mocks.findNonRegistered.mockResolvedValue({ userId: 'other_user' })
    const response = await familySearchHandlers.GET({
      request: new Request(
        'http://localhost/api/family/search?icNumber=950815105567',
      ),
    })
    expect(await response.json()).toEqual({ type: 'unavailable' })
  })
})
