import { describe, expect, it } from 'vitest'
import {
  calculateFaraidDistribution,
  formatFraction,
  formatShare,
  hasFixedShare,
  validateFaraidShares,
} from '@/lib/faraid/faraid-rules'

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
