import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { validateAssets } from '@/lib/agreement/agreement-validation'

export const Route = createFileRoute('/api/agreement/$id/assets/$')({
  server: {
    handlers: {
      // POST /api/agreement/{id}/assets - Add asset to agreement
      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { id: agreementId } = params

        try {
          const body = await request.json()
          const { assetId, allocatedValue, allocatedPercentage, notes } = body

          if (!assetId) {
            return Response.json(
              { error: 'Asset ID is required' },
              { status: 400 }
            )
          }

          // Check if agreement exists and belongs to user
          const agreement = await prisma.agreement.findFirst({
            where: {
              id: agreementId,
              ownerId: session.user.id,
            },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Can only add assets to DRAFT agreements
          if (agreement.status !== 'DRAFT') {
            return Response.json(
              { error: 'Can only add assets to DRAFT agreements' },
              { status: 403 }
            )
          }

          // Verify asset belongs to user
          const asset = await prisma.asset.findFirst({
            where: {
              id: assetId,
              userId: session.user.id,
            },
          })

          if (!asset) {
            return Response.json(
              { error: 'Asset not found or does not belong to you' },
              { status: 404 }
            )
          }

          // Check if asset is already in agreement
          const existing = await prisma.agreementAsset.findFirst({
            where: {
              agreementId,
              assetId,
            },
          })

          if (existing) {
            return Response.json(
              { error: 'Asset is already in this agreement' },
              { status: 409 }
            )
          }

          // Validate allocation
          const validation = validateAssets([
            { assetId, allocatedValue, allocatedPercentage },
          ])

          if (!validation.valid) {
            return Response.json(
              { error: 'Validation failed', details: validation.errors },
              { status: 400 }
            )
          }

          // Add asset to agreement
          const agreementAsset = await prisma.agreementAsset.create({
            data: {
              agreementId,
              assetId,
              allocatedValue: allocatedValue || null,
              allocatedPercentage: allocatedPercentage || null,
              notes: notes || null,
            },
            include: {
              asset: true,
            },
          })

          return Response.json({
            success: true,
            agreementAsset: {
              id: agreementAsset.id,
              allocatedValue: agreementAsset.allocatedValue,
              allocatedPercentage: agreementAsset.allocatedPercentage,
              notes: agreementAsset.notes,
              asset: {
                id: agreementAsset.asset.id,
                name: agreementAsset.asset.name,
                type: agreementAsset.asset.type,
                value: agreementAsset.asset.value,
              },
            },
          }, { status: 201 })
        } catch (error) {
          console.error('Error adding asset to agreement:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // PUT /api/agreement/{id}/assets - Update asset allocation
      PUT: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { id: agreementId } = params

        try {
          const body = await request.json()
          const { agreementAssetId, allocatedValue, allocatedPercentage, notes } = body

          if (!agreementAssetId) {
            return Response.json(
              { error: 'AgreementAsset ID is required' },
              { status: 400 }
            )
          }

          // Check if agreement exists and belongs to user
          const agreement = await prisma.agreement.findFirst({
            where: {
              id: agreementId,
              ownerId: session.user.id,
            },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Can only edit DRAFT agreements
          if (agreement.status !== 'DRAFT') {
            return Response.json(
              { error: 'Can only edit DRAFT agreements' },
              { status: 403 }
            )
          }

          // Check if agreementAsset exists and belongs to this agreement
          const existing = await prisma.agreementAsset.findFirst({
            where: {
              id: agreementAssetId,
              agreementId,
            },
          })

          if (!existing) {
            return Response.json(
              { error: 'AgreementAsset not found' },
              { status: 404 }
            )
          }

          // Update allocation
          const agreementAsset = await prisma.agreementAsset.update({
            where: { id: agreementAssetId },
            data: {
              allocatedValue: allocatedValue !== undefined ? allocatedValue : existing.allocatedValue,
              allocatedPercentage: allocatedPercentage !== undefined ? allocatedPercentage : existing.allocatedPercentage,
              notes: notes !== undefined ? notes : existing.notes,
            },
            include: {
              asset: true,
            },
          })

          return Response.json({
            success: true,
            agreementAsset: {
              id: agreementAsset.id,
              allocatedValue: agreementAsset.allocatedValue,
              allocatedPercentage: agreementAsset.allocatedPercentage,
              notes: agreementAsset.notes,
              asset: {
                id: agreementAsset.asset.id,
                name: agreementAsset.asset.name,
                type: agreementAsset.asset.type,
                value: agreementAsset.asset.value,
              },
            },
          })
        } catch (error) {
          console.error('Error updating agreement asset:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // DELETE /api/agreement/{id}/assets - Remove asset from agreement
      DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { id: agreementId } = params

        try {
          const url = new URL(request.url)
          const agreementAssetId = url.searchParams.get('id')

          if (!agreementAssetId) {
            return Response.json(
              { error: 'AgreementAsset ID is required' },
              { status: 400 }
            )
          }

          // Check if agreement exists and belongs to user
          const agreement = await prisma.agreement.findFirst({
            where: {
              id: agreementId,
              ownerId: session.user.id,
            },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Can only edit DRAFT agreements
          if (agreement.status !== 'DRAFT') {
            return Response.json(
              { error: 'Can only edit DRAFT agreements' },
              { status: 403 }
            )
          }

          // Check if agreementAsset exists and belongs to this agreement
          const existing = await prisma.agreementAsset.findFirst({
            where: {
              id: agreementAssetId,
              agreementId,
            },
          })

          if (!existing) {
            return Response.json(
              { error: 'AgreementAsset not found' },
              { status: 404 }
            )
          }

          // Delete asset from agreement
          await prisma.agreementAsset.delete({
            where: { id: agreementAssetId },
          })

          return Response.json({
            success: true,
            message: 'Asset removed from agreement successfully',
          })
        } catch (error) {
          console.error('Error removing asset from agreement:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // GET /api/agreement/{id}/assets - List assets in agreement
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { id: agreementId } = params

        try {
          // Check if agreement exists and belongs to user
          const agreement = await prisma.agreement.findFirst({
            where: {
              id: agreementId,
              ownerId: session.user.id,
            },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Get assets
          const agreementAssets = await prisma.agreementAsset.findMany({
            where: {
              agreementId,
            },
            include: {
              asset: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          })

          const transformed = agreementAssets.map((aa) => ({
            id: aa.id,
            allocatedValue: aa.allocatedValue,
            allocatedPercentage: aa.allocatedPercentage,
            notes: aa.notes,
            asset: {
              id: aa.asset.id,
              name: aa.asset.name,
              type: aa.asset.type,
              description: aa.asset.description,
              value: aa.asset.value,
              documentUrl: aa.asset.documentUrl,
            },
          }))

          return Response.json({ assets: transformed })
        } catch (error) {
          console.error('Error fetching agreement assets:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
    },
  },
})
