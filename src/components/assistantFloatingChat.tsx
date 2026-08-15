import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, Loader2, MessageCircle, Paperclip, Plus, SendHorizontal, Sparkles, User2, X } from 'lucide-react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/authClient'
import { useLanguage } from '@/lib/i18n/context'

type ChatMessage = {
  id?: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt?: string
}

type ConversationSummary = {
  id: string
  title: string | null
  updatedAt: string
  messageCount: number
}

type PendingAssetAction = {
  createdAt: string
  kind: 'ASSET_CREATE'
  pendingId: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  asset: {
    description?: string | null
    documentUrl?: string | null
    name: string
    type: 'PROPERTY' | 'VEHICLE' | 'INVESTMENT' | 'OTHER'
    value: number
  }
}

type MessageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: Array<string> }
  | { type: 'ordered-list'; items: Array<string> }

const getStorageKey = (userId: string) => `wemsp-assistant:${userId}:ui-state`

function renderInlineMarkdown(text: string): Array<ReactNode> {
  const segments = text.split(/(\*\*[^*\n]+?\*\*)/g)

  return segments.filter(Boolean).map((segment, index) => {
    const strongMatch = segment.match(/^\*\*([^*\n]+?)\*\*$/)
    if (strongMatch) {
      return (
        <strong key={`strong-${index}`} className="font-semibold">
          {strongMatch[1]}
        </strong>
      )
    }

    return <span key={`text-${index}`}>{segment}</span>
  })
}

