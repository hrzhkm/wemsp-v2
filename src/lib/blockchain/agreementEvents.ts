import { Interface, toBeHex } from 'ethers'
import AgreementContractArtifact from '../../contract/AgreementContract.json'
import {
  getContractAddress,
  getExplorerUrl,
  getFallbackProvider,
  getProvider,
  isTransientError,
  withRetry,
} from './contract'

export interface AgreementOnChainEvent {
  type: string
  label: string
  txHash: string
  explorerUrl: string
  blockNumber: number
  occurredAt: string
  beneficiaryId?: string
  detail?: string
}

const EVENT_TYPES = [
  'AgreementMinted',
  'OwnerSigned',
  'BeneficiarySigned',
  'WitnessSigned',
  'AgreementFinalized',
  'AgreementUpdated',
]

const EVENT_LABELS: Record<string, string> = {
  AgreementMinted: 'Agreement NFT minted',
  OwnerSigned: 'Owner signed on-chain',
  BeneficiarySigned: 'Beneficiary signed on-chain',
  WitnessSigned: 'Admin witnessed on-chain',
  AgreementFinalized: 'Agreement finalized on-chain',
  AgreementUpdated: 'Agreement metadata updated on-chain',
}

const iface = new Interface(AgreementContractArtifact.abi)

// Alchemy's free tier caps eth_getLogs to a small block range; Infura does
// not. Treat that provider limitation like a transient error so we fall back.
function isProviderRangeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /eth_getLogs|block range|Free tier/i.test(message)
}

async function withProviderFallback<T>(
  operation: (provider: ReturnType<typeof getProvider>) => Promise<T>,
): Promise<T> {
  try {
    return await withRetry(() => operation(getProvider()))
  } catch (error) {
    const fallback = getFallbackProvider()
    if ((isTransientError(error) || isProviderRangeError(error)) && fallback) {
      return await withRetry(() => operation(fallback))
    }
    throw error
  }
}

async function resolveFromBlock(
  tokenId: number,
  mintTxHash?: string | null,
): Promise<number> {
  if (mintTxHash) {
    const receipt = await withProviderFallback((provider) =>
      provider.getTransactionReceipt(mintTxHash),
    )
    if (receipt) {
      return receipt.blockNumber
    }
  }

  // Fallback: locate the block of the AgreementMinted event for this token.
  const logs = await withProviderFallback((provider) =>
    provider.getLogs({
      address: getContractAddress(),
      topics: [iface.getEvent('AgreementMinted').topicHash, toBeHex(tokenId, 32)],
      fromBlock: 0,
      toBlock: 'latest',
    }),
  )
  if (logs.length > 0) {
    return logs[0].blockNumber
  }
  return 0
}

/**
 * Fetch the on-chain lifecycle events for an agreement NFT directly from the
 * contract's event log (source of truth), ordered by block and log index.
 * Returns an empty array when the agreement has no events to report.
 */
export async function getAgreementOnChainEvents(
  tokenId: number,
  mintTxHash?: string | null,
): Promise<Array<AgreementOnChainEvent>> {
  const fromBlock = await resolveFromBlock(tokenId, mintTxHash)
  const topics = [
    EVENT_TYPES.map((name) => iface.getEvent(name).topicHash),
    toBeHex(tokenId, 32),
  ]

  const logs = await withProviderFallback((provider) =>
    provider.getLogs({
      address: getContractAddress(),
      topics,
      fromBlock,
      toBlock: 'latest',
    }),
  )

  const blockTimestamps = new Map<number, number>()
  const events: Array<AgreementOnChainEvent> = []

  for (const log of logs) {
    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
    if (!parsed) {
      continue
    }

    let timestamp = blockTimestamps.get(log.blockNumber)
    if (timestamp === undefined) {
      const block = await withProviderFallback((provider) =>
        provider.getBlock(log.blockNumber),
      )
      timestamp = block?.timestamp ?? Math.floor(Date.now() / 1000)
      blockTimestamps.set(log.blockNumber, timestamp)
    }

    const event: AgreementOnChainEvent = {
      type: parsed.name,
      label: EVENT_LABELS[parsed.name] ?? parsed.name,
      txHash: log.transactionHash,
      explorerUrl: getExplorerUrl(log.transactionHash),
      blockNumber: log.blockNumber,
      occurredAt: new Date(timestamp * 1000).toISOString(),
    }

    if (parsed.name === 'BeneficiarySigned') {
      event.beneficiaryId = parsed.args.beneficiaryId
    } else if (parsed.name === 'AgreementMinted') {
      event.detail = `${parsed.args.beneficiaryCount} beneficiaries`
    } else if (parsed.name === 'AgreementUpdated') {
      event.detail = parsed.args.newMetadataUri
    }

    events.push(event)
  }

  events.sort((a, b) => a.blockNumber - b.blockNumber || a.occurredAt.localeCompare(b.occurredAt))
  return events
}
