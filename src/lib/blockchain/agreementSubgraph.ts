import { getExplorerUrl } from './contract'
import type { AgreementOnChainEvent } from './agreementEvents'

const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ||
  'https://api.studio.thegraph.com/query/106159/wemsp-v-2/v0.0.1'

// The contract's lifecycle events, in the same order they are indexed by the
// subgraph. Only these six carry the tokenId of an agreement NFT.
const EVENT_COLLECTIONS = [
  {
    name: 'agreementMinteds',
    type: 'AgreementMinted',
    label: 'Agreement NFT minted',
  },
  {
    name: 'ownerSigneds',
    type: 'OwnerSigned',
    label: 'Owner signed on-chain',
  },
  {
    name: 'beneficiarySigneds',
    type: 'BeneficiarySigned',
    label: 'Beneficiary signed on-chain',
  },
  {
    name: 'witnessSigneds',
    type: 'WitnessSigned',
    label: 'Admin witnessed on-chain',
  },
  {
    name: 'agreementFinalizeds',
    type: 'AgreementFinalized',
    label: 'Agreement finalized on-chain',
  },
  {
    name: 'agreementUpdateds',
    type: 'AgreementUpdated',
    label: 'Agreement metadata updated on-chain',
  },
]

const EVENT_FIELDS: Record<string, string> = {
  agreementMinteds: 'tokenId agreementId beneficiaryCount transactionHash blockTimestamp blockNumber',
  ownerSigneds: 'tokenId timestamp transactionHash blockTimestamp blockNumber',
  beneficiarySigneds:
    'tokenId beneficiaryId timestamp transactionHash blockTimestamp blockNumber',
  witnessSigneds: 'tokenId timestamp transactionHash blockTimestamp blockNumber',
  agreementFinalizeds:
    'tokenId timestamp transactionHash blockTimestamp blockNumber',
  agreementUpdateds:
    'tokenId newMetadataUri timestamp transactionHash blockTimestamp blockNumber',
}

// ponytail: first:1000 per collection; add skip/offset paging if a collection
// ever exceeds a thousand events.
const COLLECTION_QUERY = (name: string, fields: string) =>
  `${name}(first: 1000, orderBy: blockTimestamp, orderDirection: desc) { ${fields} }`

function buildQuery(): string {
  const selections = EVENT_COLLECTIONS.map((collection) =>
    COLLECTION_QUERY(collection.name, EVENT_FIELDS[collection.name]),
  ).join('\n')
  return `query { ${selections} }`
}

async function querySubgraph(): Promise<Record<string, Array<Record<string, unknown>>>> {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: buildQuery() }),
  })
  if (!response.ok) {
    throw new Error(`Subgraph query failed with status ${response.status}`)
  }
  const body = (await response.json()) as {
    data?: Record<string, Array<Record<string, unknown>>>
    errors?: Array<{ message: string }>
  }
  if (body.errors?.length) {
    throw new Error(`Subgraph query failed: ${body.errors[0].message}`)
  }
  return body.data ?? {}
}

function toEvent(
  type: string,
  label: string,
  raw: Record<string, unknown>,
): AgreementOnChainEvent {
  const txHash = String(raw.transactionHash)
  const blockTimestamp = Number(raw.blockTimestamp)
  const event: AgreementOnChainEvent = {
    type,
    label,
    txHash,
    explorerUrl: getExplorerUrl(txHash),
    blockNumber: Number(raw.blockNumber),
    occurredAt: new Date(blockTimestamp * 1000).toISOString(),
    tokenId: Number(raw.tokenId),
  }

  if (type === 'BeneficiarySigned') {
    event.beneficiaryId = String(raw.beneficiaryId)
  } else if (type === 'AgreementMinted') {
    event.detail = `${Number(raw.beneficiaryCount)} beneficiaries`
  } else if (type === 'AgreementUpdated') {
    event.detail = String(raw.newMetadataUri)
  }

  return event
}

/**
 * Fetch every lifecycle event the contract has ever emitted (across all
 * agreements) from the deployed subgraph. Used by the admin transaction
 * history page. Returns an empty array when the subgraph has no events.
 */
export async function getAllContractEvents(): Promise<
  Array<AgreementOnChainEvent>
> {
  const data = await querySubgraph()

  const events: Array<AgreementOnChainEvent> = []
  for (const collection of EVENT_COLLECTIONS) {
    for (const raw of data[collection.name] ?? []) {
      events.push(toEvent(collection.type, collection.label, raw))
    }
  }

  events.sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.blockNumber - a.blockNumber,
  )
  return events
}
