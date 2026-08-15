import { describe, expect, it } from 'vitest'
import { parsePositiveAssetValue } from '@/lib/asset/assetValidation'

describe('parsePositiveAssetValue', () => {
  it('accepts positive finite values and rejects zero, negative, and malformed input', () => {
    expect(parsePositiveAssetValue('1,250.50')).toBe(1250.5)
    expect(parsePositiveAssetValue('0')).toBeNull()
    expect(parsePositiveAssetValue('-1')).toBeNull()
    expect(parsePositiveAssetValue('Infinity')).toBeNull()
    expect(parsePositiveAssetValue('1abc')).toBeNull()
  })
})
