import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { ensureAgreementMintedWithMetadata } from '@/lib/agreement/agreementMetadata'
import {
  getAgreementData,
  getBeneficiarySignatureStatus,
  getExplorerUrl,
  getOnChainErrorMessage,
  getOnChainTimestampDate,
  isContractConfigured,
  recordBeneficiarySignature,
  recordOwnerSignature,
} from '@/lib/blockchain/contract'

export const beneficiarySignHandlers = {
  POST: async ({
    request,
    params,
  }: {
    request: Request
    params: { id: string }
  }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id: agreementId } = params

    try {
      const body = await request.json()
      const { beneficiaryId, accept = true, rejectionReason } = body

      if (!beneficiaryId) {
        return Response.json(
          { error: 'Beneficiary ID is required' },
          { status: 400 },
        )
      }

      // Check if agreement exists
      const agreement = await prisma.agreement.findUnique({
        where: { id: agreementId },
        include: {
          beneficiaries: true,
        },
      })

      if (!agreement) {
        return Response.json({ error: 'Agreement not found' }, { status: 404 })
      }

      // Can only sign in PENDING_SIGNATURES status
      if (agreement.status !== 'PENDING_SIGNATURES') {
        return Response.json(
          { error: `Cannot sign agreement in ${agreement.status} status` },
          { status: 400 },
        )
      }

      // Find beneficiary
      const beneficiary = agreement.beneficiaries.find(
        (b) => b.id === beneficiaryId,
      )

      if (!beneficiary) {
        return Response.json(
          { error: 'Beneficiary not found in this agreement' },
          { status: 404 },
        )
      }

      // Check if user is this beneficiary
      let isThisUserBeneficiary = false

      if (beneficiary.familyMemberId) {
        // Check if user is the registered family member
        const familyMember = await prisma.familyMember.findUnique({
          where: { id: beneficiary.familyMemberId },
        })

        if (familyMember?.familyMemberUserId === session.user.id) {
          isThisUserBeneficiary = true
        }
      } else if (beneficiary.nonRegisteredFamilyMemberId) {
        // Non-registered members can't sign directly
        // They would need to verify their identity first
        // For now, we'll allow the owner to sign on their behalf
        if (agreement.ownerId === session.user.id) {
          isThisUserBeneficiary = true
        }
      }

      if (!isThisUserBeneficiary) {
        return Response.json(
          { error: 'You are not authorized to sign as this beneficiary' },
          { status: 403 },
        )
      }

      if (accept && !isContractConfigured()) {
        return Response.json(
          {
            error:
              'On-chain signing is not configured. Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.',
          },
          { status: 503 },
        )
      }

      // Check if already signed
      if (beneficiary.hasSigned) {
        return Response.json(
          { error: 'This beneficiary has already signed' },
          { status: 400 },
        )
      }

      let onChain: {
        tokenId: number
        beneficiarySignatureTxHash: string | null
        beneficiarySignatureExplorerUrl: string | null
        mintTxHash: string | null
        mintExplorerUrl: string | null
      } | null = null

      let signedAt = accept ? new Date() : null
      let signatureRef: string | null = beneficiary.signatureRef

      if (accept) {
        const ensureMintResult = await ensureAgreementMintedWithMetadata(
          agreement.id,
          agreement.beneficiaries.map((b) => String(b.id)),
        )
        const tokenId = ensureMintResult.tokenId
        const onChainAgreement = await getAgreementData(tokenId)

        if (agreement.ownerHasSigned && !onChainAgreement.ownerSigned) {
          await recordOwnerSignature(tokenId)
        }

        const beneficiarySignatureStatus = await getBeneficiarySignatureStatus(
          tokenId,
          String(beneficiaryId),
        )
        if (beneficiarySignatureStatus.hasSigned) {
          signedAt = getOnChainTimestampDate(
            beneficiarySignatureStatus.signedAt,
          )
        } else {
          const signatureResult = await recordBeneficiarySignature(
            tokenId,
            String(beneficiaryId),
          )
          signedAt = getOnChainTimestampDate(signatureResult.timestamp)
          signatureRef = signatureResult.txHash
        }

        onChain = {
          tokenId,
          beneficiarySignatureTxHash: signatureRef,
          beneficiarySignatureExplorerUrl: signatureRef
            ? getExplorerUrl(signatureRef)
            : null,
          mintTxHash: ensureMintResult.mintResult?.txHash || null,
          mintExplorerUrl: ensureMintResult.mintResult?.txHash
            ? getExplorerUrl(ensureMintResult.mintResult.txHash)
            : null,
        }
      }

      // Update beneficiary signature
      const updatedBeneficiary = await prisma.agreementBeneficiary.update({
        where: { id: beneficiaryId },
        data: {
          hasSigned: accept,
          signedAt,
          signatureRef: accept ? signatureRef : null,
          isAccepted: accept ? true : false,
          rejectionReason: accept ? null : rejectionReason,
        },
      })

      // Check if all beneficiaries have signed
      const allBeneficiaries = await prisma.agreementBeneficiary.findMany({
        where: { agreementId },
      })

      const allSigned = allBeneficiaries.every(
        (b) => b.hasSigned && b.isAccepted !== false,
      )

      const newStatus = allSigned ? 'PENDING_WITNESS' : agreement.status

      if (allSigned) {
        await prisma.agreement.update({
          where: { id: agreementId },
          data: { status: newStatus },
        })
      }

      return Response.json({
        success: true,
        message: accept
          ? 'Beneficiary signed successfully'
          : 'Beneficiary rejected the agreement',
        beneficiary: {
          id: updatedBeneficiary.id,
          hasSigned: updatedBeneficiary.hasSigned,
          signedAt: updatedBeneficiary.signedAt?.toISOString(),
          isAccepted: updatedBeneficiary.isAccepted,
        },
        agreementStatus: newStatus,
        onChain,
      })
    } catch (error) {
      console.error('Error signing agreement as beneficiary:', error)

      const onChainMessage = getOnChainErrorMessage(error)
      if (onChainMessage) {
        return Response.json(
          { error: `On-chain signature failed: ${onChainMessage}` },
          { status: 500 },
        )
      }

      return Response.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
}

export const Route = createFileRoute('/api/agreement/$id/sign/beneficiary/$')({
  server: {
    handlers: beneficiarySignHandlers,
  },
})
