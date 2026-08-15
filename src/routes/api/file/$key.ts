import { createFileRoute } from '@tanstack/react-router'
import { serveAssetDocument } from '@/lib/storage/assetDocument'

export const keyedFileHandlers = {
  GET: async ({
    request,
    params,
  }: {
    request: Request
    params: { key: string }
  }) => {
    if (!params.key)
      return Response.json({ error: 'Document not found' }, { status: 404 })
    return serveAssetDocument(request, params.key)
  },
}

export const Route = createFileRoute('/api/file/$key')({
  server: {
    handlers: keyedFileHandlers,
  },
})
