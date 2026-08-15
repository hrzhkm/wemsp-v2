import { createFileRoute } from '@tanstack/react-router'
import { serveAssetDocument } from '@/lib/storage/assetDocument'

export const fileHandlers = {
  GET: async ({
    request,
    params,
  }: {
    request: Request
    params: { _splat: string }
  }) => {
    if (!params._splat)
      return Response.json({ error: 'Document not found' }, { status: 404 })
    return serveAssetDocument(request, params._splat)
  },
}

export const Route = createFileRoute('/api/file/$')({
  server: {
    handlers: fileHandlers,
  },
})
