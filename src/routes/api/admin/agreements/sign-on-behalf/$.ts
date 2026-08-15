import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'
import {
  ensureAgreementMinted,
  getAgreementData,
  getBeneficiarySignatureStatus,
  getExplorerUrl,
  getOnChainErrorMessage,
  getOnChainTimestampDate,
  isContractConfigured,
  recordBeneficiarySignature,
  recordOwnerSignature,
} from '@/lib/blockchain/contract'

export const Route = createFileRoute('/api/admin/agreements/sign-on-behalf/$')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { headers: corsHeaders })
      },

      POST: async ({ request }: { request: Request }) => {
        try {
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
          }

          if (!isContractConfigured()) {
            return Response.json(
              { error: 'On-chain signing is not configured. Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.' },
              { status: 503, headers: corsHeaders }
            )
          }

          const body = await request.json()
          const { beneficiaryId, adminNotes } = body as {
            beneficiaryId?: string
            adminNotes?: string
          }

          if (!beneficiaryId) {
            return Response.json(
              { error: 'Beneficiary ID is required' },
              { status: 400, headers: corsHeaders }
            )
          }

          const beneficiary = await prisma.agreementBeneficiary.findUnique({
            where: { id: beneficiaryId },
            include: {
              agreement: {
                include: {
                  beneficiaries: {
                    select: {
                      id: true,
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
          })

          if (!beneficiary) {
            return Response.json(
              { error: 'Beneficiary not found' },
              { status: 404, headers: corsHeaders }
            )
          }

          if (!beneficiary.nonRegisteredFamilyMemberId) {
            return Response.json(
              { error: 'Only non-registered family members can be signed by admin proxy' },
              { status: 400, headers: corsHeaders }
            )
          }

          if (beneficiary.hasSigned) {
            return Response.json(
              { error: 'Beneficiary has already signed' },
              { status: 400, headers: corsHeaders }
            )
          }

          const agreement = beneficiary.agreement
          if (agreement.status !== 'PENDING_SIGNATURES') {
            return Response.json(
              { error: `Cannot sign beneficiary in ${agreement.status} status` },
              { status: 400, headers: corsHeaders }
            )
          }

          const ensureMintResult = await ensureAgreementMinted(
            agreement.id,
            agreement.beneficiaries.map((b) => b.id)
          )
          const tokenId = ensureMintResult.tokenId
          const onChainAgreement = await getAgreementData(tokenId)

          if (agreement.ownerHasSigned && !onChainAgreement.ownerSigned) {
            await recordOwnerSignature(tokenId)
          }

          const onChainSignatureStatus = await getBeneficiarySignatureStatus(tokenId, beneficiary.id)

          let beneficiaryTxHash: string | null = beneficiary.signatureRef
          let signedAt = new Date()

          if (onChainSignatureStatus.hasSigned) {
            signedAt = getOnChainTimestampDate(onChainSignatureStatus.signedAt)
          } else {
            const signatureResult = await recordBeneficiarySignature(tokenId, beneficiary.id)
            beneficiaryTxHash = signatureResult.txHash
            signedAt = getOnChainTimestampDate(signatureResult.timestamp)
          }

          await prisma.agreementBeneficiary.update({
            where: { id: beneficiary.id },
            data: {
              hasSigned: true,
              signedAt,
              signatureRef: beneficiaryTxHash,
              isAccepted: true,
              rejectionReason: null,
              adminSignedById: admin.id,
              adminNotes: adminNotes || null,
            },
          })

          const allBeneficiaries = await prisma.agreementBeneficiary.findMany({
            where: { agreementId: agreement.id },
          })
          const allSigned = allBeneficiaries.every((b) => b.hasSigned && b.isAccepted !== false)
          const nextStatus = allSigned ? 'PENDING_WITNESS' : agreement.status

          if (allSigned) {
            await prisma.agreement.update({
              where: { id: agreement.id },
              data: {
                status: 'PENDING_WITNESS',
              },
            })
          }

          return Response.json(
            {
              success: true,
              message: 'Beneficiary signed successfully by admin proxy',
              agreementStatus: nextStatus,
              onChain: {
                tokenId,
                beneficiarySignatureTxHash: beneficiaryTxHash,
                beneficiarySignatureExplorerUrl: beneficiaryTxHash
                  ? getExplorerUrl(beneficiaryTxHash)
                  : null,
                mintTxHash: ensureMintResult.mintResult?.txHash || null,
                mintExplorerUrl: ensureMintResult.mintResult?.txHash
                  ? getExplorerUrl(ensureMintResult.mintResult.txHash)
                  : null,
              },
            },
            { headers: corsHeaders }
          )
        } catch (error) {
          console.error('Error signing beneficiary on behalf:', error)

          const onChainMessage = getOnChainErrorMessage(error)
          if (onChainMessage) {
            return Response.json(
              { error: `On-chain signature failed: ${onChainMessage}` },
              { status: 500, headers: corsHeaders }
            )
          }

          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
          )
        }
      },
    },
  },
})
