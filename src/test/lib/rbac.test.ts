import { describe, expect, it } from 'vitest'
import {
  getRoleFromSession,
  isAdmin,
  canAccessAppRoute,
  getUnauthorizedRedirect,
  type AppRole,
} from '@/lib/auth/rbac'

describe('getRoleFromSession', () => {
  it('returns ADMIN when session user role is ADMIN', () => {
    expect(getRoleFromSession({ user: { role: 'ADMIN' } })).toBe('ADMIN')
  })

  it('returns USER when session user role is USER', () => {
    expect(getRoleFromSession({ user: { role: 'USER' } })).toBe('USER')
  })

  it('defaults to USER when role is missing or unknown', () => {
    expect(getRoleFromSession({ user: {} })).toBe('USER')
    expect(getRoleFromSession({ user: { role: 'superadmin' } })).toBe('USER')
    expect(getRoleFromSession(null)).toBe('USER')
    expect(getRoleFromSession(undefined)).toBe('USER')
  })
})

describe('isAdmin', () => {
  it('is true only for ADMIN', () => {
    expect(isAdmin('ADMIN')).toBe(true)
    expect(isAdmin('USER')).toBe(false)
  })
})

describe('canAccessAppRoute', () => {
  it('allows non-admin routes for everyone', () => {
    expect(canAccessAppRoute('USER', '/app/dashboard')).toBe(true)
    expect(canAccessAppRoute('USER', '/app/assets/view')).toBe(true)
  })

  it('blocks admin route prefixes for USER', () => {
    expect(canAccessAppRoute('USER', '/app/admin')).toBe(false)
    expect(canAccessAppRoute('USER', '/app/admin/users')).toBe(false)
    expect(canAccessAppRoute('USER', '/app/admin/agreements/pending-witness')).toBe(false)
  })

  it('allows admin route prefixes for ADMIN', () => {
    expect(canAccessAppRoute('ADMIN', '/app/admin')).toBe(true)
    expect(canAccessAppRoute('ADMIN', '/app/admin/users/123')).toBe(true)
  })

  it('normalizes trailing slashes', () => {
    expect(canAccessAppRoute('USER', '/app/admin/')).toBe(false)
    expect(canAccessAppRoute('ADMIN', '/app/admin/')).toBe(true)
  })

  it('does not treat lookalike prefixes as admin (e.g. /app/admins)', () => {
    expect(canAccessAppRoute('USER', '/app/administration')).toBe(true)
  })
})

describe('getUnauthorizedRedirect', () => {
  it('returns the user dashboard path', () => {
    expect(getUnauthorizedRedirect()).toBe('/app/dashboard')
  })
})
