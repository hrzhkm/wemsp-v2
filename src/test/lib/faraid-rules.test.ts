import { describe, expect, it } from 'vitest'
import {
  calculateFaraidDistribution,
  formatFraction,
  formatShare,
  hasFixedShare,
  validateFaraidShares,
} from '@/lib/faraid/faraidRules'

describe('faraid-rules', () => {
  it('calculates spouse and mother fixed shares with children', () => {
    const result = calculateFaraidDistribution([
      { relation: 'HUSBAND', count: 1 },
      { relation: 'MOTHER', count: 1 },
      { relation: 'SON', count: 1 },
    ])

    expect(result.shares.get('HUSBAND')).toBe(1 / 4)
    expect(result.shares.get('MOTHER')).toBe(1 / 6)
    expect(result.residuary).toContain('SON')
  })

  it('applies radd to reach 100% for husband and single daughter', () => {
    const result = calculateFaraidDistribution([
      { relation: 'HUSBAND', count: 1 },
      { relation: 'DAUGHTER', count: 1 },
    ])

    expect(result.shares.get('HUSBAND')).toBe(1 / 4)
    expect(result.shares.get('DAUGHTER')).toBeCloseTo(3 / 4)
    expect(result.totalFixedShares).toBe(1)
    expect(result.description).toMatch(/Radd/)
  })

  it('applies radd for a single daughter to receive the full estate', () => {
    const result = calculateFaraidDistribution([
      { relation: 'DAUGHTER', count: 1 },
    ])

    expect(result.shares.get('DAUGHTER')).toBe(1)
    expect(result.totalFixedShares).toBe(1)
  })

  it('applies radd proportionally while excluding the spouse', () => {
    const result = calculateFaraidDistribution([
      { relation: 'HUSBAND', count: 1 },
      { relation: 'MOTHER', count: 1 },
      { relation: 'DAUGHTER', count: 1 },
    ])

    // Remainder 1/12 split proportionally between mother (1/6) and daughter (1/2)
    expect(result.shares.get('HUSBAND')).toBe(1 / 4)
    expect(result.shares.get('MOTHER')).toBeCloseTo(3 / 16)
    expect(result.shares.get('DAUGHTER')).toBeCloseTo(9 / 16)
    expect(result.totalFixedShares).toBe(1)
  })

  it('does not apply radd when a residuary heir exists', () => {
    const result = calculateFaraidDistribution([
      { relation: 'HUSBAND', count: 1 },
      { relation: 'DAUGHTER', count: 1 },
      { relation: 'SON', count: 1 },
    ])

    expect(result.shares.get('HUSBAND')).toBe(1 / 4)
    expect(result.shares.get('DAUGHTER')).toBeUndefined()
    expect(result.residuary).toContain('SON')
    expect(result.totalFixedShares).toBe(1 / 4)
  })

  it('leaves remainder to Baitulmal when only a spouse heir exists', () => {
    const result = calculateFaraidDistribution([
      { relation: 'HUSBAND', count: 1 },
    ])

    expect(result.shares.get('HUSBAND')).toBe(1 / 2)
    expect(result.totalFixedShares).toBe(1 / 2)
    expect(result.description).toMatch(/Baitulmal/)
  })

  it('validates total shares to 100%', () => {
    const result = validateFaraidShares([
      { relation: 'HUSBAND', sharePercentage: 20 },
      { relation: 'MOTHER', sharePercentage: 20 },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Total shares must equal 100%/)
  })

  it('recognizes fixed-share relations', () => {
    expect(hasFixedShare('HUSBAND')).toBe(true)
    expect(hasFixedShare('SON')).toBe(false)
  })

  it('formats common fractions and share strings', () => {
    expect(formatFraction(0.5)).toBe('1/2')
    expect(formatShare(0.125)).toBe('1/8 (12.5%)')
  })
})
