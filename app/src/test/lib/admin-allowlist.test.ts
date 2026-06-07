import { describe, expect, it } from 'vitest'
import { parseAdminEmails, isAllowlistedAdmin } from '@/lib/admin-allowlist'

describe('parseAdminEmails', () => {
  it('splits, trims, lowercases, and drops blanks', () => {
    expect(parseAdminEmails('A@B.com, c@d.com ,, ')).toEqual(['a@b.com', 'c@d.com'])
  })

  it('returns empty array for undefined/empty', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails('')).toEqual([])
  })
})

describe('isAllowlistedAdmin', () => {
  it('matches case-insensitively', () => {
    expect(isAllowlistedAdmin('Admin@Wemsp.com', 'admin@wemsp.com')).toBe(true)
  })

  it('is false when not present', () => {
    expect(isAllowlistedAdmin('user@wemsp.com', 'admin@wemsp.com')).toBe(false)
  })

  it('is false when allowlist is empty', () => {
    expect(isAllowlistedAdmin('user@wemsp.com', undefined)).toBe(false)
  })
})
