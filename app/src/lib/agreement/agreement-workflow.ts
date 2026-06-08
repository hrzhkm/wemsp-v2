import { AgreementStatus } from '@/generated/prisma/enums'
import { validateStatusTransition } from './agreement-validation'

/**
 * Workflow context for status transitions
 */
export interface WorkflowContext {
  ownerHasSigned: boolean
  allBeneficiariesSigned: boolean
  witnessed: boolean
}

/**
 * Get the next valid statuses for an agreement
 */
export function getNextValidStatuses(
  currentStatus: AgreementStatus,
  context: WorkflowContext
): AgreementStatus[] {
  const transitions: Record<AgreementStatus, AgreementStatus[]> = {
    DRAFT: ['PENDING_SIGNATURES', 'CANCELLED'],
    PENDING_SIGNATURES: ['DRAFT', 'PENDING_WITNESS', 'CANCELLED'],
    PENDING_WITNESS: ['PENDING_SIGNATURES', 'ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
  }

  const possible = transitions[currentStatus] || []

  // Filter out statuses that can't be reached due to workflow requirements
  return possible.filter((status) => {
    const validation = validateStatusTransition(currentStatus, status, context)
    return validation.valid
  })
}

/**
 * Determine if agreement is ready to move to next status
 */
export function getWorkflowStatus(
  context: WorkflowContext
): { status: AgreementStatus; reason: string } {
  // If owner hasn't signed, still in DRAFT
  if (!context.ownerHasSigned) {
    return {
      status: 'DRAFT',
      reason: 'Waiting for owner to sign',
    }
  }

  // If owner signed but not all beneficiaries, waiting for signatures
  if (!context.allBeneficiariesSigned) {
    return {
      status: 'PENDING_SIGNATURES',
      reason: 'Waiting for all beneficiaries to sign',
    }
  }

  // If all signed but not witnessed, waiting for witness
  if (!context.witnessed) {
    return {
      status: 'PENDING_WITNESS',
      reason: 'Waiting for admin witness',
    }
  }

  // All complete - agreement is active
  return {
    status: 'ACTIVE',
    reason: 'Agreement fully executed',
  }
}

/**
 * Calculate signature progress for UI display
 */
export function getSignatureProgress(
  totalBeneficiaries: number,
  signedBeneficiaries: number,
  ownerHasSigned: boolean,
  witnessed: boolean
): {
  total: number
  completed: number
  percentage: number
  steps: Array<{ label: string; completed: boolean }>
} {
  const total = 2 + totalBeneficiaries // Owner + beneficiaries + witness
  let completed = 0

  if (ownerHasSigned) completed++
  completed += signedBeneficiaries
  if (witnessed) completed++

  const steps = [
    { label: 'Owner Signature', completed: ownerHasSigned },
    { label: 'Beneficiary Signatures', completed: signedBeneficiaries === totalBeneficiaries },
    { label: 'Admin Witness', completed: witnessed },
  ]

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    steps,
  }
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: AgreementStatus): string {
  const descriptions: Record<AgreementStatus, string> = {
    DRAFT: 'Agreement is being created and can be edited',
    PENDING_SIGNATURES: 'Owner has signed. Waiting for all beneficiaries to sign',
    PENDING_WITNESS: 'All parties have signed. Waiting for admin witness',
    ACTIVE: 'Agreement is fully executed and active',
    COMPLETED: 'Asset distribution has been completed',
    CANCELLED: 'Agreement has been cancelled',
    EXPIRED: 'Agreement has expired',
  }

  return descriptions[status] || status
}

/**
 * Get status badge color for UI
 */
export function getStatusColor(status: AgreementStatus): {
  bg: string
  text: string
  border: string
} {
  const colors: Record<AgreementStatus, { bg: string; text: string; border: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    PENDING_SIGNATURES: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    PENDING_WITNESS: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    ACTIVE: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    COMPLETED: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-400' },
  }

  return colors[status] || colors.DRAFT
}

/**
 * Check if agreement can transition to COMPLETED status
 */
export function canComplete(status: AgreementStatus): boolean {
  return status === 'ACTIVE'
}

/**
 * Check if user can sign the agreement
 */
export function canUserSign(
  userId: string,
  agreementOwnerId: string,
  agreementStatus: AgreementStatus,
  isBeneficiary: boolean,
  isAdmin: boolean
): {
  canSignAsOwner: boolean
  canSignAsBeneficiary: boolean
  canWitness: boolean
} {
  return {
    canSignAsOwner:
      userId === agreementOwnerId &&
      (agreementStatus === 'DRAFT' || agreementStatus === 'PENDING_SIGNATURES'),
    canSignAsBeneficiary: isBeneficiary && agreementStatus === 'PENDING_SIGNATURES',
    canWitness: isAdmin && agreementStatus === 'PENDING_WITNESS',
  }
}
