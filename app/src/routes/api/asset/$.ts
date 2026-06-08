import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { AssetType } from '@/generated/prisma/enums'
import { uploadFileToS3, generateS3Key, getFileUrl, deleteFileFromS3, extractKeyFromUrl } from '@/lib/storage/aws'

// Helper function to get inverse relationship
// When someone adds you as their family member, we need to determine what they are to you
function getInverseRelationship(relation: string): string {
  const inverseMap: Record<string, string> = {
    FATHER: 'SON',           // If you are someone's father, they are your son/daughter (we'll use SON as default)
    MOTHER: 'SON',           // If you are someone's mother, they are your son/daughter
    SON: 'FATHER',           // If someone is your son, you are their father/mother
    DAUGHTER: 'FATHER',      // If someone is your daughter, you are their father/mother
    SIBLING: 'SIBLING',      // Sibling is symmetric
    SPOUSE: 'SPOUSE',        // Spouse is symmetric
    GRANDFATHER: 'GRANDSON',
    GRANDMOTHER: 'GRANDSON',
    GRANDSON: 'GRANDFATHER',
    GRANDDAUGHTER: 'GRANDFATHER',
    UNCLE: 'NEPHEW',
    AUNT: 'NEPHEW',
    NEPHEW: 'UNCLE',
    NIECE: 'AUNT',
    COUSIN: 'COUSIN',        // Cousin is symmetric
    OTHER: 'OTHER',
  }
  return inverseMap[relation] || 'OTHER'
}

