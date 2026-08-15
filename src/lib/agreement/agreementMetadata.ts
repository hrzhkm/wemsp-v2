import type { EnsureMintedResult } from '@/lib/blockchain/contract'
import type { IpfsEncryptionEnvelope } from '@/lib/storage/ipfsEncryption'
import { prisma } from '@/db'
import {
  ensureAgreementMinted,
  getContractAddress,
} from '@/lib/blockchain/contract'
import {
  encryptForIpfs,
  getIpfsEncryptionKeyFromEnv,
} from '@/lib/storage/ipfsEncryption'
import { uploadEncryptedJsonToIpfs } from '@/lib/storage/ipfs'

const METADATA_SCHEMA = 'wemsp.agreement.metadata'
const METADATA_VERSION = 1

interface AgreementMetadataAsset {
  assetId: number
}

interface AgreementMetadataBeneficiary {
  id: string
}

interface AgreementMetadataSource {
  id: string
  distributionType: string
  status: string
  ownerId: string
  metadataUri: string | null
  tokenId?: number | null
  createdAt: Date
  updatedAt: Date
  assets: Array<AgreementMetadataAsset>
  beneficiaries: Array<AgreementMetadataBeneficiary>
}

export interface AgreementMetadataPayload {
  schema: typeof METADATA_SCHEMA
  version: typeof METADATA_VERSION
  agreementId: string
  distributionType: string
  status: string
  ownerId: string
  assetIds: Array<number>
  beneficiaryIds: Array<string>
  beneficiaryCount: number
  createdAt: string
  updatedAt: string
}

export interface AgreementMetadataUriResult {
  metadataUri: string
  cid: string | null
  encryptedEnvelope: IpfsEncryptionEnvelope | null
}

export interface EnsureAgreementMintedWithMetadataResult extends EnsureMintedResult {
  metadataUri: string
}

function toIsoString(value: Date): string {
  return value.toISOString()
}

async function getAgreementForMetadata(
  agreementId: string,
): Promise<AgreementMetadataSource> {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: {
      assets: {
        select: {
          assetId: true,
        },
      },
      beneficiaries: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!agreement) {
    throw new Error('Agreement not found')
  }

  return agreement
}

export function buildAgreementMetadataPayload(
  agreement: AgreementMetadataSource,
): AgreementMetadataPayload {
  const beneficiaryIds = agreement.beneficiaries.map(
    (beneficiary) => beneficiary.id,
  )

  return {
    schema: METADATA_SCHEMA,
    version: METADATA_VERSION,
    agreementId: agreement.id,
    distributionType: agreement.distributionType,
    status: agreement.status,
    ownerId: agreement.ownerId,
    assetIds: agreement.assets.map((asset) => asset.assetId),
    beneficiaryIds,
    beneficiaryCount: beneficiaryIds.length,
    createdAt: toIsoString(agreement.createdAt),
    updatedAt: toIsoString(agreement.updatedAt),
  }
}

export async function ensureAgreementMetadataUri(
  agreementId: string,
): Promise<AgreementMetadataUriResult> {
  const agreement = await getAgreementForMetadata(agreementId)
  if (agreement.metadataUri) {
    return {
      metadataUri: agreement.metadataUri,
      cid: null,
      encryptedEnvelope: null,
    }
  }

  if (agreement.tokenId != null) {
    throw new Error(
      'Agreement is already minted without a stored metadata URI; cannot safely replace on-chain metadata',
    )
  }

  try {
    const payload = buildAgreementMetadataPayload(agreement)
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
    const encryptedEnvelope = encryptForIpfs(plaintext, {
      key: getIpfsEncryptionKeyFromEnv(),
      contentType: 'application/json',
    })
    const upload = await uploadEncryptedJsonToIpfs(encryptedEnvelope, {
      name: `${agreement.id}.agreement.enc.json`,
    })

    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { metadataUri: upload.uri },
    })

    return {
      metadataUri: upload.uri,
      cid: upload.cid,
      encryptedEnvelope,
    }
  } catch (error) {
    throw new Error('Failed to prepare encrypted agreement metadata', {
      cause: error,
    })
  }
}

export async function ensureAgreementMintedWithMetadata(
  agreementId: string,
  beneficiaryIds: Array<string>,
): Promise<EnsureAgreementMintedWithMetadataResult> {
  const { metadataUri } = await ensureAgreementMetadataUri(agreementId)
  const mintResult = await ensureAgreementMinted(
    agreementId,
    beneficiaryIds,
    metadataUri,
  )

  await prisma.agreement.update({
    where: { id: agreementId },
    data: {
      tokenId: mintResult.tokenId,
      contractAddress: getContractAddress(),
      metadataUri,
      ...(mintResult.mintResult?.txHash
        ? { mintTxHash: mintResult.mintResult.txHash }
        : {}),
    },
  })

  return {
    ...mintResult,
    metadataUri,
  }
}
