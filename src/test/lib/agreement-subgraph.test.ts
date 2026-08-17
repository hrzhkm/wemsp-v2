import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAllContractEvents } from '@/lib/blockchain/agreementSubgraph'

const mocks = vi.hoisted(() => ({
  getExplorerUrl: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/blockchain/contract', () => ({
  getExplorerUrl: mocks.getExplorerUrl,
}))

vi.stubGlobal('fetch', mocks.fetch)

function okResponse(data: Record<string, unknown>) {
  return {
    ok: true,
    json: () => Promise.resolve({ data }),
  }
}

function mintedEntity(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: '1',
    agreementId: 'agr-1',
    beneficiaryCount: '2',
    transactionHash: '0xmint',
    blockTimestamp: '1700000000',
    blockNumber: '100',
    ...overrides,
  }
}

function signedEntity(
  type: 'ownerSigneds' | 'witnessSigneds' | 'agreementFinalizeds',
  overrides: Record<string, unknown> = {},
) {
  return {
    tokenId: '1',
    timestamp: '1700000100',
    transactionHash: '0xtx',
    blockTimestamp: '1700000100',
    blockNumber: '101',
    ...overrides,
  }
}

describe('getAllContractEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getExplorerUrl.mockImplementation(
      (h: string) => `https://explorer/${h}`,
    )
  })

  it('queries the subgraph with a POST and returns an empty list when no events exist', async () => {
    mocks.fetch.mockResolvedValueOnce(okResponse({}))

    const events = await getAllContractEvents()

    expect(events).toEqual([])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = mocks.fetch.mock.calls[0]
    expect(String(url)).toContain('api.studio.thegraph.com')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.query).toContain('agreementMinteds')
    expect(body.query).toContain('beneficiarySigneds')
    expect(body.query).toContain('agreementFinalizeds')
    expect(body.query).toContain('agreementUpdateds')
  })

  it('normalizes events across collections and sorts them descending', async () => {
    mocks.fetch.mockResolvedValueOnce(
      okResponse({
        agreementMinteds: [
          mintedEntity({ blockTimestamp: '1700000000', blockNumber: '100' }),
        ],
        ownerSigneds: [
          signedEntity('ownerSigneds', {
            blockTimestamp: '1700000100',
            blockNumber: '101',
          }),
        ],
        beneficiarySigneds: [
          {
            tokenId: '1',
            beneficiaryId: 'ben_9',
            timestamp: '1700000200',
            transactionHash: '0xben',
            blockTimestamp: '1700000200',
            blockNumber: '102',
          },
        ],
        witnessSigneds: [
          signedEntity('witnessSigneds', {
            blockTimestamp: '1700000300',
            blockNumber: '103',
          }),
        ],
        agreementFinalizeds: [
          signedEntity('agreementFinalizeds', {
            blockTimestamp: '1700000400',
            blockNumber: '104',
          }),
        ],
        agreementUpdateds: [
          {
            tokenId: '1',
            newMetadataUri: 'ipfs://new',
            timestamp: '1700000500',
            transactionHash: '0xupd',
            blockTimestamp: '1700000500',
            blockNumber: '105',
          },
        ],
      }),
    )

    const events = await getAllContractEvents()

    expect(events).toHaveLength(6)
    expect(events.map((e) => e.type)).toEqual([
      'AgreementUpdated',
      'AgreementFinalized',
      'WitnessSigned',
      'BeneficiarySigned',
      'OwnerSigned',
      'AgreementMinted',
    ])

    expect(events[0]).toMatchObject({
      type: 'AgreementUpdated',
      label: 'Agreement metadata updated on-chain',
      txHash: '0xupd',
      explorerUrl: 'https://explorer/0xupd',
      blockNumber: 105,
      tokenId: 1,
      detail: 'ipfs://new',
      occurredAt: '2023-11-14T22:21:40.000Z',
    })
    expect(events[3]).toMatchObject({
      type: 'BeneficiarySigned',
      beneficiaryId: 'ben_9',
    })
    expect(events[5]).toMatchObject({
      type: 'AgreementMinted',
      detail: '2 beneficiaries',
    })
  })

  it('throws when the subgraph returns a GraphQL error', async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ errors: [{ message: 'boom' }] }),
    })

    await expect(getAllContractEvents()).rejects.toThrow('boom')
  })

  it('throws on a non-ok HTTP response', async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(getAllContractEvents()).rejects.toThrow(
      'Subgraph query failed with status 500',
    )
  })
})
