/**
 * Family relation types - matches the FamilyRelation enum in schema.prisma
 * This file contains client-safe constants and types (no database imports)
 */
export const FamilyRelation = {
  FATHER: 'FATHER',
  MOTHER: 'MOTHER',
  SON: 'SON',
  DAUGHTER: 'DAUGHTER',
  SIBLING: 'SIBLING',
  HUSBAND: 'HUSBAND',
  WIFE: 'WIFE',
  GRANDFATHER: 'GRANDFATHER',
  GRANDMOTHER: 'GRANDMOTHER',
  GRANDSON: 'GRANDSON',
  GRANDDAUGHTER: 'GRANDDAUGHTER',
  UNCLE: 'UNCLE',
  AUNT: 'AUNT',
  NEPHEW: 'NEPHEW',
  NIECE: 'NIECE',
  COUSIN: 'COUSIN',
  OTHER: 'OTHER',
} as const

type FamilyRelationType = (typeof FamilyRelation)[keyof typeof FamilyRelation]
export { FamilyRelationType }

/**
 * Mapping of family relations to their inverse relations.
 * When User A adds User B with a relation, User B gets the inverse relation for User A.
 */
export const INVERSE_RELATIONS: Record<FamilyRelationType, FamilyRelationType> = {
  // Parent ↔ Child
  [FamilyRelation.FATHER]: FamilyRelation.SON,       // If A's father is B, then B's son is A
  [FamilyRelation.MOTHER]: FamilyRelation.DAUGHTER,  // If A's mother is B, then B's daughter is A
  [FamilyRelation.SON]: FamilyRelation.FATHER,       // If A's son is B, then B's father is A
  [FamilyRelation.DAUGHTER]: FamilyRelation.MOTHER,  // If A's daughter is B, then B's mother is A

  // Sibling (symmetric)
  [FamilyRelation.SIBLING]: FamilyRelation.SIBLING,

  // Spouse (symmetric - husband ↔ wife)
  [FamilyRelation.HUSBAND]: FamilyRelation.WIFE,
  [FamilyRelation.WIFE]: FamilyRelation.HUSBAND,

  // Grandparent ↔ Grandchild
  [FamilyRelation.GRANDFATHER]: FamilyRelation.GRANDSON,
  [FamilyRelation.GRANDMOTHER]: FamilyRelation.GRANDDAUGHTER,
  [FamilyRelation.GRANDSON]: FamilyRelation.GRANDFATHER,
  [FamilyRelation.GRANDDAUGHTER]: FamilyRelation.GRANDMOTHER,

  // Uncle/Aunt ↔ Nephew/Niece
  [FamilyRelation.UNCLE]: FamilyRelation.NEPHEW,
  [FamilyRelation.AUNT]: FamilyRelation.NIECE,
  [FamilyRelation.NEPHEW]: FamilyRelation.UNCLE,
  [FamilyRelation.NIECE]: FamilyRelation.AUNT,

  // Cousin (symmetric)
  [FamilyRelation.COUSIN]: FamilyRelation.COUSIN,

  // Other (symmetric)
  [FamilyRelation.OTHER]: FamilyRelation.OTHER,
}

/**
 * Get the inverse relation for a given family relation.
 * Note: For gender-specific relations (like SON/DAUGHTER), you may want to
 * pass the actual gender of the user to get the correct inverse.
 */
export function getInverseRelation(relation: FamilyRelationType): FamilyRelationType {
  return INVERSE_RELATIONS[relation]
}
