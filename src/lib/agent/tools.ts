import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { serializePendingAction } from './pending-actions'
import { prisma } from '@/db'

type AgentRuntime = {
  conversationId: string
  userId: string
}

const explainFeature = tool(
  ({ topic }) => {
    const normalized = topic.toLowerCase()

    if (normalized.includes('agreement')) {
      return [
        'Agreement quick flow:',
        '1) Create agreement in DRAFT.',
        '2) Add assets and beneficiaries.',
        '3) Owner signs and submit for signatures.',
        '4) Beneficiaries sign (or admin proxy for non-registered).',
        '5) Admin witnesses, then agreement becomes ACTIVE.',
      ].join('\n')
    }

    if (normalized.includes('family')) {
      return [
        'Family member flow:',
        '1) Search by IC number.',
        '2) If account exists: add as registered family member.',
        '3) If not: add as non-registered family member with details.',
      ].join('\n')
    }

    if (normalized.includes('asset')) {
      return [
        'Asset flow:',
        '1) Add asset name, type, and value.',
        '2) Optional: upload PDF document.',
        '3) Use assets when creating agreements.',
      ].join('\n')
    }

    return 'I can explain agreements, assets, and family management. Tell me which one you want.'
  },
  {
    name: 'explain_feature',
    description: 'Explain how a WEMSP feature works for end users.',
    schema: z.object({
      topic: z.string().min(1).describe('Feature topic such as agreement, family, or asset.'),
    }),
  }
)

export function buildAgentTools(runtime: AgentRuntime) {
  const listAgreements = tool(
    async () => {
      const agreements = await prisma.agreement.findMany({
        where: { ownerId: runtime.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          distributionType: true,
          createdAt: true,
        },
      })

      return agreements.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))
    },
    {
      name: 'list_my_agreements',
      description: 'List agreements owned by the current user.',
      schema: z.object({}).describe('No input required.'),
    }
  )

  const listFamilyMembers = tool(
    async () => {
      const [registered, nonRegistered] = await Promise.all([
        prisma.familyMember.findMany({
          where: { userId: runtime.userId },
          include: {
            familyMemberUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.nonRegisteredFamilyMember.findMany({
          where: { userId: runtime.userId },
          select: {
            id: true,
            name: true,
            relation: true,
            icNumber: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ])

      return {
        nonRegistered,
        registered: registered.map((m) => ({
          id: m.id,
          relation: m.relation,
          user: m.familyMemberUser,
        })),
      }
    },
    {
      name: 'list_my_family_members',
      description: 'List registered and non-registered family members of current user.',
      schema: z.object({}).describe('No input required.'),
    }
  )

  const listAssets = tool(
    async () => {
      const assets = await prisma.asset.findMany({
        where: { userId: runtime.userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          createdAt: true,
        },
      })

      return assets.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))
    },
    {
      name: 'list_my_assets',
      description: 'List user assets with type and value.',
      schema: z.object({}).describe('No input required.'),
    }
  )

  const stageAssetCreation = tool(
    async ({ description, documentUrl, name, type, value }) => {
      const pendingId = crypto.randomUUID()
      const createdAt = new Date().toISOString()

      const pendingAction = {
        createdAt,
        kind: 'ASSET_CREATE' as const,
        pendingId,
        status: 'PENDING' as const,
        asset: {
          description: description?.trim() || null,
          documentUrl: documentUrl?.trim() || null,
          name: name.trim(),
          type,
          value,
        },
      }

      await prisma.agentMessage.create({
        data: {
          conversationId: runtime.conversationId,
          role: 'SYSTEM',
          content: serializePendingAction(pendingAction),
        },
      })

      return {
        pendingAction: {
          createdAt: pendingAction.createdAt,
          kind: pendingAction.kind,
          pendingId: pendingAction.pendingId,
          status: pendingAction.status,
          asset: pendingAction.asset,
        },
        message: 'Asset draft is ready. Ask user to press confirm.',
      }
    },
    {
      name: 'stage_asset_creation',
      description:
        'Stage a new asset creation request after required fields are collected and confirmed by the user. This does not create the asset yet.',
      schema: z.object({
        name: z.string().min(1).describe('Asset name'),
        type: z
          .enum(['PROPERTY', 'VEHICLE', 'INVESTMENT', 'OTHER'])
          .describe('Asset type based on schema enum'),
        value: z.number().positive().describe('Asset value as positive number'),
        description: z.string().optional().describe('Optional asset description'),
        documentUrl: z.string().url().optional().describe('Optional uploaded document URL'),
      }),
    }
  )

  return [explainFeature, listAgreements, listFamilyMembers, listAssets, stageAssetCreation]
}
