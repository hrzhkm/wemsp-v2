import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'

export const Route = createFileRoute('/api/agent/conversations/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const conversations = await prisma.agentConversation.findMany({
          where: { userId: session.user.id },
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { messages: true } },
          },
        })

        return Response.json({
          conversations: conversations.map((c) => {
            const { _count, ...rest } = c

            return {
              ...rest,
              createdAt: c.createdAt.toISOString(),
              updatedAt: c.updatedAt.toISOString(),
              messageCount: _count.messages,
            }
          }),
        })
      },

      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Unauthorized', { status: 401 })

        const body = (await request.json().catch(() => ({}))) as {
          title?: string
        }

        const conversation = await prisma.agentConversation.create({
          data: {
            userId: session.user.id,
            title: body.title?.trim() || 'New chat',
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        return Response.json(
          {
            conversation: {
              ...conversation,
              createdAt: conversation.createdAt.toISOString(),
              updatedAt: conversation.updatedAt.toISOString(),
            },
          },
          { status: 201 },
        )
      },
    },
  },
})