export const Route = createFileRoute('/api/asset/$')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          // Parse FormData instead of JSON
          const formData = await request.formData()
          const name = formData.get('name') as string
          const type = formData.get('type') as string
          const description = formData.get('description') as string | null
          const value = formData.get('value') as string
          const document = formData.get('document') as File | null

          // Validate required fields
          if (!name || !type || !value) {
            return Response.json(
              { error: 'Missing required fields' },
              { status: 400 }
            )
          }

          // Validate asset type
          if (!Object.values(AssetType).includes(type as AssetType)) {
            return Response.json(
              { error: 'Invalid asset type' },
              { status: 400 }
            )
          }

          // Validate value is a positive number
          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue < 0) {
            return Response.json(
              { error: 'Value must be a positive number' },
              { status: 400 }
            )
          }

          // Upload document to S3 if provided
          let documentUrl: string | null = null
          if (document && document.size > 0) {
            // Validate file type
            const allowedTypes = [
              'application/pdf',
            ]

            if (!allowedTypes.includes(document.type)) {
              return Response.json(
                { error: 'Invalid file type. Allowed types: PDF' },
                { status: 400 }
              )
            }

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (document.size > maxSize) {
              return Response.json(
                { error: 'File size exceeds 10MB limit' },
                { status: 400 }
              )
            }

            // Upload to S3
            const key = generateS3Key(document.name, 'documents')
            await uploadFileToS3(document, key)
            documentUrl = getFileUrl(key)
          }

          // Create asset in database
          const asset = await prisma.asset.create({
            data: {
              name,
              type: type as AssetType,
              description: description || null,
              value: numValue,
              documentUrl,
              userId: session.user.id,
            },
          })

          return Response.json({
            success: true,
            asset: {
              id: asset.id,
              name: asset.name,
              type: asset.type,
              description: asset.description,
              value: asset.value,
              documentUrl: asset.documentUrl,
            },
          }, { status: 201 })
        } catch (error) {
          console.error('Error creating asset:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const id = url.pathname.split('/').pop()

          // If ID is present and numeric, fetch single asset
          if (id && /^\d+$/.test(id)) {
            // Fetch family members to check if the current user can view this asset
            const familyMembers = await prisma.familyMember.findMany({
              where: {
                OR: [
                  { userId: session.user.id },
                  { familyMemberUserId: session.user.id },
                ],
              },
            })

            // Get unique family member user IDs including the current user
            const accessibleUserIds = new Set([session.user.id])
            familyMembers.forEach((fm) => {
              if (fm.userId !== session.user.id) {
                accessibleUserIds.add(fm.userId)
              }
              if (fm.familyMemberUserId !== session.user.id) {
                accessibleUserIds.add(fm.familyMemberUserId)
              }
            })

            // Build relationship map for displaying relationship
            const relationshipMap = new Map<string, string>()
            familyMembers.forEach((fm) => {
              if (fm.userId === session.user.id) {
                relationshipMap.set(fm.familyMemberUserId, fm.relation)
              } else if (fm.familyMemberUserId === session.user.id) {
                relationshipMap.set(fm.userId, getInverseRelationship(fm.relation))
              }
            })

            const asset = await prisma.asset.findFirst({
              where: {
                id: parseInt(id),
                userId: {
                  in: Array.from(accessibleUserIds),
                },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })

            if (!asset) {
              return Response.json(
                { error: 'Asset not found' },
                { status: 404 }
              )
            }

            // Determine relationship if asset belongs to family member
            const relationship = asset.userId !== session.user.id
              ? relationshipMap.get(asset.userId) || 'OTHER'
              : undefined

            return Response.json({
              asset: {
                id: asset.id,
                name: asset.name,
                type: asset.type,
                description: asset.description,
                value: asset.value,
                documentUrl: asset.documentUrl,
                createdAt: asset.createdAt.toISOString(),
                owner: {
                  id: asset.user.id,
                  name: asset.user.name,
                },
                relationship,
              },
            })
          }

          // Fetch user's assets
          const userAssets = await prisma.asset.findMany({
            where: { userId: session.user.id },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          // Fetch family members (both directions)
          const familyMembers = await prisma.familyMember.findMany({
            where: {
              OR: [
                { userId: session.user.id },
                { familyMemberUserId: session.user.id },
              ],
            },
          })

          // Create a map of userId to relationship for easy lookup
          const relationshipMap = new Map<string, string>()
          familyMembers.forEach((fm) => {
            if (fm.userId === session.user.id) {
              // The current user created this relationship, so familyMemberUserId is the related person
              relationshipMap.set(fm.familyMemberUserId, fm.relation)
            } else if (fm.familyMemberUserId === session.user.id) {
              // The current user is the family member, so userId is the related person
              // We need to determine the inverse relationship
              relationshipMap.set(fm.userId, getInverseRelationship(fm.relation))
            }
          })

          // Get unique family member user IDs
          const familyMemberUserIds = new Set<string>()
          familyMembers.forEach((fm) => {
            if (fm.userId !== session.user.id) {
              familyMemberUserIds.add(fm.userId)
            }
            if (fm.familyMemberUserId !== session.user.id) {
              familyMemberUserIds.add(fm.familyMemberUserId)
            }
          })

          // Fetch assets from family members
          const familyAssets = await prisma.asset.findMany({
            where: {
              userId: {
                in: Array.from(familyMemberUserIds),
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          // Transform user assets to include owner field
          const transformedUserAssets = userAssets.map((asset: any) => ({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            description: asset.description,
            value: asset.value,
            documentUrl: asset.documentUrl,
            createdAt: asset.createdAt.toISOString(),
            owner: {
              id: asset.user.id,
              name: asset.user.name,
            },
          }))

          // Transform family assets to include owner field and relationship
          const transformedFamilyAssets = familyAssets.map((asset: any) => ({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            description: asset.description,
            value: asset.value,
            documentUrl: asset.documentUrl,
            createdAt: asset.createdAt.toISOString(),
            owner: {
              id: asset.user.id,
              name: asset.user.name,
            },
            relationship: relationshipMap.get(asset.user.id) || 'OTHER',
          }))

          return Response.json({
            assets: transformedUserAssets,
            familyAssets: transformedFamilyAssets,
          })
        } catch (error) {
          console.error('Error fetching assets:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      PUT: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const id = url.pathname.split('/').pop()

          if (!id) {
            return Response.json(
              { error: 'Missing asset id' },
              { status: 400 }
            )
          }

          // Check if asset exists and belongs to user
          const existingAsset = await prisma.asset.findFirst({
            where: {
              id: parseInt(id),
              userId: session.user.id,
            },
          })

          if (!existingAsset) {
            return Response.json(
              { error: 'Asset not found' },
              { status: 404 }
            )
          }

          // Parse FormData
          const formData = await request.formData()
          const name = formData.get('name') as string
          const type = formData.get('type') as string
          const description = formData.get('description') as string | null
          const value = formData.get('value') as string
          const document = formData.get('document') as File | null

          // Validate required fields
          if (!name || !type || !value) {
            return Response.json(
              { error: 'Missing required fields' },
              { status: 400 }
            )
          }

          // Validate asset type
          if (!Object.values(AssetType).includes(type as AssetType)) {
            return Response.json(
              { error: 'Invalid asset type' },
              { status: 400 }
            )
          }

          // Validate value is a positive number
          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue < 0) {
            return Response.json(
              { error: 'Value must be a positive number' },
              { status: 400 }
            )
          }

          let documentUrl = existingAsset.documentUrl

          // Handle document replacement
          if (document && document.size > 0) {
            // Validate file type
            const allowedTypes = ['application/pdf']

            if (!allowedTypes.includes(document.type)) {
              return Response.json(
                { error: 'Invalid file type. Allowed types: PDF' },
                { status: 400 }
              )
            }

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (document.size > maxSize) {
              return Response.json(
                { error: 'File size exceeds 10MB limit' },
                { status: 400 }
              )
            }

            // Delete old file from S3 if exists
            if (existingAsset.documentUrl) {
              try {
                const oldKey = extractKeyFromUrl(existingAsset.documentUrl)
                await deleteFileFromS3(oldKey)
              } catch (error) {
                console.error('Error deleting old file from S3:', error)
                // Continue with upload even if deletion fails
              }
            }

            // Upload new file to S3
            const key = generateS3Key(document.name, 'documents')
            await uploadFileToS3(document, key)
            documentUrl = getFileUrl(key)
          }

          // Update asset in database
          const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
              name,
              type: type as AssetType,
              description: description || null,
              value: numValue,
              documentUrl,
            },
          })

          return Response.json({
            success: true,
            asset: {
              id: asset.id,
              name: asset.name,
              type: asset.type,
              description: asset.description,
              value: asset.value,
              documentUrl: asset.documentUrl,
            },
          })
        } catch (error) {
          console.error('Error updating asset:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const id = url.pathname.split('/').pop()

          if (!id) {
            return Response.json(
              { error: 'Missing asset id' },
              { status: 400 }
            )
          }

          // Check if asset exists and belongs to user
          const asset = await prisma.asset.findFirst({
            where: {
              id: parseInt(id),
              userId: session.user.id,
            },
          })

          if (!asset) {
            return Response.json(
              { error: 'Asset not found' },
              { status: 404 }
            )
          }

          // Delete file from S3 if exists
          if (asset.documentUrl) {
            try {
              const key = extractKeyFromUrl(asset.documentUrl)
              await deleteFileFromS3(key)
            } catch (error) {
              console.error('Error deleting file from S3:', error)
              // Continue with asset deletion even if file deletion fails
            }
          }

          // Delete asset from database
          await prisma.asset.delete({
            where: { id: parseInt(id) },
          })

          return Response.json({
            success: true,
            message: 'Asset deleted successfully',
          })
        } catch (error) {
          console.error('Error deleting asset:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
    },
  },
})
