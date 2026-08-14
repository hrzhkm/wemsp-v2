import type { AgentMessageRole } from '@/generated/prisma/enums'

export type PendingActionStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export type PendingAssetPayload = {
  description?: string | null
  documentUrl?: string | null
  name: string
  type: 'PROPERTY' | 'VEHICLE' | 'INVESTMENT' | 'OTHER'
  value: number
}

export type PendingAssetCreateAction = {
  createdAt: string
  kind: 'ASSET_CREATE'
  pendingId: string
  status: PendingActionStatus
  asset: PendingAssetPayload
  confirmedAssetId?: number
  confirmedAt?: string
}

export type PendingAction = PendingAssetCreateAction

export type AgentPendingActionSummary = {
  createdAt: string
  kind: 'ASSET_CREATE'
  pendingId: string
  status: 'PENDING'
  asset: PendingAssetPayload
}

export type AgentMessageRecord = {
  id: string
  role: AgentMessageRole
  content: string
  createdAt: Date
}

const PENDING_ACTION_PREFIX = 'WEMSP_PENDING_ACTION:'

export function serializePendingAction(action: PendingAction): string {
  return `${PENDING_ACTION_PREFIX}${JSON.stringify(action)}`
}

export function parsePendingAction(content: string): PendingAction | null {
  if (!content.startsWith(PENDING_ACTION_PREFIX)) return null

  try {
    const parsed = JSON.parse(content.slice(PENDING_ACTION_PREFIX.length)) as {
      asset?: PendingAssetPayload
      createdAt?: string
      kind?: string
      pendingId?: string
      status?: PendingActionStatus
      confirmedAssetId?: number
      confirmedAt?: string
    }

    if (parsed.kind !== 'ASSET_CREATE') return null
    if (!parsed.pendingId || !parsed.status || !parsed.asset || !parsed.createdAt) return null

    return {
      kind: 'ASSET_CREATE',
      pendingId: parsed.pendingId,
      status: parsed.status,
      asset: parsed.asset,
      createdAt: parsed.createdAt,
      confirmedAssetId: parsed.confirmedAssetId,
      confirmedAt: parsed.confirmedAt,
    }
  } catch {
    return null
  }
}

export function getPendingActionSummaries(messages: Array<AgentMessageRecord>): Array<AgentPendingActionSummary> {
  return messages
    .filter((message) => message.role === 'SYSTEM')
    .map((message) => parsePendingAction(message.content))
    .filter((action): action is PendingAction => Boolean(action))
    .filter((action) => action.status === 'PENDING')
    .map((action) => ({
      createdAt: action.createdAt,
      kind: action.kind,
      pendingId: action.pendingId,
      status: 'PENDING',
      asset: action.asset,
    }))
}
