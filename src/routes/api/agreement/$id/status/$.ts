import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { AgreementStatus } from '@/generated/prisma/enums'
import { canCancelAgreement, canComplete } from '@/lib/agreement/agreement-validation'

export const Route = createFileRoute('/api/agreement/$id/status/$')({
  server: {
    handlers: {
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
          const { action, reason } = body

          if (!action) {
            return Response.json(
              { error: 'Action is required' },
              { status: 400 }
            )
          }

          // Check if agreement exists
          const agreement = await prisma.agreement.findUnique({
            where: { id: agreementId },
          })

          if (!agreement) {
            return Response.json(
              { error: 'Agreement not found' },
              { status: 404 }
            )
          }

          // Handle different actions
          switch (action) {
            case 'submit': {
              // Submit for beneficiary signatures (owner only)
              if (agreement.ownerId !== session.user.id) {
                return Response.json(
                  { error: 'Only the owner can submit the agreement' },
                  { status: 403 }
                )
              }

              if (agreement.status !== 'DRAFT') {
                return Response.json(
                  { error: 'Can only submit DRAFT agreements' },
                  { status: 400 }
                )
              }

              if (!agreement.ownerHasSigned) {
                return Response.json(
                  { error: 'Owner must sign before submitting' },
                  { status: 400 }
                )
              }

              // Verify there are beneficiaries
              const beneficiaryCount = await prisma.agreementBeneficiary.count({
                where: { agreementId },
              })

              if (beneficiaryCount === 0) {
                return Response.json(
                  { error: 'Must add at least one beneficiary before submitting' },
                  { status: 400 }
                )
              }

              // Verify there are assets
              const assetCount = await prisma.agreementAsset.count({
                where: { agreementId },
              })

              if (assetCount === 0) {
                return Response.json(
                  { error: 'Must add at least one asset before submitting' },
                  { status: 400 }
                )
              }

              const updated = await prisma.agreement.update({
                where: { id: agreementId },
                data: { status: 'PENDING_SIGNATURES' },
              })

              return Response.json({
                success: true,
                message: 'Agreement submitted for beneficiary signatures',
                agreement: {
                  id: updated.id,
                  status: updated.status,
                },
              })
            }

            case 'cancel': {
              // Cancel agreement (owner only)
              if (agreement.ownerId !== session.user.id) {
                return Response.json(
                  { error: 'Only the owner can cancel the agreement' },
                  { status: 403 }
                )
              }

              if (!canCancelAgreement(agreement.status)) {
                return Response.json(
                  { error: `Cannot cancel agreement in ${agreement.status} status` },
                  { status: 400 }
                )
              }

              const updated = await prisma.agreement.update({
                where: { id: agreementId },
                data: {
                  status: 'CANCELLED',
                },
              })

              return Response.json({
                success: true,
                message: 'Agreement cancelled successfully',
                agreement: {
                  id: updated.id,
                  status: updated.status,
                },
              })
            }

            case 'complete': {
              // Mark agreement as completed (after distribution)
              // Only owner can complete
              if (agreement.ownerId !== session.user.id) {
                return Response.json(
                  { error: 'Only the owner can mark the agreement as complete' },
                  { status: 403 }
                )
              }

              if (!canComplete(agreement.status)) {
                return Response.json(
                  { error: `Cannot complete agreement in ${agreement.status} status` },
                  { status: 400 }
                )
              }

              const updated = await prisma.agreement.update({
                where: { id: agreementId },
                data: {
                  status: 'COMPLETED',
                },
              })

              return Response.json({
                success: true,
                message: 'Agreement marked as completed',
                agreement: {
                  id: updated.id,
                  status: updated.status,
                },
              })
            }

            case 'return_to_draft': {
              // Return agreement to draft (owner only, if not yet signed by beneficiaries)
              if (agreement.ownerId !== session.user.id) {
                return Response.json(
                  { error: 'Only the owner can return the agreement to draft' },
                  { status: 403 }
                )
              }

              if (agreement.status !== 'PENDING_SIGNATURES') {
                return Response.json(
                  { error: 'Can only return PENDING_SIGNATURES agreements to draft' },
                  { status: 400 }
                )
              }

              // Check if any beneficiaries have signed
              const signedBeneficiaries = await prisma.agreementBeneficiary.count({
                where: {
                  agreementId,
                  hasSigned: true,
                },
              })

              if (signedBeneficiaries > 0) {
                return Response.json(
                  { error: 'Cannot return to draft after beneficiaries have signed' },
                  { status: 400 }
                )
              }

              const updated = await prisma.agreement.update({
                where: { id: agreementId },
                data: {
                  status: 'DRAFT',
                  ownerHasSigned: false,
                  ownerSignedAt: null,
                  ownerSignatureRef: null,
                },
              })

              return Response.json({
                success: true,
                message: 'Agreement returned to draft',
                agreement: {
                  id: updated.id,
                  status: updated.status,
                },
              })
            }

            default:
              return Response.json(
                { error: `Unknown action: ${action}` },
                { status: 400 }
              )
          }
        } catch (error) {
          console.error('Error updating agreement status:', error)
          return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        }
      },
    },
  },
})
