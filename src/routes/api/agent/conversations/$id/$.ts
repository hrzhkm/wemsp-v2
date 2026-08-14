import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { getPendingActionSummaries } from '@/lib/agent/pending-actions'

export const Route = createFileRoute('/api/agent/conversations/$id/$')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const conversation = await prisma.agentConversation.findFirst({
          where: { id: params.id, userId: session.user.id },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, role: true, content: true, createdAt: true },
            },
          },
        })

        if (!conversation) {
          return Response.json({ error: 'Conversation not found' }, { status: 404 })
        }

        const pendingActions = getPendingActionSummaries(
          conversation.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
        )

        return Response.json({
          conversation: {
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString(),
          },
          messages: conversation.messages.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          })),
          pendingActions,
        })
      },
    },
  },
})
