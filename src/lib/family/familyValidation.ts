import { FamilyRelation } from './familyTypes'
import { isValidMalaysianIc, normalizeMalaysianIc } from './malaysianIc'
import { normalizeStoredPhoneNumber } from './phoneNumber'
import type { FamilyRelationType } from './familyTypes'

export interface NonRegisteredFamilyInput {
  address: string | null
  icNumber: string
  name: string
  phoneNumber: string | null
  relation: FamilyRelationType
}

export const parseFamilyRelation = (value: unknown) =>
  typeof value === 'string' &&
  Object.values(FamilyRelation).includes(value as FamilyRelationType)
    ? (value as FamilyRelationType)
    : null

export const validateNonRegisteredFamilyInput = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const icNumber =
    typeof input.icNumber === 'string'
      ? normalizeMalaysianIc(input.icNumber)
      : ''
  const relation = parseFamilyRelation(input.relation)
  const phone = normalizeStoredPhoneNumber(input.phoneNumber)

  if (!name || !isValidMalaysianIc(icNumber) || !relation || !phone.valid)
    return null

  return {
    address:
      typeof input.address === 'string' ? input.address.trim() || null : null,
    icNumber,
    name,
    phoneNumber: phone.value,
    relation,
  } satisfies NonRegisteredFamilyInput
}
