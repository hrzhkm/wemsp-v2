import { FamilyRelationType } from '@/lib/family/family-types'

export type FamilyMemberType = 'registered' | 'non-registered'

export interface RegisteredFamilyMember {
  id: string
  type: 'registered'
  userId: string
  familyMemberUserId: string
  name: string
  email: string
  relation: FamilyRelationType
  image?: string | null
  icNumber?: string | null
}

export interface NonRegisteredFamilyMember {
  id: number
  type: 'non-registered'
  name: string
  icNumber: string
  phoneNumber?: string | null
  address?: string | null
  relation: FamilyRelationType
}

export type FamilyMember = RegisteredFamilyMember | NonRegisteredFamilyMember

export function isRegisteredFamilyMember(member: FamilyMember): member is RegisteredFamilyMember {
  return member.type === 'registered'
}

export function isNonRegisteredFamilyMember(member: FamilyMember): member is NonRegisteredFamilyMember {
  return member.type === 'non-registered'
}
