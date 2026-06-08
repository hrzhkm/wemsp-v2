import { createFileRoute } from '@tanstack/react-router'
import { uploadFileToS3, generateS3Key } from '@/lib/storage/aws'

export const Route = createFileRoute('/api/upload/json/')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { text } = body

          // Create JSON content
          const jsonContent = { text: text || 'Hello World' }
          const jsonString = JSON.stringify(jsonContent, null, 2)

          // Convert to Buffer (server-side)
          const jsonBuffer = Buffer.from(jsonString, 'utf-8')

          // Generate unique S3 key in /test folder
          const key = generateS3Key('test.json', 'test')

          // Upload to S3
          const { url } = await uploadFileToS3(jsonBuffer, key)

          return Response.json({
            success: true,
            url,
            key,
            content: jsonContent,
          })
        } catch (error) {
          console.error('Error uploading JSON:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to upload JSON' },
            { status: 500 }
          )
        }
      },
    },
  },
})
