import { beforeEach, describe, expect, it, vi } from 'vitest'

import { adminTransactionsHandlers } from '@/routes/api/admin/transactions/$'

const mocks = vi.hoisted(() => ({
  requireAdminFromHeaders: vi.fn(),
  getAllContractEvents: vi.fn(),
  agreementFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/adminGuard', () => ({
  requireAdminFromHeaders: mocks.requireAdminFromHeaders,
}))
vi.mock('@/lib/blockchain/agreementSubgraph', () => ({
  getAllContractEvents: mocks.getAllContractEvents,
}))
vi.mock('@/db', () => ({
  prisma: {
    agreement: { findMany: mocks.agreementFindMany },
  },
}))

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'OwnerSigned',
    label: 'Owner signed on-chain',
    txHash: '0xtx1',
    explorerUrl: 'https://explorer/0xtx1',
    blockNumber: 101,
    occurredAt: '2026-01-01T00:00:00.000Z',
    tokenId: 1,
    ...overrides,
  }
}

describe('adminTransactionsHandlers.GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agreementFindMany.mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce(null)

    const response = await adminTransactionsHandlers.GET({
      request: new Request('http://localhost/api/admin/transactions'),
    })
    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(mocks.getAllContractEvents).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid event type', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin1',
      role: 'ADMIN',
    })

    const response = await adminTransactionsHandlers.GET({
      request: new Request(
        'http://localhost/api/admin/transactions?type=BogusEvent',
      ),
    })
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid event type')
  })

  it('returns all events for an admin with no filters', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin1',
      role: 'ADMIN',
    })
    mocks.agreementFindMany.mockResolvedValueOnce([
      {
        id: 'agr_1',
        title: 'Hibah House',
        tokenId: 1,
        owner: { name: 'Ahmad' },
        beneficiaries: [{ id: 'ben_9', familyMember: null, nonRegisteredFamilyMember: { name: 'Siti' } }],
      },
    ])
    mocks.getAllContractEvents.mockResolvedValueOnce([
      makeEvent(),
      makeEvent({
        type: 'BeneficiarySigned',
        beneficiaryId: 'ben_9',
        txHash: '0xtx2',
        occurredAt: '2026-01-02T00:00:00.000Z',
      }),
    ])

    const response = await adminTransactionsHandlers.GET({
      request: new Request('http://localhost/api/admin/transactions'),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.events).toHaveLength(2)
    expect(body.events[0]).toMatchObject({
      type: 'BeneficiarySigned',
      agreement: { id: 'agr_1', title: 'Hibah House' },
      ownerName: 'Ahmad',
      beneficiaryName: 'Siti',
    })
    expect(body.events[1]).toMatchObject({
      type: 'OwnerSigned',
      agreement: { id: 'agr_1', title: 'Hibah House' },
      ownerName: 'Ahmad',
    })
    expect(mocks.agreementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenId: { not: null } },
      }),
    )
  })

  it('filters by event type and date range', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin1',
      role: 'ADMIN',
    })
    mocks.getAllContractEvents.mockResolvedValueOnce([
      makeEvent({ txHash: '0xtx1' }),
      makeEvent({
        type: 'WitnessSigned',
        txHash: '0xtx2',
        occurredAt: '2026-02-01T00:00:00.000Z',
      }),
    ])

    const url = new URL('http://localhost/api/admin/transactions')
    url.searchParams.set('type', 'WitnessSigned')
    url.searchParams.set('from', '2026-01-15')
    url.searchParams.set('to', '2026-02-15')
    const response = await adminTransactionsHandlers.GET({
      request: new Request(url),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.events[0].type).toBe('WitnessSigned')
  })

  it('filters by search on agreement title and owner', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin1',
      role: 'ADMIN',
    })
    mocks.agreementFindMany.mockResolvedValueOnce([
      {
        id: 'agr_1',
        title: 'Hibah House',
        tokenId: 1,
        owner: { name: 'Ahmad' },
        beneficiaries: [],
      },
      {
        id: 'agr_2',
        title: 'Wakaf Land',
        tokenId: 2,
        owner: { name: 'Fatimah' },
        beneficiaries: [],
      },
    ])
    mocks.getAllContractEvents.mockResolvedValueOnce([
      makeEvent({ tokenId: 1, txHash: '0xtx1' }),
      makeEvent({ tokenId: 2, txHash: '0xtx2' }),
    ])

    const url = new URL('http://localhost/api/admin/transactions')
    url.searchParams.set('search', 'wakaf')
    const response = await adminTransactionsHandlers.GET({
      request: new Request(url),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.events[0].agreement).toEqual({
      id: 'agr_2',
      title: 'Wakaf Land',
    })
    expect(body.events[0].ownerName).toBe('Fatimah')
  })

  it('marks events for agreements not in the database as unknown', async () => {
    mocks.requireAdminFromHeaders.mockResolvedValueOnce({
      id: 'admin1',
      role: 'ADMIN',
    })
    mocks.agreementFindMany.mockResolvedValueOnce([])
    mocks.getAllContractEvents.mockResolvedValueOnce([
      makeEvent({ tokenId: 99, txHash: '0xtx1' }),
    ])

    const response = await adminTransactionsHandlers.GET({
      request: new Request('http://localhost/api/admin/transactions'),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.events[0].agreement).toBeNull()
    expect(body.events[0].ownerName).toBeUndefined()
  })
})
