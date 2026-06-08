import { createFileRoute } from '@tanstack/react-router'
import { getFileFromS3 } from '@/lib/storage/aws'

export const Route = createFileRoute('/api/file/$')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { _splat: string } }) => {
        try {
          // Get the file key from the URL path
          // Example: /api/file/uploads/1234-abc-file.pdf -> uploads/1234-abc-file.pdf
          const key = params._splat

          if (!key) {
            return new Response('No file path provided', { status: 400 })
          }

          // Fetch the file from S3
          const { body, contentType, contentLength, fileName } = await getFileFromS3(key)

          // Return the file directly with appropriate headers
          return new Response(body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': contentLength.toString(),
              'Content-Disposition': `inline; filename="${fileName}"`,
              'Cache-Control': 'public, max-age=3600',
              'Accept-Ranges': 'bytes',
            },
          })
        } catch (error) {
          console.error('Error accessing file:', error)
          return new Response(
            error instanceof Error ? error.message : 'Failed to access file',
            { status: 500 }
          )
        }
      },
    },
  },
})
