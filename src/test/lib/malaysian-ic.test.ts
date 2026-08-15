import { describe, expect, it } from 'vitest'
import { formatMalaysianIc, isValidMalaysianIc } from '@/lib/family/malaysianIc'

describe('formatMalaysianIc', () => {
  it('formats full and partial IC numbers while ignoring non-digits', () => {
    expect(formatMalaysianIc('950815105567')).toBe('950815-10-5567')
    expect(formatMalaysianIc('9508151')).toBe('950815-1')
    expect(formatMalaysianIc('950815-10-5567extra')).toBe('950815-10-5567')
  })
})

describe('isValidMalaysianIc', () => {
  const today = new Date('2026-08-15T00:00:00.000Z')

  it('accepts real birth dates and rejects impossible, non-leap, and future dates', () => {
    expect(isValidMalaysianIc('000229-10-1234', today)).toBe(true)
    expect(isValidMalaysianIc('990231101234', today)).toBe(false)
    expect(isValidMalaysianIc('010229101234', today)).toBe(false)
    expect(isValidMalaysianIc('261231101234', today)).toBe(false)
  })
})
