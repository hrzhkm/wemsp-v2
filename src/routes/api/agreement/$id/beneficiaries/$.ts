import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { validateBeneficiaries } from '@/lib/agreement/agreement-validation'

export const Route = createFileRoute('/api/agreement/$id/beneficiaries/$')({
  server: {
    handlers: {
      // GET /api/agreement/{id}/beneficiaries - List beneficiaries
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

          // Get beneficiaries
          const beneficiaries = await prisma.agreementBeneficiary.findMany({
            where: {
              agreementId,
            },
            include: {
              familyMember: {
                include: {
                  familyMemberUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      image: true,
                    },
                  },
                },
              },
              nonRegisteredFamilyMember: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          })

          const transformed = beneficiaries.map((ab) => ({
            id: ab.id,
            sharePercentage: ab.sharePercentage,
            shareDescription: ab.shareDescription,
            hasSigned: ab.hasSigned,
            signedAt: ab.signedAt?.toISOString(),
            isAccepted: ab.isAccepted,
            rejectionReason: ab.rejectionReason,
            familyMember: ab.familyMember
              ? {
                  id: ab.familyMember.id,
                  relation: ab.familyMember.relation,
                  user: {
                    id: ab.familyMember.familyMemberUser.id,
                    name: ab.familyMember.familyMemberUser.name,
                    email: ab.familyMember.familyMemberUser.email,
                    image: ab.familyMember.familyMemberUser.image,
                  },
                }
              : null,
            nonRegisteredFamilyMember: ab.nonRegisteredFamilyMember
              ? {
                  id: ab.nonRegisteredFamilyMember.id,
                  name: ab.nonRegisteredFamilyMember.name,
                  icNumber: ab.nonRegisteredFamilyMember.icNumber,
                  relation: ab.nonRegisteredFamilyMember.relation,
                  phoneNumber: ab.nonRegisteredFamilyMember.phoneNumber,
                  address: ab.nonRegisteredFamilyMember.address,
                }
              : null,
          }))

          return Response.json({ beneficiaries: transformed })
        } catch (error) {
          console.error('Error fetching beneficiaries:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // POST /api/agreement/{id}/beneficiaries - Add beneficiary
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
          const {
            familyMemberId,
            nonRegisteredFamilyMemberId,
            sharePercentage,
            shareDescription,
          } = body

          if (!familyMemberId && !nonRegisteredFamilyMemberId) {
            return Response.json(
              { error: 'Must specify either familyMemberId or nonRegisteredFamilyMemberId' },
              { status: 400 }
            )
          }

          if (familyMemberId && nonRegisteredFamilyMemberId) {
            return Response.json(
              { error: 'Cannot specify both familyMemberId and nonRegisteredFamilyMemberId' },
              { status: 400 }
            )
          }

          if (!sharePercentage || sharePercentage <= 0 || sharePercentage > 100) {
            return Response.json(
              { error: 'Share percentage must be between 0 and 100' },
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

          // Can only add beneficiaries to DRAFT agreements
          if (agreement.status !== 'DRAFT') {
            return Response.json(
              { error: 'Can only add beneficiaries to DRAFT agreements' },
              { status: 403 }
            )
          }

          let relation: string | undefined

          // Verify family member belongs to user's family
          if (familyMemberId) {
            const familyMember = await prisma.familyMember.findFirst({
              where: {
                id: familyMemberId,
                userId: session.user.id,
              },
            })

            if (!familyMember) {
              return Response.json(
                { error: 'Family member not found in your family' },
                { status: 404 }
              )
            }

            relation = familyMember.relation
          } else if (nonRegisteredFamilyMemberId) {
            const nonRegMember = await prisma.nonRegisteredFamilyMember.findFirst({
              where: {
                id: nonRegisteredFamilyMemberId,
                userId: session.user.id,
              },
            })

            if (!nonRegMember) {
              return Response.json(
                { error: 'Non-registered family member not found' },
                { status: 404 }
              )
            }

            relation = nonRegMember.relation
          }

          // Create beneficiary
          const beneficiary = await prisma.agreementBeneficiary.create({
            data: {
              agreementId,
              familyMemberId: familyMemberId || null,
              nonRegisteredFamilyMemberId: nonRegisteredFamilyMemberId || null,
              sharePercentage,
              shareDescription: shareDescription || null,
            },
            include: {
              familyMember: {
                include: {
                  familyMemberUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      image: true,
                    },
                  },
                },
              },
              nonRegisteredFamilyMember: true,
            },
          })

          // Validate total shares after adding
          const allBeneficiaries = await prisma.agreementBeneficiary.findMany({
            where: { agreementId },
          })

          const validation = validateBeneficiaries(
            allBeneficiaries.map((ab) => ({
              familyMemberId: ab.familyMemberId || undefined,
              nonRegisteredFamilyMemberId: ab.nonRegisteredFamilyMemberId || undefined,
              relation: (ab.familyMember?.relation || ab.nonRegisteredFamilyMember?.relation) || '',
              sharePercentage: ab.sharePercentage,
            })),
            agreement.distributionType
          )

          if (!validation.valid) {
            // Rollback by deleting the newly created beneficiary
            await prisma.agreementBeneficiary.delete({
              where: { id: beneficiary.id },
            })

            return Response.json(
              { error: 'Share validation failed', details: validation.errors },
              { status: 400 }
            )
          }

          return Response.json({
            success: true,
            beneficiary: {
              id: beneficiary.id,
              sharePercentage: beneficiary.sharePercentage,
              shareDescription: beneficiary.shareDescription,
              familyMember: beneficiary.familyMember
                ? {
                    id: beneficiary.familyMember.id,
                    relation: beneficiary.familyMember.relation,
                    user: {
                      id: beneficiary.familyMember.familyMemberUser.id,
                      name: beneficiary.familyMember.familyMemberUser.name,
                      email: beneficiary.familyMember.familyMemberUser.email,
                      image: beneficiary.familyMember.familyMemberUser.image,
                    },
                  }
                : null,
              nonRegisteredFamilyMember: beneficiary.nonRegisteredFamilyMember
                ? {
                    id: beneficiary.nonRegisteredFamilyMember.id,
                    name: beneficiary.nonRegisteredFamilyMember.name,
                    icNumber: beneficiary.nonRegisteredFamilyMember.icNumber,
                    relation: beneficiary.nonRegisteredFamilyMember.relation,
                  }
                : null,
            },
          }, { status: 201 })
        } catch (error) {
          console.error('Error adding beneficiary:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // PUT /api/agreement/{id}/beneficiaries - Update beneficiary
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
          const { beneficiaryId, sharePercentage, shareDescription } = body

          if (!beneficiaryId) {
            return Response.json(
              { error: 'Beneficiary ID is required' },
              { status: 400 }
            )
          }

          if (sharePercentage !== undefined && (sharePercentage <= 0 || sharePercentage > 100)) {
            return Response.json(
              { error: 'Share percentage must be between 0 and 100' },
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

          // Check if beneficiary exists and belongs to this agreement
          const existing = await prisma.agreementBeneficiary.findFirst({
            where: {
              id: beneficiaryId,
              agreementId,
            },
          })

          if (!existing) {
            return Response.json(
              { error: 'Beneficiary not found' },
              { status: 404 }
            )
          }

          // Update beneficiary
          const beneficiary = await prisma.agreementBeneficiary.update({
            where: { id: beneficiaryId },
            data: {
              sharePercentage: sharePercentage ?? existing.sharePercentage,
              shareDescription: shareDescription !== undefined ? shareDescription : existing.shareDescription,
            },
          })

          // Validate total shares after updating
          const allBeneficiaries = await prisma.agreementBeneficiary.findMany({
            where: { agreementId },
          })

          const validation = validateBeneficiaries(
            allBeneficiaries.map((ab) => ({
              familyMemberId: ab.familyMemberId || undefined,
              nonRegisteredFamilyMemberId: ab.nonRegisteredFamilyMemberId || undefined,
              relation: (ab.familyMember?.relation || ab.nonRegisteredFamilyMember?.relation) || '',
              sharePercentage: ab.sharePercentage,
            })),
            agreement.distributionType
          )

          if (!validation.valid) {
            // Rollback
            await prisma.agreementBeneficiary.update({
              where: { id: beneficiaryId },
              data: {
                sharePercentage: existing.sharePercentage,
                shareDescription: existing.shareDescription,
              },
            })

            return Response.json(
              { error: 'Share validation failed', details: validation.errors },
              { status: 400 }
            )
          }

          return Response.json({
            success: true,
            beneficiary: {
              id: beneficiary.id,
              sharePercentage: beneficiary.sharePercentage,
              shareDescription: beneficiary.shareDescription,
            },
          })
        } catch (error) {
          console.error('Error updating beneficiary:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },

      // DELETE /api/agreement/{id}/beneficiaries - Remove beneficiary
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
          const beneficiaryId = url.searchParams.get('id')

          if (!beneficiaryId) {
            return Response.json(
              { error: 'Beneficiary ID is required' },
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

          // Check if beneficiary exists and belongs to this agreement
          const existing = await prisma.agreementBeneficiary.findFirst({
            where: {
              id: beneficiaryId,
              agreementId,
            },
          })

          if (!existing) {
            return Response.json(
              { error: 'Beneficiary not found' },
              { status: 404 }
            )
          }

          // Delete beneficiary
          await prisma.agreementBeneficiary.delete({
            where: { id: beneficiaryId },
          })

          return Response.json({
            success: true,
            message: 'Beneficiary removed successfully',
          })
        } catch (error) {
          console.error('Error removing beneficiary:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
    },
  },
})
