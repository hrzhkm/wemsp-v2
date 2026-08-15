import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Interface, toBeHex } from 'ethers'

import { getAgreementOnChainEvents } from '@/lib/blockchain/agreementEvents'
import AgreementContractArtifact from '@/contract/AgreementContract.json'

const mocks = vi.hoisted(() => ({
  getContractAddress: vi.fn(),
  getExplorerUrl: vi.fn(),
  getProvider: vi.fn(),
  getFallbackProvider: vi.fn(),
  isTransientError: vi.fn(),
  withRetry: vi.fn(),
}))

vi.mock('@/lib/blockchain/contract', () => ({
  getContractAddress: mocks.getContractAddress,
  getExplorerUrl: mocks.getExplorerUrl,
  getProvider: mocks.getProvider,
  getFallbackProvider: mocks.getFallbackProvider,
  isTransientError: mocks.isTransientError,
  withRetry: mocks.withRetry,
}))

const iface = new Interface(AgreementContractArtifact.abi)

function makeLog(eventName: string, args: Array<unknown>, blockNumber: number, txHash: string, index = 0) {
  const fragment = iface.encodeEventLog(eventName as never, args as never)
  return {
    address: '0xcontract',
    topics: fragment.topics,
    data: fragment.data,
    blockNumber,
    transactionHash: txHash,
    index,
  }
}

describe('getAgreementOnChainEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getContractAddress.mockReturnValue('0xcontract')
    mocks.getExplorerUrl.mockImplementation((h: string) => `https://explorer/${h}`)
    mocks.getFallbackProvider.mockReturnValue(null)
    mocks.isTransientError.mockReturnValue(false)
    mocks.withRetry.mockImplementation((op: () => Promise<unknown>) => op())
  })

  it('returns an empty list when no logs match', async () => {
    mocks.getProvider.mockReturnValue({
      getTransactionReceipt: vi.fn().mockResolvedValue({ blockNumber: 100 }),
      getLogs: vi.fn().mockResolvedValue([]),
      getBlock: vi.fn(),
    })

    const events = await getAgreementOnChainEvents(5, '0xmint')
    expect(events).toEqual([])
    expect(mocks.getProvider).toHaveBeenCalled()
  })

  it('decodes, orders and timestamps the on-chain events for the token', async () => {
    const logs = [
      makeLog('OwnerSigned', [5, 1700000000], 101, '0xowner'),
      makeLog('BeneficiarySigned', [5, 'ben_1', 1700000100], 101, '0xben', 1),
      makeLog('WitnessSigned', [5, 1700000200], 102, '0xwit'),
      makeLog('AgreementFinalized', [5, 1700000300], 103, '0xfin'),
    ]
    mocks.getProvider.mockReturnValue({
      getTransactionReceipt: vi.fn().mockResolvedValue({ blockNumber: 100 }),
      getLogs: vi.fn().mockResolvedValue(logs),
      getBlock: vi.fn().mockImplementation((n: number) => Promise.resolve({ timestamp: 1700000000 + (n - 100) * 100 })),
    })

    const events = await getAgreementOnChainEvents(5, '0xmint')

    expect(mocks.getProvider().getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 100, toBlock: 'latest' }),
    )
    expect(events).toHaveLength(4)
    expect(events.map((e) => e.type)).toEqual([
      'OwnerSigned',
      'BeneficiarySigned',
      'WitnessSigned',
      'AgreementFinalized',
    ])
    expect(events[0].label).toBe('Owner signed on-chain')
    expect(events[0].txHash).toBe('0xowner')
    expect(events[0].explorerUrl).toBe('https://explorer/0xowner')
    expect(events[1].beneficiaryId).toBe('ben_1')
    expect(events[3].label).toBe('Agreement finalized on-chain')
    expect(new Date(events[3].occurredAt).getTime()).toBe(1700000300 * 1000)
  })

  it('falls back to the secondary provider when eth_getLogs hits a range limit', async () => {
    const primary = {
      getTransactionReceipt: vi.fn().mockResolvedValue({ blockNumber: 100 }),
      getLogs: vi.fn().mockRejectedValue(
        new Error(
          'Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range.',
        ),
      ),
      getBlock: vi.fn(),
    }
    const fallback = {
      getTransactionReceipt: vi.fn().mockResolvedValue({ blockNumber: 100 }),
      getLogs: vi.fn().mockResolvedValue([
        makeLog('OwnerSigned', [5, 1700000000], 101, '0xowner'),
      ]),
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1700000000 }),
    }
    mocks.getProvider.mockReturnValue(primary)
    mocks.getFallbackProvider.mockReturnValue(fallback)

    const events = await getAgreementOnChainEvents(5, '0xmint')

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('OwnerSigned')
    expect(fallback.getLogs).toHaveBeenCalled()
  })

  it('falls back to the minted-event block when there is no mint tx hash', async () => {
    const mintLog = makeLog('AgreementMinted', [5, 'agr-1', 'ipfs://x', 2], 200, '0xmint')
    mocks.getProvider.mockReturnValue({
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([mintLog])
        .mockResolvedValueOnce([]),
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1700000000 }),
    })

    const events = await getAgreementOnChainEvents(5, null)

    expect(events).toEqual([])
    const calls = mocks.getProvider().getLogs.mock.calls
    expect(calls[0][0].topics[0]).toEqual(iface.getEvent('AgreementMinted').topicHash)
    expect(calls[1][0].fromBlock).toBe(200)
  })
})
