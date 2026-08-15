import { createFileRoute } from '@tanstack/react-router'
import { getFileFromS3 } from '@/lib/storage/aws'

export const Route = createFileRoute('/api/file/$key')({
  server: {
    handler: async ({ request }: { request: Request }) => {
      const { key } = Route.useParams()

      if (!key) {
        return new Response('No file key provided', { status: 400 })
      }

      try {
        const { stream, contentType } = await getFileFromS3(key)

        return new Response(stream, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          },
        })
      } catch (error) {
        console.error('Error serving file:', error)
        return new Response(
          error instanceof Error ? error.message : 'Failed to serve file',
          { status: 404 }
        )
      }
    },
  },
})
