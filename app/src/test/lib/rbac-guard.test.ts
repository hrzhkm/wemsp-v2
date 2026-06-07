import { describe, expect, it } from 'vitest'
import { resolveAppGuard } from '@/lib/rbac'

describe('resolveAppGuard', () => {
  it('redirects a USER away from an admin route', () => {
    expect(
      resolveAppGuard({ role: 'USER', pathname: '/app/admin/users', isProfilePage: false, profileComplete: true }),
    ).toEqual({ type: 'redirect', to: '/app/dashboard' })
  })

  it('allows an ADMIN on an admin route', () => {
    expect(
      resolveAppGuard({ role: 'ADMIN', pathname: '/app/admin/users', isProfilePage: false, profileComplete: false }),
    ).toEqual({ type: 'allow' })
  })

  it('admin bypasses profile completion on normal pages', () => {
    expect(
      resolveAppGuard({ role: 'ADMIN', pathname: '/app/dashboard', isProfilePage: false, profileComplete: false }),
    ).toEqual({ type: 'allow' })
  })

  it('flags profile-incomplete for a USER with incomplete profile on non-profile page', () => {
    expect(
      resolveAppGuard({ role: 'USER', pathname: '/app/dashboard', isProfilePage: false, profileComplete: false }),
    ).toEqual({ type: 'profile-incomplete' })
  })

  it('does not flag profile-incomplete on profile pages', () => {
    expect(
      resolveAppGuard({ role: 'USER', pathname: '/app/profile', isProfilePage: true, profileComplete: false }),
    ).toEqual({ type: 'allow' })
  })

  it('allows a USER with a complete profile', () => {
    expect(
      resolveAppGuard({ role: 'USER', pathname: '/app/dashboard', isProfilePage: false, profileComplete: true }),
    ).toEqual({ type: 'allow' })
  })
})
