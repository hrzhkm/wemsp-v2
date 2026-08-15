import { createFileRoute } from '@tanstack/react-router'
import type { AgreementStatus} from '@/generated/prisma/enums';
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'
import { DistributionType } from '@/generated/prisma/enums'

export const Route = createFileRoute('/api/admin/agreements/$')({
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
          const status = url.searchParams.get('status') || ''
          const distributionType =
            url.searchParams.get('distributionType') || ''

          const skip = (page - 1) * limit

          // Build where clause for search and filter
          const where: any = {}

          if (search) {
            where.OR = [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
              {
                owner: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            ]
          }

          if (status) {
            where.status = status as AgreementStatus
          }

          if (distributionType) {
            where.distributionType = distributionType as DistributionType
          }

          // Get total count for pagination
          const total = await prisma.agreement.count({ where })

          // Get agreements with pagination
          const agreements = await prisma.agreement.findMany({
            where,
            skip,
            take: limit,
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              witness: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  assets: true,
                  beneficiaries: true,
                },
              },
              beneficiaries: {
                select: {
                  hasSigned: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          // Add signedBeneficiaryCount to each agreement
          const agreementsWithSignedCount = agreements.map((agreement) => ({
            ...agreement,
            signedBeneficiaryCount: agreement.beneficiaries.filter(
              (b) => b.hasSigned,
            ).length,
            beneficiaries: undefined, // Remove the beneficiaries array from response
          }))

          return Response.json(
            {
              agreements: agreementsWithSignedCount,
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
          console.error('Error fetching agreements:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          const body = await request.json()
          const {
            title,
            description,
            distributionType,
            effectiveDate,
            expiryDate,
            ownerId,
          } = body

          if (!title || !distributionType || !ownerId) {
            return Response.json(
              { error: 'Title, distribution type, and owner are required' },
              { status: 400, headers: corsHeaders },
            )
          }

          if (
            !Object.values(DistributionType).includes(
              distributionType as DistributionType,
            )
          ) {
            return Response.json(
              { error: 'Invalid distribution type' },
              { status: 400, headers: corsHeaders },
            )
          }

          const owner = await prisma.user.findUnique({ where: { id: ownerId } })
          if (!owner) {
            return Response.json(
              { error: 'Owner not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          const parsedEffectiveDate = effectiveDate
            ? new Date(effectiveDate)
            : null
          const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null

          if (
            parsedEffectiveDate &&
            Number.isNaN(parsedEffectiveDate.getTime())
          ) {
            return Response.json(
              { error: 'Invalid effective date' },
              { status: 400, headers: corsHeaders },
            )
          }

          if (parsedExpiryDate && Number.isNaN(parsedExpiryDate.getTime())) {
            return Response.json(
              { error: 'Invalid expiry date' },
              { status: 400, headers: corsHeaders },
            )
          }

          if (
            parsedEffectiveDate &&
            parsedExpiryDate &&
            parsedExpiryDate < parsedEffectiveDate
          ) {
            return Response.json(
              { error: 'Expiry date cannot be earlier than effective date' },
              { status: 400, headers: corsHeaders },
            )
          }

          const agreement = await prisma.agreement.create({
            data: {
              title,
              description: description || null,
              distributionType: distributionType as DistributionType,
              ownerId,
              effectiveDate: parsedEffectiveDate,
              expiryDate: parsedExpiryDate,
            },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              witness: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  assets: true,
                  beneficiaries: true,
                },
              },
            },
          })

          return Response.json(
            { success: true, agreement },
            { status: 201, headers: corsHeaders },
          )
        } catch (error) {
          console.error('Error creating agreement:', error)
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
              { error: 'Missing agreement id' },
              { status: 400, headers: corsHeaders },
            )
          }

          // Check if agreement exists
          const agreement = await prisma.agreement.findUnique({
            where: { id },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404, headers: corsHeaders },
            )
          }

          // Delete agreement (cascade will handle related records)
          await prisma.agreement.delete({
            where: { id },
          })

          return Response.json(
            {
              success: true,
              message: 'Agreement deleted successfully',
            },
            { headers: corsHeaders },
          )
        } catch (error) {
          console.error('Error deleting agreement:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  },
})
