import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'

export const Route = createFileRoute('/api/admin/agreements/pending-witness/$')(
  {
    server: {
      handlers: {
        OPTIONS: async () => {
          return new Response(null, { headers: corsHeaders })
        },

        GET: async ({ request }: { request: Request }) => {
          try {
            const admin = await requireAdminFromHeaders(request.headers)
            if (!admin) {
              return Response.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders },
              )
            }

            const agreements = await prisma.agreement.findMany({
              where: {
                status: 'PENDING_WITNESS',
              },
              include: {
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                beneficiaries: {
                  include: {
                    familyMember: {
                      include: {
                        familyMemberUser: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                          },
                        },
                      },
                    },
                    nonRegisteredFamilyMember: {
                      select: {
                        id: true,
                        name: true,
                        icNumber: true,
                      },
                    },
                  },
                },
                assets: {
                  include: {
                    asset: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        value: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                updatedAt: 'desc',
              },
            })

            return Response.json(
              {
                agreements,
              },
              { headers: corsHeaders },
            )
          } catch (error) {
            console.error('Error fetching pending witness agreements:', error)
            return Response.json(
              { error: 'Internal server error' },
              { status: 500, headers: corsHeaders },
            )
          }
        },
      },
    },
  },
)
