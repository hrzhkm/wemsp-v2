import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { buildAgentSystemPrompt } from './system-prompt'
import { buildAgentTools } from './tools'
import type { AgentPendingActionSummary } from './pending-actions'
import type { AgentResponseLanguage } from './system-prompt'

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

type RunAgentTurnInput = {
  conversationId: string
  userId: string
  message: string
  history?: Array<HistoryMessage>
  languagePreference?: AgentResponseLanguage
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => JSON.stringify(c)).join('\n')
  return JSON.stringify(content)
}

function extractPendingActionSummary(value: unknown): AgentPendingActionSummary | null {
  if (!value || typeof value !== 'object' || !('pendingAction' in value)) return null

  const pendingAction = (value as { pendingAction?: unknown }).pendingAction
  if (!pendingAction || typeof pendingAction !== 'object') return null

  const typedPending = pendingAction as Partial<AgentPendingActionSummary>
  if (typedPending.kind !== 'ASSET_CREATE' || typedPending.status !== 'PENDING') return null
  if (!typedPending.pendingId || !typedPending.createdAt || !typedPending.asset) return null

  return typedPending as AgentPendingActionSummary
}

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  if (!apiKey.startsWith('sk-or-v1-') || apiKey.length < 40) {
    throw new Error('OPENROUTER_API_KEY appears invalid. Set a full OpenRouter API key (starts with sk-or-v1-).')
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2.5',
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  }
}

export async function runAgentTurn(input: RunAgentTurnInput) {
  const openRouter = getOpenRouterConfig()

  const model = new ChatOpenAI({
    model: openRouter.model,
    temperature: 0.2,
    apiKey: openRouter.apiKey,
    configuration: {
      baseURL: openRouter.baseURL,
      defaultHeaders: {
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
    },
  })

  const tools = buildAgentTools({ userId: input.userId, conversationId: input.conversationId })
  const toolMap = new Map(tools.map((t) => [t.name, t]))

  const historyMessages = (input.history || []).slice(-10).map((m) => {
    if (m.role === 'assistant') return new AIMessage(m.content)
    return new HumanMessage(m.content)
  })

  const baseMessages = [
    new SystemMessage(buildAgentSystemPrompt(input.languagePreference || 'en')),
    ...historyMessages,
    new HumanMessage(input.message),
  ]

  const first = await model.bindTools(tools).invoke(baseMessages)

  const toolMessages: Array<ToolMessage> = []
  const pendingActions: Array<AgentPendingActionSummary> = []

  for (const call of first.tool_calls ?? []) {
    const matchedTool = toolMap.get(call.name)

    if (!matchedTool) {
      toolMessages.push(
        new ToolMessage({
          content: `Tool not found: ${call.name}`,
          tool_call_id: call.id ?? call.name,
        })
      )
      continue
    }

    try {
      const result = await matchedTool.invoke(call.args)
      const pendingAction = extractPendingActionSummary(result)
      if (pendingAction) pendingActions.push(pendingAction)

      toolMessages.push(
        new ToolMessage({
          content: contentToText(result),
          tool_call_id: call.id ?? matchedTool.name,
        })
      )
    } catch (error) {
      toolMessages.push(
        new ToolMessage({
          content: `Tool error (${matchedTool.name}): ${error instanceof Error ? error.message : 'Unknown error'}`,
          tool_call_id: call.id ?? matchedTool.name,
        })
      )
    }
  }

  const finalResponse =
    toolMessages.length > 0
      ? await model.bindTools(tools).invoke([...baseMessages, first, ...toolMessages])
      : first

  return {
    text: contentToText(finalResponse.content),
    toolCalls: (first.tool_calls ?? []).map((c) => ({ name: c.name })),
    pendingActions,
  }
}
