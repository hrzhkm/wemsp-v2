import { prisma } from '@/db'
import {
  getAgreementData,
  getBeneficiarySignatureStatus,
  getContractAddress,
  getOnChainTimestampDate,
  getTokenIdByAgreementId,
  getTokenURI,
} from '@/lib/blockchain/contract'

export interface ReconciliationResult {
  agreementId: string
  tokenId: number | null
  updatedFields: Array<string>
}

/**
 * Repair DB/on-chain drift for one agreement by gap-filling from the contract:
 * - missing tokenId / contractAddress / metadataUri
 * - signature flags + timestamps the contract has but the DB does not
 * - status ACTIVE when the contract is finalized but the DB is still
 *   PENDING_WITNESS
 *
 * Conservative: it only fills missing/obviously-stale fields and never
 * downgrades or cancels anything.
 */
export async function reconcileAgreement(
  agreementId: string,
): Promise<ReconciliationResult> {
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
    throw new Error('Agreement not found')
  }

  const tokenId = await getTokenIdByAgreementId(agreementId)
  if (tokenId === 0) {
    return { agreementId, tokenId: agreement.tokenId ?? null, updatedFields: [] }
  }

  const updatedFields: Array<string> = []
  const data: Record<string, unknown> = {}

  if (agreement.tokenId !== tokenId) {
    data.tokenId = tokenId
    updatedFields.push('tokenId')
  }
  if (!agreement.contractAddress) {
    data.contractAddress = getContractAddress()
    updatedFields.push('contractAddress')
  }
  if (!agreement.metadataUri) {
    const metadataUri = await getTokenURI(tokenId).catch(() => null)
    if (metadataUri) {
      data.metadataUri = metadataUri
      updatedFields.push('metadataUri')
    }
  }

  const onChain = await getAgreementData(tokenId)

  if (onChain.ownerSigned && !agreement.ownerHasSigned) {
    data.ownerHasSigned = true
    data.ownerSignedAt = getOnChainTimestampDate(onChain.ownerSignedAt)
    updatedFields.push('ownerSignedAt')
  }

  if (onChain.witnessSigned && !agreement.witnessedAt) {
    data.witnessedAt = getOnChainTimestampDate(onChain.witnessedAt)
    updatedFields.push('witnessedAt')
  }

  if (onChain.isFinalized && agreement.status === 'PENDING_WITNESS') {
    data.status = 'ACTIVE'
    updatedFields.push('status')
  }

  if (Object.keys(data).length > 0) {
    await prisma.agreement.update({ where: { id: agreementId }, data })
  }

  for (const beneficiary of agreement.beneficiaries) {
    if (beneficiary.hasSigned) {
      continue
    }
    const status = await getBeneficiarySignatureStatus(tokenId, beneficiary.id)
    if (!status.hasSigned) {
      continue
    }
    await prisma.agreementBeneficiary.update({
      where: { id: beneficiary.id },
      data: {
        hasSigned: true,
        signedAt: getOnChainTimestampDate(status.signedAt),
        isAccepted: true,
      },
    })
    updatedFields.push(`beneficiary:${beneficiary.id}`)
  }

  return { agreementId, tokenId, updatedFields }
}
