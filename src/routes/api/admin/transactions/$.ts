import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'
import { getAllContractEvents } from '@/lib/blockchain/agreementSubgraph'

export interface AdminTransactionEvent {
  type: string
  label: string
  txHash: string
  explorerUrl: string
  blockNumber: number
  occurredAt: string
  tokenId?: number
  beneficiaryId?: string
  detail?: string
  agreement?: {
    id: string
    title: string
  } | null
  ownerName?: string
  beneficiaryName?: string
}

const VALID_TYPES = new Set([
  'AgreementMinted',
  'OwnerSigned',
  'BeneficiarySigned',
  'WitnessSigned',
  'AgreementFinalized',
  'AgreementUpdated',
])

async function loadAgreementContext() {
  const agreements = await prisma.agreement.findMany({
    where: { tokenId: { not: null } },
    select: {
      id: true,
      title: true,
      tokenId: true,
      owner: { select: { name: true } },
      beneficiaries: {
        select: {
          id: true,
          familyMember: {
            select: { user: { select: { name: true } } },
          },
          nonRegisteredFamilyMember: { select: { name: true } },
        },
      },
    },
  })

  const byToken = new Map<number, AdminTransactionEvent['agreement']>()
  const ownersByToken = new Map<number, string>()
  const namesByBeneficiary = new Map<string, string>()

  for (const agreement of agreements) {
    if (agreement.tokenId == null) continue
    byToken.set(agreement.tokenId, { id: agreement.id, title: agreement.title })
    ownersByToken.set(agreement.tokenId, agreement.owner.name)
    for (const beneficiary of agreement.beneficiaries) {
      const name =
        beneficiary.familyMember?.user.name ||
        beneficiary.nonRegisteredFamilyMember?.name
      if (name) {
        namesByBeneficiary.set(beneficiary.id, name)
      }
    }
  }

  return { byToken, ownersByToken, namesByBeneficiary }
}

export const adminTransactionsHandlers = {
  GET: async ({ request }: { request: Request }) => {
    try {
      const admin = await requireAdminFromHeaders(request.headers)
      if (!admin) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders },
        )
      }

      const url = new URL(request.url)
      const type = url.searchParams.get('type') || ''
      const from = url.searchParams.get('from') || ''
      const to = url.searchParams.get('to') || ''
      const search = (url.searchParams.get('search') || '').trim().toLowerCase()

      if (type && !VALID_TYPES.has(type)) {
        return Response.json(
          { error: 'Invalid event type' },
          { status: 400, headers: corsHeaders },
        )
      }

      const { byToken, ownersByToken, namesByBeneficiary } =
        await loadAgreementContext()

      const events = await getAllContractEvents()

      const enriched: Array<AdminTransactionEvent> = events.map((event) => {
        const tokenId = event.tokenId
        return {
          ...event,
          agreement: tokenId != null ? (byToken.get(tokenId) ?? null) : null,
          ownerName: tokenId != null ? ownersByToken.get(tokenId) : undefined,
          beneficiaryName:
            event.beneficiaryId != null
              ? namesByBeneficiary.get(event.beneficiaryId)
              : undefined,
        }
      })

      const filtered = enriched.filter((event) => {
        if (type && event.type !== type) return false

        const occurredAt = new Date(event.occurredAt)
        if (from && new Date(from).getTime() > occurredAt.getTime())
          return false
        if (to && new Date(to).getTime() < occurredAt.getTime()) return false

        if (search) {
          const agreementTitle = event.agreement?.title.toLowerCase() || ''
          const ownerName = event.ownerName.toLowerCase() || ''
          if (!agreementTitle.includes(search) && !ownerName.includes(search)) {
            return false
          }
        }
        return true
      })

      filtered.sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) ||
          b.blockNumber - a.blockNumber,
      )

      return Response.json(
        {
          events: filtered,
          total: filtered.length,
        },
        { headers: corsHeaders },
      )
    } catch (error) {
      console.error('Error fetching transaction history:', error)
      return Response.json(
        { error: 'Internal Server Error' },
        { status: 500, headers: corsHeaders },
      )
    }
  },
}

export const Route = createFileRoute('/api/admin/transactions/$')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { headers: corsHeaders })
      },
      GET: adminTransactionsHandlers.GET,
    },
  },
})
