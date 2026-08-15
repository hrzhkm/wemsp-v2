import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import {
  DocumentEncryptionError,
  configureDocumentEncryption,
  getDocumentEncryptionStatus,
  normalizeDocumentAnswer,
  updateDocumentEncryption,
} from '@/lib/storage/documentEncryption'

function errorResponse(error: unknown) {
  if (error instanceof DocumentEncryptionError) {
    const status = error.code === 'ALREADY_CONFIGURED' ? 409 : 400
    return Response.json({ error: error.message }, { status })
  }
  console.error('Document encryption request failed')
  return Response.json(
    { error: 'Unable to update document encryption' },
    { status: 500 },
  )
}

async function sessionUserId(request: Request) {
  return (await auth.api.getSession({ headers: request.headers }))?.user.id
}

export const documentEncryptionHandlers = {
  GET: async ({ request }: { request: Request }) => {
    const userId = await sessionUserId(request)
    if (!userId)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json(await getDocumentEncryptionStatus(userId))
  },

  POST: async ({ request }: { request: Request }) => {
    const userId = await sessionUserId(request)
    if (!userId)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const body = await request.json()
      if (!body || typeof body !== 'object') {
        return Response.json(
          { error: 'Invalid request payload' },
          { status: 400 },
        )
      }
      if (
        typeof body.answer !== 'string' ||
        typeof body.confirmAnswer !== 'string' ||
        normalizeDocumentAnswer(body.answer) !==
          normalizeDocumentAnswer(body.confirmAnswer)
      ) {
        return Response.json({ error: 'Answers do not match' }, { status: 400 })
      }
      const result = await configureDocumentEncryption(
        userId,
        body.questionId,
        body.answer,
      )
      return Response.json({ configured: true, ...result }, { status: 201 })
    } catch (error) {
      return errorResponse(error)
    }
  },

  PUT: async ({ request }: { request: Request }) => {
    const userId = await sessionUserId(request)
    if (!userId)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const body = await request.json()
      if (!body || typeof body !== 'object') {
        return Response.json(
          { error: 'Invalid request payload' },
          { status: 400 },
        )
      }
      if (
        typeof body.newAnswer !== 'string' ||
        typeof body.confirmNewAnswer !== 'string' ||
        normalizeDocumentAnswer(body.newAnswer) !==
          normalizeDocumentAnswer(body.confirmNewAnswer)
      ) {
        return Response.json({ error: 'Answers do not match' }, { status: 400 })
      }
      const result = await updateDocumentEncryption(
        userId,
        body.currentAnswer,
        body.questionId,
        body.newAnswer,
      )
      return Response.json({ configured: true, ...result })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

export const Route = createFileRoute('/api/user/document-encryption/$')({
  server: { handlers: documentEncryptionHandlers },
})