function parseMessageBlocks(content: string): Array<MessageBlock> {
  const lines = content.replaceAll('\r\n', '\n').split('\n')
  const blocks: Array<MessageBlock> = []
  let paragraphLines: Array<string> = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
    paragraphLines = []
  }

  let index = 0

  while (index < lines.length) {
    const trimmedLine = lines[index].trim()

    if (!trimmedLine) {
      flushParagraph()
      index += 1
      continue
    }

    const unorderedMatch = trimmedLine.match(/^-\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      const items: Array<string> = []

      while (index < lines.length) {
        const match = lines[index].trim().match(/^-\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }

      blocks.push({ type: 'unordered-list', items })
      continue
    }

    const orderedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      const items: Array<string> = []

      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.+)$/)
        if (!match) break
        items.push(match[1])
        index += 1
      }

      blocks.push({ type: 'ordered-list', items })
      continue
    }

    paragraphLines.push(trimmedLine)
    index += 1
  }

  flushParagraph()
  return blocks
}

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseMessageBlocks(content)

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'unordered-list') {
          return (
            <ul key={`ul-${blockIndex}`} className="ml-5 list-disc space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${blockIndex}-${itemIndex}`} className="pl-0.5">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ol-${blockIndex}`} className="ml-5 list-decimal space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${blockIndex}-${itemIndex}`} className="pl-0.5">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          )
        }

        return (
          <p key={`p-${blockIndex}`} className="whitespace-pre-wrap break-words">
            {renderInlineMarkdown(block.text)}
          </p>
        )
      })}
    </div>
  )
}

const readPersistedState = (key: string) => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { open?: boolean; conversationId?: string }) : null
  } catch {
    return null
  }
}

export function AssistantFloatingChat() {
  const { language, t } = useLanguage()
  const { data: sessionData } = authClient.useSession()
  const userId = sessionData?.user.id

  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Array<ConversationSummary>>([])
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [pendingActions, setPendingActions] = useState<Array<PendingAssetAction>>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [confirmingPendingId, setConfirmingPendingId] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const persistState = useCallback(
    (patch: Partial<{ open: boolean; conversationId: string | null }>) => {
      if (!userId || typeof window === 'undefined') return

      const key = getStorageKey(userId)
      const current = readPersistedState(key) || {}
      const next = { ...current, ...patch }
      window.localStorage.setItem(key, JSON.stringify(next))
    },
    [userId]
  )

  const fetchConversations = useCallback(async () => {
    const response = await fetch('/api/agent/conversations')
    if (!response.ok) throw new Error('Unable to load conversations')

    const data = (await response.json()) as { conversations?: Array<ConversationSummary> }
    const list = data.conversations || []
    setConversations(list)
    return list
  }, [])

  const loadConversationMessages = useCallback(async (id: string) => {
    const historyRes = await fetch(`/api/agent/conversations/${id}`)
    if (!historyRes.ok) throw new Error('Unable to load conversation history')

    const historyData = (await historyRes.json()) as {
      messages?: Array<ChatMessage>
      pendingActions?: Array<PendingAssetAction>
    }
    const parsed = (historyData.messages || []).filter((m: ChatMessage) => m.role !== 'SYSTEM')
    setMessages(parsed)
    setPendingActions((historyData.pendingActions || []).filter((item) => item.status === 'PENDING'))
  }, [])

  const createNewConversation = useCallback(async () => {
    setIsCreatingConversation(true)
    try {
      const createdRes = await fetch('/api/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New chat' }),
      })

      if (!createdRes.ok) throw new Error('Unable to create conversation')

      const created = await createdRes.json()
      const id = created?.conversation?.id as string | undefined

      if (!id) throw new Error('Conversation id missing')

      await fetchConversations()
      setConversationId(id)
      setMessages([])
      setPendingActions([])
      persistState({ conversationId: id })
      return id
    } finally {
      setIsCreatingConversation(false)
    }
  }, [fetchConversations, persistState])

  useEffect(() => {
    if (!userId) return

    const init = async () => {
      try {
        const list = await fetchConversations()

        const saved = readPersistedState(getStorageKey(userId))

        if (saved && typeof saved.open === 'boolean') {
          setOpen(saved.open)
        }

        const savedConversationId = saved?.conversationId
        const targetId =
          savedConversationId && list.some((item) => item.id === savedConversationId)
            ? savedConversationId
            : list[0]?.id

        if (targetId) {
          setConversationId(targetId)
          await loadConversationMessages(targetId)
          persistState({ conversationId: targetId })
        } else {
          await createNewConversation()
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsBootstrapping(false)
      }
    }

    init()
  }, [createNewConversation, fetchConversations, loadConversationMessages, persistState, userId])

  useEffect(() => {
    if (!open || !messagesContainerRef.current) return
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
  }, [messages, open, isBootstrapping, conversationId])

  const onSelectConversation = async (id: string) => {
    if (!id || id === conversationId) return

    const previousConversationId = conversationId
    const previousPendingActions = pendingActions
    setConversationId(id)
    persistState({ conversationId: id })

    try {
      await loadConversationMessages(id)
    } catch (error) {
      console.error('Failed to switch conversation:', error)
      setConversationId(previousConversationId ?? null)
      persistState({ conversationId: previousConversationId ?? null })
      setPendingActions(previousPendingActions)
      return
    }
  }

  const onToggleOpen = (next: boolean) => {
    setOpen(next)
    persistState({ open: next })
  }

  const onCreateConversation = async () => {
    try {
      await createNewConversation()
    } catch (error) {
      console.error(error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'ASSISTANT',
          content: t('assistantChat.errors.createConversation'),
        },
      ])
    }
  }

  const greeting = useMemo(() => messages.length === 0 && !isBootstrapping, [messages.length, isBootstrapping])
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) || null,
    [conversationId, conversations]
  )
  const quickPrompts = [
    t('assistantChat.quickPrompts.agreementStatus'),
    t('assistantChat.quickPrompts.familySummary'),
    t('assistantChat.quickPrompts.assetsReview'),
  ]
  const getConversationLabel = useCallback(
    (title: string | null | undefined) => {
      if (!title || title === 'New chat') return t('assistantChat.newChatFallback')
      return title
    },
    [t]
  )
  const conversationWord =
    conversations.length === 1
      ? t('assistantChat.conversationSingular')
      : t('assistantChat.conversationPlural')
  const isInputDisabled = isSending || isBootstrapping || isCreatingConversation || isUploadingDocument
  const formatAssetValue = useCallback(
    (value: number) =>
      new Intl.NumberFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value),
    [language]
  )

  const onConfirmPendingAsset = async (pendingId: string) => {
    if (!conversationId || !pendingId || confirmingPendingId) return

    setConfirmingPendingId(pendingId)

    try {
      const response = await fetch('/api/agent/pending-actions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, pendingId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t('assistantChat.errors.confirmAsset'))

      setPendingActions((prev) => prev.filter((action) => action.pendingId !== pendingId))
      setMessages((prev) => [
        ...prev,
        { role: 'ASSISTANT', content: data?.message || t('assistantChat.assetCreatedSuccess') },
      ])
      await fetchConversations()
      await loadConversationMessages(conversationId)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ASSISTANT',
          content: error instanceof Error ? error.message : t('assistantChat.errors.confirmAsset'),
        },
      ])
    } finally {
      setConfirmingPendingId(null)
    }
  }

  const onPickDocument = () => {
    if (isInputDisabled) return
    fileInputRef.current?.click()
  }

  const onDocumentSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingDocument(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || t('assistantChat.errors.uploadDocument'))
      }

      const data = (await response.json()) as { fileName?: string; url?: string }
      if (!data.url) throw new Error(t('assistantChat.errors.uploadDocument'))

      const nextInput = `${t('assistantChat.documentAttachedPrefix')} ${data.fileName || file.name}\n${t('assistantChat.documentUrlLabel')}: ${data.url}`
      setInput((prev) => (prev ? `${prev}\n\n${nextInput}` : nextInput))
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ASSISTANT',
          content: error instanceof Error ? error.message : t('assistantChat.errors.uploadDocument'),
        },
      ])
    } finally {
      setIsUploadingDocument(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const message = input.trim()
    if (!message || !conversationId || isSending) return

    setInput('')
    setIsSending(true)
    setMessages((prev) => [...prev, { role: 'USER', content: message }])

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId, language }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to send message')

      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: data.reply || 'No reply generated.' }])
      if (Array.isArray(data.pendingActions) && data.pendingActions.length > 0) {
        setPendingActions((prev) => {
          const merged = new Map(prev.map((action) => [action.pendingId, action]))
          for (const action of data.pendingActions as Array<PendingAssetAction>) {
            if (action.status !== 'PENDING') continue
            merged.set(action.pendingId, action)
          }
          return Array.from(merged.values())
        })
      }
      await fetchConversations()
      await loadConversationMessages(conversationId)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'ASSISTANT', content: error instanceof Error ? error.message : 'Something went wrong.' },
      ])
    } finally {
      setIsSending(false)
    }
  }

  if (!userId) return null

  return (
    <div className="fixed bottom-3 right-3 z-50 sm:bottom-5 sm:right-5">
      {open ? (
        <Card className="w-[calc(100vw-1.5rem)] max-w-[420px] gap-0 overflow-hidden border-border/70 py-0 shadow-2xl">
          <CardHeader className="space-y-3 border-b border-border/70 bg-gradient-to-r from-sky-50 via-background to-emerald-50 pb-3 pt-4 dark:from-sky-950/30 dark:to-emerald-950/20">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-semibold leading-none">{t('assistantChat.title')}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {getConversationLabel(selectedConversation?.title)} • {conversations.length} {conversationWord}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onToggleOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-xl border border-border/70 bg-background/90 px-3 text-sm shadow-sm"
                value={conversationId ?? ''}
                onChange={(e) => onSelectConversation(e.target.value)}
                disabled={isBootstrapping || isCreatingConversation}
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getConversationLabel(c.title).slice(0, 40)} ({c.messageCount})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl px-3"
                onClick={onCreateConversation}
                disabled={isBootstrapping || isSending || isCreatingConversation}
              >
                {isCreatingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div
              ref={messagesContainerRef}
              className="h-[360px] overflow-y-auto bg-muted/25 p-3 sm:h-[400px]"
            >
              {isBootstrapping ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('assistantChat.loadingConversation')}
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingActions.map((action) => (
                    <div
                      key={action.pendingId}
                      className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"
                    >
                      <p className="font-semibold text-foreground">{t('assistantChat.confirmAssetTitle')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('assistantChat.confirmAssetDescription')}
                      </p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          <span className="font-medium">{t('assistantChat.assetFields.name')}:</span> {action.asset.name}
                        </p>
                        <p>
                          <span className="font-medium">{t('assistantChat.assetFields.type')}:</span> {action.asset.type}
                        </p>
                        <p>
                          <span className="font-medium">{t('assistantChat.assetFields.value')}:</span>{' '}
                          {formatAssetValue(action.asset.value)}
                        </p>
                        {action.asset.documentUrl ? (
                          <p>
                            <span className="font-medium">{t('assistantChat.assetFields.document')}:</span>{' '}
                            {t('assistantChat.documentAttachedPrefix')}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onConfirmPendingAsset(action.pendingId)}
                          disabled={confirmingPendingId === action.pendingId}
                        >
                          {confirmingPendingId === action.pendingId ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('assistantChat.confirming')}
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              {t('assistantChat.confirmButton')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {greeting && (
                    <div className="rounded-2xl border border-dashed border-primary/30 bg-background/90 p-3 text-sm shadow-sm">
                      <p className="font-medium text-foreground">{t('assistantChat.greetingTitle')}</p>
                      <p className="mt-1 text-muted-foreground">{t('assistantChat.greetingDescription')}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            onClick={() => setInput(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex max-w-[90%] items-start gap-2 ${
                          message.role === 'USER' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                            message.role === 'USER' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {message.role === 'USER' ? (
                            <User2 className="h-3.5 w-3.5" />
                          ) : (
                            <Bot className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                            message.role === 'USER'
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border/70 bg-background'
                          }`}
                        >
                          {message.role === 'USER' ? (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.content}
                            </p>
                          ) : (
                            <AssistantMessageContent content={message.content} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="flex max-w-[70%] items-start gap-2">
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t('assistantChat.thinking')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form className="space-y-2 border-t border-border/70 bg-background p-3" onSubmit={onSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onDocumentSelected}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 rounded-xl"
                  onClick={onPickDocument}
                  disabled={isInputDisabled}
                >
                  {isUploadingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Input
                  disabled={isInputDisabled}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('assistantChat.inputPlaceholder')}
                  className="h-10 rounded-xl"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  disabled={isInputDisabled || !input.trim()}
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('assistantChat.enterHint')} • {t('assistantChat.uploadHint')}
              </p>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="relative h-14 w-14 rounded-2xl p-0 shadow-lg ring-4 ring-primary/15 transition-transform hover:scale-[1.03]"
          onClick={() => onToggleOpen(true)}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow">
            AI
          </span>
        </Button>
      )}
    </div>
  )
}
