import { validateFaraidShares } from '../faraid/faraidRules'
import type { AgreementStatus } from '@/generated/prisma/enums';
import { DistributionType } from '@/generated/prisma/enums'

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean
  errors: Array<string>
  warnings: Array<string>
}

/**
 * Beneficiary input for validation
 */
export interface BeneficiaryInput {
  familyMemberId?: number
  nonRegisteredFamilyMemberId?: number
  relation: string
  sharePercentage: number
  shareDescription?: string
}

/**
 * Asset input for validation
 */
export interface AssetInput {
  assetId: number
  allocatedValue?: number
  allocatedPercentage?: number
}

/**
 * Validate agreement creation/update input
 */
export function validateAgreementInput(data: {
  title?: string
  description?: string
  distributionType?: DistributionType
  effectiveDate?: Date | string | null
  expiryDate?: Date | string | null
}): ValidationResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []

  // Title validation
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required')
  } else if (data.title.length > 200) {
    errors.push('Title must be less than 200 characters')
  }

  // Description validation (optional but has max length)
  if (data.description && data.description.length > 1000) {
    errors.push('Description must be less than 1000 characters')
  }

  // Distribution type validation
  if (
    data.distributionType &&
    !Object.values(DistributionType).includes(data.distributionType)
  ) {
    errors.push(
      `Invalid distribution type. Must be one of: ${Object.values(DistributionType).join(', ')}`,
    )
  }

  // Date validation
  if (data.effectiveDate && data.expiryDate) {
    const effective = new Date(data.effectiveDate)
    const expiry = new Date(data.expiryDate)

    if (expiry <= effective) {
      errors.push('Expiry date must be after effective date')
    }
  }

  // Warn if dates are in the past
  if (data.effectiveDate) {
    const effective = new Date(data.effectiveDate)
    if (effective < new Date()) {
      warnings.push('Effective date is in the past')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate beneficiaries for an agreement
 */
export function validateBeneficiaries(
  beneficiaries: Array<BeneficiaryInput>,
  distributionType: DistributionType,
): ValidationResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []

  // Must have at least one beneficiary
  if (beneficiaries.length === 0) {
    errors.push('At least one beneficiary is required')
    return { valid: false, errors, warnings }
  }

  // Check that each beneficiary has either a registered or non-registered member
  beneficiaries.forEach((b, index) => {
    if (!b.familyMemberId && !b.nonRegisteredFamilyMemberId) {
      errors.push(
        `Beneficiary at index ${index}: Must specify either a registered family member or non-registered member`,
      )
    }

    if (b.familyMemberId && b.nonRegisteredFamilyMemberId) {
      errors.push(
        `Beneficiary at index ${index}: Cannot specify both registered and non-registered member`,
      )
    }

    // Share percentage validation
    if (typeof b.sharePercentage !== 'number' || b.sharePercentage <= 0) {
      errors.push(
        `Beneficiary at index ${index}: Share percentage must be a positive number`,
      )
    }

    if (b.sharePercentage > 100) {
      errors.push(
        `Beneficiary at index ${index}: Share percentage cannot exceed 100%`,
      )
    }

    if (!b.relation) {
      errors.push(`Beneficiary at index ${index}: Relation is required`)
    }
  })

  // Check that total shares equal 100%
  const totalShare = beneficiaries.reduce(
    (sum, b) => sum + b.sharePercentage,
    0,
  )
  if (Math.abs(totalShare - 100) > 0.1) {
    errors.push(
      `Total beneficiary shares must equal 100%. Current total: ${totalShare.toFixed(2)}%`,
    )
  }

  // For FARAID type, validate against Islamic inheritance rules
  if (distributionType === 'FARAID') {
    const faraidValidation = validateFaraidShares(
      beneficiaries.map((b) => ({
        relation: b.relation as any,
        sharePercentage: b.sharePercentage,
      })),
    )

    if (!faraidValidation.valid) {
      errors.push(...faraidValidation.errors)
    }

    if (faraidValidation.warnings.length > 0) {
      warnings.push(...faraidValidation.warnings)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate assets for an agreement
 */
export function validateAssets(assets: Array<AssetInput>): ValidationResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []

  // Must have at least one asset
  if (assets.length === 0) {
    errors.push('At least one asset is required')
    return { valid: false, errors, warnings }
  }

  // Validate each asset allocation
  assets.forEach((asset, index) => {
    if (!asset.assetId) {
      errors.push(`Asset at index ${index}: Asset ID is required`)
    }

    // Either allocatedValue or allocatedPercentage should be specified (or neither for full allocation)
    if (asset.allocatedValue !== undefined && asset.allocatedValue < 0) {
      errors.push(`Asset at index ${index}: Allocated value cannot be negative`)
    }

    if (asset.allocatedPercentage !== undefined) {
      if (asset.allocatedPercentage < 0 || asset.allocatedPercentage > 100) {
        errors.push(
          `Asset at index ${index}: Allocated percentage must be between 0 and 100`,
        )
      }
    }
  })

  // Check for duplicate asset IDs
  const assetIds = assets.map((a) => a.assetId)
  const uniqueIds = new Set(assetIds)
  if (assetIds.length !== uniqueIds.size) {
    errors.push('Duplicate assets detected. Each asset can only be added once')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: AgreementStatus,
  newStatus: AgreementStatus,
  context: {
    ownerHasSigned?: boolean
    allBeneficiariesSigned?: boolean
    witnessed?: boolean
  },
): ValidationResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []

  const validTransitions: Record<AgreementStatus, Array<AgreementStatus>> = {
    DRAFT: ['PENDING_SIGNATURES', 'CANCELLED'],
    PENDING_SIGNATURES: ['DRAFT', 'PENDING_WITNESS', 'CANCELLED'],
    PENDING_WITNESS: ['PENDING_SIGNATURES', 'ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
  }

  // Check if transition is valid
  const allowedNextStates = validTransitions[currentStatus] || []
  if (!allowedNextStates.includes(newStatus)) {
    errors.push(
      `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedNextStates.join(', ') || 'none'}`,
    )
  }

  // Additional validation based on target status
  switch (newStatus) {
    case 'PENDING_SIGNATURES':
      if (!context.ownerHasSigned) {
        errors.push(
          'Owner must sign before submitting for beneficiary signatures',
        )
      }
      break

    case 'PENDING_WITNESS':
      if (!context.allBeneficiariesSigned) {
        errors.push(
          'All beneficiaries must sign before submitting for witnessing',
        )
      }
      break

    case 'ACTIVE':
      if (!context.witnessed) {
        errors.push(
          'Agreement must be witnessed by an admin before becoming active',
        )
      }
      break
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validate signature submission
 */
export function validateSignature(
  signerType: 'owner' | 'beneficiary' | 'witness',
  agreementStatus: AgreementStatus,
  context: {
    isOwner?: boolean
    isBeneficiary?: boolean
    isAdmin?: boolean
    beneficiaryId?: number
    allBeneficiariesSigned?: boolean
  },
): ValidationResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []

  // Check authorization
  switch (signerType) {
    case 'owner':
      if (!context.isOwner) {
        errors.push('Only the agreement owner can sign as owner')
      }
      if (
        agreementStatus !== 'DRAFT' &&
        agreementStatus !== 'PENDING_SIGNATURES'
      ) {
        errors.push(
          `Owner can only sign agreements in DRAFT or PENDING_SIGNATURES status. Current status: ${agreementStatus}`,
        )
      }
      break

    case 'beneficiary':
      if (!context.isBeneficiary) {
        errors.push('Only designated beneficiaries can sign as beneficiary')
      }
      if (agreementStatus !== 'PENDING_SIGNATURES') {
        errors.push(
          `Beneficiaries can only sign agreements in PENDING_SIGNATURES status. Current status: ${agreementStatus}`,
        )
      }
      break

    case 'witness':
      if (!context.isAdmin) {
        errors.push('Only admins can witness agreements')
      }
      if (agreementStatus !== 'PENDING_WITNESS') {
        errors.push(
          `Agreements can only be witnessed in PENDING_WITNESS status. Current status: ${agreementStatus}`,
        )
      }
      break
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Check if an agreement can be edited
 */
export function canEditAgreement(
  status: AgreementStatus,
  userId: string,
  ownerId: string,
): boolean {
  return status === 'DRAFT' && userId === ownerId
}

/**
 * Check if an agreement can be cancelled
 */
export function canCancelAgreement(status: AgreementStatus): boolean {
  return ['DRAFT', 'PENDING_SIGNATURES', 'PENDING_WITNESS'].includes(status)
}

/**
 * Check if an agreement can be completed
 */
export function canComplete(status: AgreementStatus): boolean {
  return status === 'ACTIVE'
}
