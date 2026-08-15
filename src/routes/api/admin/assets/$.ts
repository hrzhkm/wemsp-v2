import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'
import { AssetType } from '@/generated/prisma/enums'
import {
  AssetDocumentError,
  deleteAssetDocument,
  reencryptAssetDocument,
  uploadAssetDocument,
} from '@/lib/storage/assetDocument'
import { DocumentEncryptionError } from '@/lib/storage/documentEncryption'

export const Route = createFileRoute('/api/admin/assets/$')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { headers: corsHeaders })
      },

      GET: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          // Get query parameters for pagination and filtering
          const url = new URL(request.url)
          const page = parseInt(url.searchParams.get('page') || '1')
          const limit = parseInt(url.searchParams.get('limit') || '10')
          const search = url.searchParams.get('search') || ''
          const type = url.searchParams.get('type') || ''

          const skip = (page - 1) * limit

          // Build where clause for search
          const where: any = search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { type: { equals: search as AssetType } },
                  {
                    user: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                ],
              }
            : {}

          if (type && Object.values(AssetType).includes(type as AssetType)) {
            where.type = type as AssetType
          }

          // Get total count for pagination
          const total = await prisma.asset.count({ where })

          // Get assets with pagination
          const assets = await prisma.asset.findMany({
            where,
            skip,
            take: limit,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  agreementAssets: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          return Response.json(
            {
              assets,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            },
            { headers: corsHeaders },
          )
        } catch (error) {
          console.error('Error fetching assets')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          // Parse FormData instead of JSON
          const formData = await request.formData()
          const name = formData.get('name') as string
          const type = formData.get('type') as string
          const description = formData.get('description') as string | null
          const value = formData.get('value') as string
          const document = formData.get('document') as File | null
          const userId = formData.get('userId') as string

          // Validate required fields
          if (!name || !type || !value || !userId) {
            return Response.json(
              { error: 'Missing required fields' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate asset type
          if (!Object.values(AssetType).includes(type as AssetType)) {
            return Response.json(
              { error: 'Invalid asset type' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate value is a positive number
          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue < 0) {
            return Response.json(
              { error: 'Value must be a positive number' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate user exists
          const user = await prisma.user.findUnique({
            where: { id: userId },
          })

          if (!user) {
            return Response.json(
              { error: 'User not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          // Encrypt with the asset owner's FEK before storing in R2.
          let documentUrl: string | null = null
          if (document && document.size > 0) {
            documentUrl = (await uploadAssetDocument(userId, document)).url
          }

          // Create asset in database
          let asset
          try {
            asset = await prisma.asset.create({
              data: {
                name,
                type: type as AssetType,
                description: description || null,
                value: numValue,
                documentUrl,
                documentEncrypted: Boolean(documentUrl),
                userId,
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                _count: {
                  select: {
                    agreementAssets: true,
                  },
                },
              },
            })
          } catch (error) {
            if (documentUrl)
              await deleteAssetDocument(documentUrl).catch(() => undefined)
            throw error
          }

          return Response.json(
            {
              success: true,
              asset,
            },
            { status: 201, headers: corsHeaders },
          )
        } catch (error) {
          if (
            error instanceof AssetDocumentError ||
            error instanceof DocumentEncryptionError
          ) {
            return Response.json(
              { error: error.message },
              { status: 400, headers: corsHeaders },
            )
          }
          console.error('Error creating asset')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },

      PUT: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          const url = new URL(request.url)
          const id = url.pathname.split('/').pop()

          if (!id) {
            return Response.json(
              { error: 'Missing asset id' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Check if asset exists
          const existingAsset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
          })

          if (!existingAsset) {
            return Response.json(
              { error: 'Asset not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          // Parse FormData
          const formData = await request.formData()
          const name = formData.get('name') as string
          const type = formData.get('type') as string
          const description = formData.get('description') as string | null
          const value = formData.get('value') as string
          const document = formData.get('document') as File | null
          const userId = formData.get('userId') as string

          // Validate required fields
          if (!name || !type || !value || !userId) {
            return Response.json(
              { error: 'Missing required fields' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate asset type
          if (!Object.values(AssetType).includes(type as AssetType)) {
            return Response.json(
              { error: 'Invalid asset type' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate value is a positive number
          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue < 0) {
            return Response.json(
              { error: 'Value must be a positive number' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Validate user exists
          const user = await prisma.user.findUnique({
            where: { id: userId },
          })

          if (!user) {
            return Response.json(
              { error: 'User not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          let documentUrl = existingAsset.documentUrl
          let newDocumentUrl: string | null = null

          // Handle document replacement
          if (document && document.size > 0) {
            newDocumentUrl = (await uploadAssetDocument(userId, document)).url
            documentUrl = newDocumentUrl
          } else if (
            existingAsset.documentUrl &&
            existingAsset.userId !== userId
          ) {
            newDocumentUrl = (
              await reencryptAssetDocument(
                existingAsset.documentUrl,
                existingAsset.userId,
                userId,
              )
            ).url
            documentUrl = newDocumentUrl
          }

          // Update asset in database
          let asset
          try {
            asset = await prisma.asset.update({
              where: { id: parseInt(id) },
              data: {
                name,
                type: type as AssetType,
                description: description || null,
                value: numValue,
                documentUrl,
                documentEncrypted: newDocumentUrl
                  ? true
                  : existingAsset.documentEncrypted,
                userId,
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                _count: {
                  select: {
                    agreementAssets: true,
                  },
                },
              },
            })
          } catch (error) {
            if (newDocumentUrl)
              await deleteAssetDocument(newDocumentUrl).catch(() => undefined)
            throw error
          }
          if (newDocumentUrl && existingAsset.documentUrl) {
            await deleteAssetDocument(existingAsset.documentUrl).catch(
              () => undefined,
            )
          }

          return Response.json(
            {
              success: true,
              asset,
            },
            { headers: corsHeaders },
          )
        } catch (error) {
          if (
            error instanceof AssetDocumentError ||
            error instanceof DocumentEncryptionError
          ) {
            return Response.json(
              { error: error.message },
              { status: 400, headers: corsHeaders },
            )
          }
          console.error('Error updating asset')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        try {
          // Verify admin session
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          const url = new URL(request.url)
          const id = url.pathname.split('/').pop()

          if (!id) {
            return Response.json(
              { error: 'Missing asset id' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Check if asset exists
          const asset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
            include: {
              _count: {
                select: {
                  agreementAssets: true,
                },
              },
            },
          })

          if (!asset) {
            return Response.json(
              { error: 'Asset not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          // Check if asset is used in agreements
          if (asset._count.agreementAssets > 0) {
            return Response.json(
              { error: 'Cannot delete asset that is used in agreements' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Delete storage first so a failure preserves the database reference for retry.
          if (asset.documentUrl) {
            await deleteAssetDocument(asset.documentUrl)
          }

          // Delete asset from database
          await prisma.asset.delete({
            where: { id: parseInt(id) },
          })

          return Response.json(
            {
              success: true,
              message: 'Asset deleted successfully',
            },
            { headers: corsHeaders },
          )
        } catch (error) {
          console.error('Error deleting asset')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  },
})
