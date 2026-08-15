import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'

export { getCountries, getCountryCallingCode }
export type { CountryCode }

export const parsePhoneInput = (value: string, country: CountryCode) => {
  const input = value.trim()
  if (!input) return { valid: true as const, value: null }
  if (/[A-Za-z]/.test(input)) return { valid: false as const }

  const phone = parsePhoneNumberFromString(input, country)
  return phone?.isValid()
    ? { valid: true as const, value: phone.number }
    : { valid: false as const }
}

export const normalizeStoredPhoneNumber = (value: unknown) => {
  if (value == null || value === '')
    return { valid: true as const, value: null }
  if (
    typeof value !== 'string' ||
    !value.startsWith('+') ||
    /[A-Za-z]/.test(value)
  ) {
    return { valid: false as const }
  }

  const phone = parsePhoneNumberFromString(value)
  return phone?.isValid()
    ? { valid: true as const, value: phone.number }
    : { valid: false as const }
}

export const splitPhoneNumber = (value?: string | null) => {
  const phone = value ? parsePhoneNumberFromString(value) : undefined
  return {
    country: phone?.country || ('MY' as CountryCode),
    nationalNumber: phone?.nationalNumber || value || '',
  }
}
