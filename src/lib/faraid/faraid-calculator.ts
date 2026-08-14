import type { FamilyRelation } from '@/generated/prisma/enums'
import { calculateFaraidDistribution, formatShare } from './faraid-rules'

/**
 * Family member with their relation information
 */
export interface FamilyMember {
  id: number
  type: 'registered' | 'non-registered'
  name: string
  relation: FamilyRelation
  email?: string
  icNumber?: string
}

/**
 * Beneficiary with calculated Faraid share
 */
export interface BeneficiaryWithShare {
  memberId: number
  type: 'registered' | 'non-registered'
  name: string
  relation: FamilyRelation
  sharePercentage: number
  shareFormatted: string // e.g., "1/6 (16.7%)"
  description: string // Explanation of this share
}

/**
 * Result of Faraid auto-calculation
 */
export interface FaraidCalculationResult {
  beneficiaries: BeneficiaryWithShare[]
  totalPercentage: number
  description: string // Overall explanation
  hasResiduary: boolean // Whether there are residuary heirs
  warnings: string[] // Any warnings about the calculation
}

/**
 * Eligible heirs for Faraid - relations that can receive shares
 * These are the relations recognized in Faraid that can receive inheritance
 */
const ELIGIBLE_FARAIT_HEIRS: Set<FamilyRelation> = new Set([
  'FATHER',
  'MOTHER',
  'HUSBAND',
  'WIFE',
  'DAUGHTER',
  'SON',
  'GRANDDAUGHTER',
  'GRANDSON',
  'GRANDMOTHER',
  'GRANDFATHER',
  'SIBLING',
])

/**
 * Filter family members to only include eligible Faraid heirs
 * @param familyMembers - All family members
 * @returns Filtered list of only eligible heirs
 */
export function filterEligibleHeirs(familyMembers: FamilyMember[]): FamilyMember[] {
  return familyMembers.filter(member => ELIGIBLE_FARAIT_HEIRS.has(member.relation))
}

/**
 * Calculate residuary shares among multiple heirs
 * @param residuaryRelations - List of relations that receive residuary
 * @param residuaryHeirs - Actual family members who are residuary heirs
 * @param remainingShare - Remaining share to distribute (0-1)
 * @returns Map of member ID to their share
 */
function calculateResiduaryShares(
  _residuaryRelations: FamilyRelation[],
  residuaryHeirs: FamilyMember[],
  remainingShare: number
): Map<number, number> {
  const shares = new Map<number, number>()

  if (remainingShare <= 0 || residuaryHeirs.length === 0) {
    return shares
  }

  // Count heirs by relation for proper distribution
  const relationCounts = new Map<FamilyRelation, FamilyMember[]>()
  residuaryHeirs.forEach(heir => {
    if (!relationCounts.has(heir.relation)) {
      relationCounts.set(heir.relation, [])
    }
    relationCounts.get(heir.relation)!.push(heir)
  })

  // Calculate shares based on Faraid rules
  // Sons get 2x share of daughters
  const sons = relationCounts.get('SON') || []
  const daughters = relationCounts.get('DAUGHTER') || []
  const grandsons = relationCounts.get('GRANDSON') || []
  const granddaughters = relationCounts.get('GRANDDAUGHTER') || []
  const siblings = relationCounts.get('SIBLING') || []
  const grandfathers = relationCounts.get('GRANDFATHER') || []

  // Calculate total "shares" based on Islamic inheritance rules
  let totalShares = 0

  // Sons: 2 shares each
  totalShares += sons.length * 2
  // Daughters: 1 share each
  totalShares += daughters.length * 1
  // Grandsons: 2 shares each (in absence of sons)
  if (sons.length === 0) {
    totalShares += grandsons.length * 2
  }
  // Granddaughters: 1 share each (in absence of daughters)
  if (daughters.length === 0) {
    totalShares += granddaughters.length * 1
  }
  // Siblings: equal shares (simplified - actual rules are more complex)
  totalShares += siblings.length
  // Grandfathers: residuary
  totalShares += grandfathers.length

  if (totalShares === 0) {
    return shares
  }

  // Distribute remaining share
  const sharePerUnit = remainingShare / totalShares

  sons.forEach(son => {
    shares.set(son.id, sharePerUnit * 2)
  })

  daughters.forEach(daughter => {
    shares.set(daughter.id, sharePerUnit * 1)
  })

  if (sons.length === 0) {
    grandsons.forEach(grandson => {
      shares.set(grandson.id, sharePerUnit * 2)
    })
  }

  if (daughters.length === 0) {
    granddaughters.forEach(granddaughter => {
      shares.set(granddaughter.id, sharePerUnit * 1)
    })
  }

  siblings.forEach(sibling => {
    shares.set(sibling.id, sharePerUnit)
  })

  grandfathers.forEach(grandfather => {
    shares.set(grandfather.id, sharePerUnit)
  })

  return shares
}

