import { describe, expect, it } from 'vitest'
import { formatMalaysianIc } from '@/lib/family/malaysianIc'

describe('formatMalaysianIc', () => {
  it('formats full and partial IC numbers while ignoring non-digits', () => {
    expect(formatMalaysianIc('950815105567')).toBe('950815-10-5567')
    expect(formatMalaysianIc('9508151')).toBe('950815-1')
    expect(formatMalaysianIc('950815-10-5567extra')).toBe('950815-10-5567')
  })
})
