import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import {
  AssetDocumentError,
  deleteAssetDocument,
  extractDocumentKey,
  uploadAssetDocument,
} from '@/lib/storage/assetDocument'
import { DocumentEncryptionError } from '@/lib/storage/documentEncryption'

export const uploadHandlers = {
  POST: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const file = (await request.formData()).get('file')
      if (!(file instanceof File)) {
        return Response.json({ error: 'No file provided' }, { status: 400 })
      }
      const uploaded = await uploadAssetDocument(session.user.id, file, true)
      return Response.json({
        success: true,
        url: uploaded.url,
        key: uploaded.key,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
    } catch (error) {
      if (
        error instanceof AssetDocumentError ||
        error instanceof DocumentEncryptionError
      ) {
        return Response.json({ error: error.message }, { status: 400 })
      }
      console.error('Assistant document upload failed')
      return Response.json(
        { error: 'Failed to upload document' },
        { status: 500 },
      )
    }
  },

  DELETE: async ({ request }: { request: Request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const key = new URL(request.url).searchParams.get('key') || ''
      const documentUrl = `/api/file/${key}`
      if (
        !extractDocumentKey(documentUrl).startsWith(
          `tmp/asset-documents/${session.user.id}/`,
        )
      ) {
        return Response.json({ error: 'Document not found' }, { status: 404 })
      }
      await deleteAssetDocument(documentUrl)
      return Response.json({ success: true })
    } catch {
      return Response.json({ error: 'Document not found' }, { status: 404 })
    }
  },
}

export const Route = createFileRoute('/api/upload/')({
  server: { handlers: uploadHandlers },
})
