import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { parsePendingAction, serializePendingAction } from '@/lib/agent/pendingActions'

type ConfirmPendingActionRequest = {
  conversationId?: string
  pendingId?: string
}

export const Route = createFileRoute('/api/agent/pending-actions/confirm')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const body = (await request.json().catch(() => ({}))) as ConfirmPendingActionRequest
        const conversationId = body.conversationId?.trim()
        const pendingId = body.pendingId?.trim()

        if (!conversationId || !pendingId) {
          return Response.json({ error: 'conversationId and pendingId are required' }, { status: 400 })
        }

        const conversation = await prisma.agentConversation.findFirst({
          where: { id: conversationId, userId: session.user.id },
          include: {
            messages: {
              where: { role: 'SYSTEM' },
              orderBy: { createdAt: 'desc' },
              take: 200,
              select: { id: true, content: true, createdAt: true },
            },
          },
        })

        if (!conversation) {
          return Response.json({ error: 'Conversation not found' }, { status: 404 })
        }

        let pendingMessageId: string | null = null
        let pendingAction: ReturnType<typeof parsePendingAction> = null

        for (const message of conversation.messages) {
          const parsed = parsePendingAction(message.content)
          if (!parsed || parsed.pendingId !== pendingId) continue
          pendingMessageId = message.id
          pendingAction = parsed
          break
        }

        if (!pendingMessageId || !pendingAction) {
          return Response.json({ error: 'Pending action not found' }, { status: 404 })
        }

        if (pendingAction.status !== 'PENDING') {
          return Response.json({ error: 'Pending action has already been processed' }, { status: 409 })
        }

        const pendingMessageIdToUpdate = pendingMessageId

        const createdAsset = await prisma.$transaction(async (transaction) => {
          const asset = await transaction.asset.create({
            data: {
              userId: session.user.id,
              name: pendingAction.asset.name,
              type: pendingAction.asset.type,
              value: pendingAction.asset.value,
              description: pendingAction.asset.description || null,
              documentUrl: pendingAction.asset.documentUrl || null,
            },
            select: {
              id: true,
              name: true,
              type: true,
              value: true,
              description: true,
              documentUrl: true,
              createdAt: true,
            },
          })

          const confirmedAction = {
            ...pendingAction,
            status: 'CONFIRMED' as const,
            confirmedAt: new Date().toISOString(),
            confirmedAssetId: asset.id,
          }

          await transaction.agentMessage.update({
            where: { id: pendingMessageIdToUpdate },
            data: { content: serializePendingAction(confirmedAction) },
          })

          await transaction.agentMessage.create({
            data: {
              conversationId,
              role: 'ASSISTANT',
              content: `Asset created successfully: ${asset.name} (${asset.type}) with value RM${asset.value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
            },
          })

          await transaction.agentConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          })

          return asset
        })

        return Response.json({
          success: true,
          createdAsset: {
            ...createdAsset,
            createdAt: createdAsset.createdAt.toISOString(),
          },
          message: `Asset created successfully: ${createdAsset.name}.`,
        })
      },
    },
  },
})
