import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'

export const Route = createFileRoute('/api/admin/agreements/by-ic/$icNumber/$')(
  {
    server: {
      handlers: {
        OPTIONS: async () => {
          return new Response(null, { headers: corsHeaders })
        },

        GET: async ({
          request,
          params,
        }: {
          request: Request
          params: { icNumber: string }
        }) => {
          try {
            const admin = await requireAdminFromHeaders(request.headers)
            if (!admin) {
              return Response.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders },
              )
            }

            const { icNumber } = params
            if (!/^\d{12}$/.test(icNumber)) {
              return Response.json(
                { error: 'Invalid IC number format' },
                { status: 400, headers: corsHeaders },
              )
            }

            const member = await prisma.nonRegisteredFamilyMember.findUnique({
              where: { icNumber },
              select: {
                id: true,
                name: true,
              },
            })

            if (!member) {
              return Response.json(
                {
                  error:
                    'No non-registered family member found for this IC number',
                },
                { status: 404, headers: corsHeaders },
              )
            }

            const pendingBeneficiaries =
              await prisma.agreementBeneficiary.findMany({
                where: {
                  nonRegisteredFamilyMemberId: member.id,
                  hasSigned: false,
                  agreement: {
                    status: 'PENDING_SIGNATURES',
                  },
                },
                include: {
                  agreement: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                      owner: {
                        select: {
                          name: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  createdAt: 'desc',
                },
              })

            const agreements = pendingBeneficiaries.map((beneficiary) => ({
              beneficiaryId: beneficiary.id,
              agreementId: beneficiary.agreement.id,
              title: beneficiary.agreement.title,
              status: beneficiary.agreement.status,
              owner: beneficiary.agreement.owner,
              memberName: member.name,
              sharePercentage: beneficiary.sharePercentage,
              shareDescription: beneficiary.shareDescription,
            }))

            return Response.json(
              {
                agreements,
              },
              { headers: corsHeaders },
            )
          } catch (error) {
            console.error('Error fetching agreements by IC number:', error)
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
