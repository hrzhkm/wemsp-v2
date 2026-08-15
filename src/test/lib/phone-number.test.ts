import { describe, expect, it } from 'vitest'
import {
  normalizeStoredPhoneNumber,
  parsePhoneInput,
} from '@/lib/family/phoneNumber'

describe('family phone validation', () => {
  it('normalizes valid Malaysian and international numbers to E.164', () => {
    expect(parsePhoneInput('012-345 6789', 'MY')).toEqual({
      valid: true,
      value: '+60123456789',
    })
    expect(parsePhoneInput('(415) 555-2671', 'US')).toEqual({
      valid: true,
      value: '+14155552671',
    })
  })

  it('allows blank numbers and rejects text or invalid stored values', () => {
    expect(parsePhoneInput('', 'MY')).toEqual({ valid: true, value: null })
    expect(parsePhoneInput('call me maybe', 'MY')).toEqual({ valid: false })
    expect(normalizeStoredPhoneNumber('0123456789')).toEqual({ valid: false })
  })
})
