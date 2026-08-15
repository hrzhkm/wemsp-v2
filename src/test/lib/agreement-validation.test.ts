import { describe, expect, it } from 'vitest'
import {
  canCancelAgreement,
  canComplete,
  canEditAgreement,
  validateAgreementInput,
  validateAssets,
  validateStatusTransition,
} from '@/lib/agreement/agreementValidation'

describe('validateAgreementInput', () => {
  it('returns error when title is missing', () => {
    const result = validateAgreementInput({
      title: '',
      distributionType: 'FARAID',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Title is required')
  })

  it('returns valid for a minimal valid payload', () => {
    const result = validateAgreementInput({
      title: 'My agreement',
      distributionType: 'HIBAH',
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error when expiry date is before effective date', () => {
    const result = validateAgreementInput({
      title: 'Agreement',
      distributionType: 'WASIYYAH',
      effectiveDate: '2026-01-10',
      expiryDate: '2026-01-09',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Expiry date must be after effective date')
  })
})

describe('validateAssets', () => {
  it('requires at least one asset', () => {
    const result = validateAssets([])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('At least one asset is required')
  })

  it('rejects duplicate asset ids', () => {
    const result = validateAssets([
      { assetId: 1, allocatedPercentage: 50 },
      { assetId: 1, allocatedPercentage: 50 },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Duplicate assets detected. Each asset can only be added once')
  })

  it('accepts valid unique assets', () => {
    const result = validateAssets([
      { assetId: 1, allocatedPercentage: 50 },
      { assetId: 2, allocatedPercentage: 50 },
    ])

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('workflow helper checks', () => {
  it('enforces editable only for owner in DRAFT', () => {
    expect(canEditAgreement('DRAFT', 'u1', 'u1')).toBe(true)
    expect(canEditAgreement('DRAFT', 'u2', 'u1')).toBe(false)
    expect(canEditAgreement('PENDING_SIGNATURES', 'u1', 'u1')).toBe(false)
  })

  it('supports cancel/complete guards', () => {
    expect(canCancelAgreement('DRAFT')).toBe(true)
    expect(canCancelAgreement('ACTIVE')).toBe(false)
    expect(canComplete('ACTIVE')).toBe(true)
    expect(canComplete('DRAFT')).toBe(false)
  })

  it('blocks invalid status transitions', () => {
    const result = validateStatusTransition('DRAFT', 'ACTIVE', {})

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Cannot transition from DRAFT to ACTIVE/)
  })

  it('allows valid transition when requirements are met', () => {
    const result = validateStatusTransition('PENDING_WITNESS', 'ACTIVE', {
      witnessed: true,
    })

    expect(result.valid).toBe(true)
  })
})