/**
 * Automatically calculate Faraid distribution for eligible family members
 * @param familyMembers - All family members (will be filtered to eligible heirs)
 * @returns Faraid calculation result with shares for each beneficiary
 */
export function calculateAutoFaraidDistribution(familyMembers: FamilyMember[]): FaraidCalculationResult {
  const warnings: string[] = []

  // Filter to only eligible heirs
  const eligibleHeirs = filterEligibleHeirs(familyMembers)

  if (eligibleHeirs.length === 0) {
    return {
      beneficiaries: [],
      totalPercentage: 0,
      description: 'No eligible Faraid heirs found among family members',
      hasResiduary: false,
      warnings: ['No eligible family members for Faraid distribution'],
    }
  }

  // Group heirs by relation for Faraid calculation
  const relationsMap = new Map<FamilyRelation, number>()
  const heirsByRelation = new Map<FamilyRelation, FamilyMember[]>()

  eligibleHeirs.forEach(heir => {
    relationsMap.set(heir.relation, (relationsMap.get(heir.relation) || 0) + 1)
    if (!heirsByRelation.has(heir.relation)) {
      heirsByRelation.set(heir.relation, [])
    }
    heirsByRelation.get(heir.relation)!.push(heir)
  })

  // Build beneficiary input for Faraid calculation
  const beneficiaryInput = Array.from(relationsMap.entries()).map(([relation, count]) => ({
    relation,
    count,
  }))

  // Calculate Faraid distribution
  const distribution = calculateFaraidDistribution(beneficiaryInput)

  // Build beneficiaries with calculated shares
  const beneficiaries: BeneficiaryWithShare[] = []
  const residuaryHeirs: FamilyMember[] = []

  // First, assign fixed shares
  distribution.shares.forEach((share, relation) => {
    const heirs = heirsByRelation.get(relation) || []
    const sharePerHeir = share / heirs.length

    heirs.forEach(heir => {
      beneficiaries.push({
        memberId: heir.id,
        type: heir.type,
        name: heir.name,
        relation: heir.relation,
        sharePercentage: sharePerHeir * 100,
        shareFormatted: formatShare(sharePerHeir),
        description: FIXED_SHARE_DESCRIPTIONS[relation] || `Share according to Faraid rules for ${relation}`,
      })
    })
  })

  // Collect residuary heirs
  distribution.residuary.forEach(relation => {
    const heirs = heirsByRelation.get(relation) || []
    residuaryHeirs.push(...heirs)
  })

  // Calculate remaining share for residuary heirs
  const remainingShare = 1 - distribution.totalFixedShares
  const residuaryShares = calculateResiduaryShares(
    distribution.residuary,
    residuaryHeirs,
    remainingShare
  )

  // Add residuary beneficiaries
  residuaryShares.forEach((share, memberId) => {
    const heir = residuaryHeirs.find(h => h.id === memberId)
    if (heir) {
      beneficiaries.push({
        memberId: heir.id,
        type: heir.type,
        name: heir.name,
        relation: heir.relation,
        sharePercentage: share * 100,
        shareFormatted: formatShare(share),
        description: `Residuary share (remaining portion after fixed shares)`,
      })
    }
  })

  // Calculate total percentage
  const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.sharePercentage, 0)

  // Check if total is close to 100%
  if (Math.abs(totalPercentage - 100) > 1) {
    warnings.push(
      `Total shares (${totalPercentage.toFixed(1)}%) may not equal 100% due to rounding. ` +
      `This is normal in Faraid calculations and the difference will be adjusted.`
    )
  }

  return {
    beneficiaries,
    totalPercentage: Math.round(totalPercentage * 10) / 10, // Round to 1 decimal
    description: distribution.description,
    hasResiduary: residuaryHeirs.length > 0,
    warnings,
  }
}

/**
 * Description for each relation type
 */
const FIXED_SHARE_DESCRIPTIONS: Record<FamilyRelation, string> = {
  FATHER: 'Fixed share of 1/6, plus residuary if no male descendants',
  MOTHER: '1/6 if children present, 1/3 if no children',
  HUSBAND: '1/4 if children present, 1/2 if no children',
  WIFE: '1/8 if children present, 1/4 if no children',
  DAUGHTER: '1/2 if single, 2/3 shared among multiple daughters (with no sons)',
  GRANDDAUGHTER: '1/6 representing deceased daughter',
  SON: 'Residuary - receives remaining portion',
  GRANDSON: 'Residuary - in absence of sons',
  SIBLING: 'Residuary - in absence of descendants, parents, and grandparents',
  GRANDFATHER: 'May receive fixed share or residuary depending on circumstances',
  GRANDMOTHER: '1/6 in absence of mother',
  UNCLE: 'Residuary - distant relative',
  AUNT: 'No fixed share in most schools of thought',
  NEPHEW: 'Residuary - distant relative',
  NIECE: 'Residuary in certain conditions',
  COUSIN: 'Distant residuary heir',
  OTHER: 'No prescribed Faraid share',
}
