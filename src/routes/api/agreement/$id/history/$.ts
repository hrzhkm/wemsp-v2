import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { getAgreementOnChainEvents } from '@/lib/blockchain/agreementEvents'

export const agreementHistoryHandlers = {
  GET: async ({
    request,
    params,
  }: {
    request: Request
    params: { id: string }
  }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    const sessionUser = session?.user as { id?: string } | undefined
    if (!sessionUser?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, role: true },
      })

      if (!dbUser) {
        return new Response('Unauthorized', { status: 401 })
      }

      const agreement = await prisma.agreement.findFirst({
        where: buildHistoryWhere(params.id, dbUser.id, dbUser.role === 'ADMIN'),
        select: {
          id: true,
          tokenId: true,
          mintTxHash: true,
        },
      })

      if (!agreement) {
        return Response.json({ error: 'Agreement not found' }, { status: 404 })
      }

      const events =
        agreement.tokenId != null
          ? await getAgreementOnChainEvents(agreement.tokenId, agreement.mintTxHash)
          : []

      return Response.json({
        agreementId: agreement.id,
        tokenId: agreement.tokenId,
        events,
      })
    } catch (error) {
      console.error('Error fetching agreement history:', error)
      return Response.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
}

function buildHistoryWhere(
  agreementId: string,
  userId: string,
  isAdmin: boolean,
) {
  if (isAdmin) {
    return { id: agreementId }
  }

  return {
    id: agreementId,
    OR: [
      { ownerId: userId },
      {
        beneficiaries: {
          some: {
            familyMember: {
              familyMemberUserId: userId,
            },
          },
        },
      },
    ],
  }
}

export const Route = createFileRoute('/api/agreement/$id/history/$')({
  server: {
    handlers: agreementHistoryHandlers,
  },
})
