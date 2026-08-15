import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'
import { ensureAgreementMintedWithMetadata } from '@/lib/agreement/agreementMetadata'
import { reconcileAgreement } from '@/lib/agreement/agreementReconciliation'
import {
  getAgreementData,
  getExplorerUrl,
  getOnChainErrorMessage,
  getOnChainTimestampDate,
  isContractConfigured,
  recordOwnerSignature,
} from '@/lib/blockchain/contract'

export const ownerSignHandlers = {
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
      if (!isContractConfigured()) {
        return Response.json(
          {
            error:
              'On-chain signing is not configured. Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS.',
          },
          { status: 503 },
        )
      }

      // Check if agreement exists
      const agreement = await prisma.agreement.findUnique({
        where: { id: agreementId },
        include: {
          beneficiaries: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!agreement) {
        return Response.json({ error: 'Agreement not found' }, { status: 404 })
      }

      // Only owner can sign
      if (agreement.ownerId !== session.user.id) {
        return Response.json(
          { error: 'Only the agreement owner can sign' },
          { status: 403 },
        )
      }

      // Can only sign in DRAFT or PENDING_SIGNATURES status
      if (
        agreement.status !== 'DRAFT' &&
        agreement.status !== 'PENDING_SIGNATURES'
      ) {
        return Response.json(
          { error: `Cannot sign agreement in ${agreement.status} status` },
          { status: 400 },
        )
      }

      // Check if already signed
      if (agreement.ownerHasSigned) {
        return Response.json(
          { error: 'Owner has already signed this agreement' },
          { status: 400 },
        )
      }

      // Get body to check if we should also submit
      const body = await request.json()
      const { submit = false } = body

      if (agreement.beneficiaries.length === 0) {
        return Response.json(
          { error: 'Add at least one beneficiary before signing on-chain' },
          { status: 400 },
        )
      }

      const ensureMintResult = await ensureAgreementMintedWithMetadata(
        agreement.id,
        agreement.beneficiaries.map((beneficiary) => String(beneficiary.id)),
      )
      const onChainAgreement = await getAgreementData(ensureMintResult.tokenId)

      let ownerSignatureTxHash: string | null = agreement.ownerSignatureRef
      let ownerSignedAt = agreement.ownerSignedAt ?? new Date()
      let ownerSignatureExplorerUrl: string | null = null

      if (!onChainAgreement.ownerSigned) {
        const signatureResult = await recordOwnerSignature(
          ensureMintResult.tokenId,
        )
        ownerSignatureTxHash = signatureResult.txHash
        ownerSignedAt = getOnChainTimestampDate(signatureResult.timestamp)
        ownerSignatureExplorerUrl = getExplorerUrl(signatureResult.txHash)
      } else {
        ownerSignedAt = getOnChainTimestampDate(onChainAgreement.ownerSignedAt)
        if (ownerSignatureTxHash) {
          ownerSignatureExplorerUrl = getExplorerUrl(ownerSignatureTxHash)
        }
      }

      // Sign agreement
      const updatedAgreement = await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          ownerHasSigned: true,
          ownerSignedAt,
          ownerSignatureRef: ownerSignatureTxHash,
          status: submit ? 'PENDING_SIGNATURES' : agreement.status,
        },
      })

      // Auto-check: confirm DB and on-chain state agree before responding
      let reconciliation: { updatedFields: Array<string> } | null = null
      try {
        reconciliation = await reconcileAgreement(agreementId)
      } catch (reconcileError) {
        console.error(`Error reconciling agreement ${agreementId}:`, reconcileError)
      }

      return Response.json({
        success: true,
        message: submit
          ? 'Agreement signed and submitted for beneficiary signatures'
          : 'Agreement signed successfully',
        agreement: {
          id: updatedAgreement.id,
          status: updatedAgreement.status,
          ownerHasSigned: updatedAgreement.ownerHasSigned,
          ownerSignedAt: updatedAgreement.ownerSignedAt?.toISOString(),
        },
        reconciliation,
        onChain: {
          tokenId: ensureMintResult.tokenId,
          ownerSignatureTxHash,
          ownerSignatureExplorerUrl,
          mintTxHash: ensureMintResult.mintResult?.txHash || null,
          mintExplorerUrl: ensureMintResult.mintResult?.txHash
            ? getExplorerUrl(ensureMintResult.mintResult.txHash)
            : null,
        },
      })
    } catch (error) {
      console.error('Error signing agreement as owner:', error)

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

export const Route = createFileRoute('/api/agreement/$id/sign/owner/$')({
  server: {
    handlers: ownerSignHandlers,
  },
})
