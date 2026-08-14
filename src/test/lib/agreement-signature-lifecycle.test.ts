import { describe, expect, it } from 'vitest'
import { validateSignature, validateStatusTransition } from '@/lib/agreement/agreement-validation'

describe('agreement signature lifecycle guards', () => {
  it('owner can only sign in DRAFT or PENDING_SIGNATURES', () => {
    const result = validateSignature('owner', 'ACTIVE', {
      isOwner: true,
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Owner can only sign agreements/) 
  })

  it('beneficiary cannot sign when not in PENDING_SIGNATURES', () => {
    const result = validateSignature('beneficiary', 'DRAFT', {
      isBeneficiary: true,
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Beneficiaries can only sign agreements/) 
  })

  it('witness requires admin role and PENDING_WITNESS status', () => {
    const missingRole = validateSignature('witness', 'PENDING_WITNESS', {
      isAdmin: false,
    })
    expect(missingRole.valid).toBe(false)

    const wrongStatus = validateSignature('witness', 'ACTIVE', {
      isAdmin: true,
    })
    expect(wrongStatus.valid).toBe(false)
  })

  it('transition to PENDING_WITNESS requires all beneficiaries signed', () => {
    const result = validateStatusTransition('PENDING_SIGNATURES', 'PENDING_WITNESS', {
      allBeneficiariesSigned: false,
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('All beneficiaries must sign')
  })
})
