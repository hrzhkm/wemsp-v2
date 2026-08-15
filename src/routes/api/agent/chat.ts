import { createFileRoute } from '@tanstack/react-router'
import type { AgentResponseLanguage } from '@/lib/agent/systemPrompt'
import { auth } from '@/lib/auth/auth'
import { runAgentTurn } from '@/lib/agent'
import { prisma } from '@/db'

interface ChatRequestBody {
  message?: string
  conversationId?: string
  language?: string
}

function normalizeLanguage(value: unknown): AgentResponseLanguage | undefined {
  if (value === 'en' || value === 'ms') return value
  return undefined
}

export const Route = createFileRoute('/api/agent/chat')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const body = (await request.json()) as ChatRequestBody

          if (!body.message || body.message.trim().length === 0) {
            return Response.json(
              { error: 'Message is required' },
              { status: 400 },
            )
          }

          if (!body.conversationId) {
            return Response.json(
              { error: 'conversationId is required' },
              { status: 400 },
            )
          }

          const conversation = await prisma.agentConversation.findFirst({
            where: {
              id: body.conversationId,
              userId: session.user.id,
            },
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 20,
                select: { role: true, content: true },
              },
            },
          })

          if (!conversation) {
            return Response.json(
              { error: 'Conversation not found' },
              { status: 404 },
            )
          }

          const userMessage = body.message.trim()
          const uiLanguage = normalizeLanguage(body.language)

          const settings = await prisma.userSetting.findUnique({
            where: { userId: session.user.id },
            select: { preferredLanguage: true },
          })

          const preferredLanguage =
            uiLanguage || normalizeLanguage(settings?.preferredLanguage) || 'en'

          await prisma.agentMessage.create({
            data: {
              conversationId: conversation.id,
              role: 'USER',
              content: userMessage,
            },
          })

          const history = conversation.messages
            .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
            .map((m) => ({
              role: m.role === 'USER' ? 'user' : 'assistant',
              content: m.content,
            }))

          const result = await runAgentTurn({
            conversationId: conversation.id,
            userId: session.user.id,
            message: userMessage,
            history,
            languagePreference: preferredLanguage,
          })

          await prisma.agentMessage.create({
            data: {
              conversationId: conversation.id,
              role: 'ASSISTANT',
              content: result.text,
            },
          })

          await prisma.agentConversation.update({
            where: { id: conversation.id },
            data: {
              title:
                conversation.title === 'New chat'
                  ? userMessage.slice(0, 80)
                  : conversation.title,
              updatedAt: new Date(),
            },
          })

          return Response.json({
            reply: result.text,
            toolCalls: result.toolCalls,
            pendingActions: result.pendingActions,
          })
        } catch (error) {
          console.error('Agent chat error:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 },
          )
        }
      },
    },
  },
})
