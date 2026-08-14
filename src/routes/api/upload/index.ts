import { createFileRoute } from '@tanstack/react-router'
import { uploadFileToS3, deleteFileFromS3, generateS3Key } from '@/lib/storage/aws'

export const Route = createFileRoute('/api/upload/')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file') as File

          if (!file) {
            return new Response('No file provided', { status: 400 })
          }

          // Validate file type (accept PDF and images)
          const allowedTypes = [
            'application/pdf',
          ]

          if (!allowedTypes.includes(file.type)) {
            return new Response(
              `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
              { status: 400 }
            )
          }

          // Validate file size (max 10MB)
          const maxSize = 10 * 1024 * 1024 // 10MB
          if (file.size > maxSize) {
            return new Response('File size exceeds 10MB limit', { status: 400 })
          }

          // Generate unique S3 key
          const key = generateS3Key(file.name, 'uploads')

          // Upload to S3
          const { url } = await uploadFileToS3(file, key)

          return Response.json({
            success: true,
            url,
            key,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          })
        } catch (error) {
          console.error('Error uploading file:', error)
          return new Response(
            error instanceof Error ? error.message : 'Failed to upload file',
            { status: 500 }
          )
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        try {
          const { searchParams } = new URL(request.url)
          const key = searchParams.get('key')

          if (!key) {
            return new Response('No file key provided', { status: 400 })
          }

          await deleteFileFromS3(key)

          return Response.json({
            success: true,
            message: 'File deleted successfully',
          })
        } catch (error) {
          console.error('Error deleting file:', error)
          return new Response(
            error instanceof Error ? error.message : 'Failed to delete file',
            { status: 500 }
          )
        }
      },
    },
  },
})
