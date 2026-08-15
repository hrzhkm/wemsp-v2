import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { sendFinalizedAgreementDocument } from '@/lib/agreement/agreementDelivery'
import { reconcileAgreement } from '@/lib/agreement/agreementReconciliation'
import { ensureAgreementMintedWithMetadata } from '@/lib/agreement/agreementMetadata'
import {
  finalizeAgreement,
  getAgreementData,
  getBeneficiarySignatureStatus,
  getExplorerUrl,
  getOnChainErrorMessage,
  getOnChainTimestampDate,
  isAgreementFullySigned,
  isContractConfigured,
  recordBeneficiarySignature,
  recordOwnerSignature,
  recordWitnessSignature,
} from '@/lib/blockchain/contract'

export const witnessSignHandlers = {
  POST: async ({
    request,
    params,
  }: {
    request: Request
    params: { id: string }
  }) => {
    const adminSession = await requireAdminFromHeaders(request.headers)

    if (!adminSession) {
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
              hasSigned: true,
            },
          },
        },
      })

      if (!agreement) {
        return Response.json({ error: 'Agreement not found' }, { status: 404 })
      }

      // Can only witness in PENDING_WITNESS status
      if (agreement.status !== 'PENDING_WITNESS') {
        return Response.json(
          { error: `Cannot witness agreement in ${agreement.status} status` },
          { status: 400 },
        )
      }

      // Check if already witnessed
      if (agreement.witnessedAt) {
        return Response.json(
          { error: 'Agreement has already been witnessed' },
          { status: 400 },
        )
      }

      const ensureMintResult = await ensureAgreementMintedWithMetadata(
        agreement.id,
        agreement.beneficiaries.map((beneficiary) => String(beneficiary.id)),
      )
      const tokenId = ensureMintResult.tokenId
      const onChainAgreement = await getAgreementData(tokenId)

      if (agreement.ownerHasSigned && !onChainAgreement.ownerSigned) {
        await recordOwnerSignature(tokenId)
      }

      for (const beneficiary of agreement.beneficiaries) {
        if (!beneficiary.hasSigned) {
          continue
        }
        const beneficiaryId = String(beneficiary.id)
        const beneficiaryStatus = await getBeneficiarySignatureStatus(
          tokenId,
          beneficiaryId,
        )
        if (!beneficiaryStatus.hasSigned) {
          await recordBeneficiarySignature(tokenId, beneficiaryId)
        }
      }

      let witnessTxHash: string | null = null
      let witnessedAt = onChainAgreement.witnessedAt
        ? getOnChainTimestampDate(onChainAgreement.witnessedAt)
        : new Date()

      if (!onChainAgreement.witnessSigned) {
        const witnessSignatureResult = await recordWitnessSignature(tokenId)
        witnessTxHash = witnessSignatureResult.txHash
        witnessedAt = getOnChainTimestampDate(witnessSignatureResult.timestamp)
      }

      let finalizeTxHash: string | null = null
      const fullySigned = await isAgreementFullySigned(tokenId)
      if (fullySigned) {
        try {
          const finalizeResult = await finalizeAgreement(tokenId)
          finalizeTxHash = finalizeResult.txHash
        } catch (finalizeError) {
          const errorMessage = getOnChainErrorMessage(finalizeError)
          if (!errorMessage.includes('AgreementAlreadyFinalized')) {
            throw finalizeError
          }
        }
      }

      // Witness agreement
      const updatedAgreement = await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          witnessId: adminSession.id,
          witnessedAt,
          status: 'ACTIVE',
        },
      })

      // Best-effort document delivery to owner + registered beneficiaries
      let documentDelivery: {
        recipients: Array<string>
        deliveredTo: Array<string>
      } | null = null
      try {
        documentDelivery = await sendFinalizedAgreementDocument(agreementId)
      } catch (deliveryError) {
        console.error(
          `Error sending agreement document for ${agreementId}:`,
          deliveryError,
        )
      }

      // Auto-check: confirm DB and on-chain state agree before responding
      let reconciliation: { updatedFields: Array<string> } | null = null
      try {
        reconciliation = await reconcileAgreement(agreementId)
      } catch (reconcileError) {
        console.error(
          `Error reconciling agreement ${agreementId}:`,
          reconcileError,
        )
      }

      return Response.json({
        success: true,
        message: 'Agreement witnessed successfully',
        agreement: {
          id: updatedAgreement.id,
          status: updatedAgreement.status,
          witnessId: updatedAgreement.witnessId,
          witnessedAt: updatedAgreement.witnessedAt?.toISOString(),
        },
        documentDelivery,
        reconciliation,
        onChain: {
          tokenId,
          witnessSignatureTxHash: witnessTxHash,
          witnessSignatureExplorerUrl: witnessTxHash
            ? getExplorerUrl(witnessTxHash)
            : null,
          finalizeTxHash,
          finalizeExplorerUrl: finalizeTxHash
            ? getExplorerUrl(finalizeTxHash)
            : null,
          mintTxHash: ensureMintResult.mintResult?.txHash || null,
          mintExplorerUrl: ensureMintResult.mintResult?.txHash
            ? getExplorerUrl(ensureMintResult.mintResult.txHash)
            : null,
        },
      })
    } catch (error) {
      console.error('Error witnessing agreement:', error)

      const onChainMessage = getOnChainErrorMessage(error)
      if (onChainMessage) {
        return Response.json(
          { error: `On-chain witness signature failed: ${onChainMessage}` },
          { status: 500 },
        )
      }

      return Response.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
}

export const Route = createFileRoute('/api/agreement/$id/sign/witness/$')({
  server: {
    handlers: witnessSignHandlers,
  },
})
