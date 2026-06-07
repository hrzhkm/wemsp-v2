import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/middleware'
import { corsHeaders } from '@/lib/cors'

export const Route = createFileRoute('/api/admin/agreements/$id/$')({
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
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          const url = new URL(request.url)
          const id = url.pathname.split('/').slice(-1)[0]

          if (!id) {
            return Response.json({ error: 'Missing agreement id' }, { status: 400, headers: corsHeaders })
          }

          // Fetch agreement with full details
          const agreement = await prisma.agreement.findUnique({
            where: { id },
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
              beneficiaries: {
                include: {
                  familyMember: {
                    include: {
                      familyMemberUser: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                  nonRegisteredFamilyMember: {
                    select: {
                      name: true,
                      relation: true,
                    },
                  },
                },
              },
            },
          })

          if (!agreement) {
            return Response.json({ error: 'Agreement not found' }, { status: 404, headers: corsHeaders })
          }

          return Response.json({
            agreement,
          }, { headers: corsHeaders })
        } catch (error) {
          console.error('Error fetching agreement:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  },
})
