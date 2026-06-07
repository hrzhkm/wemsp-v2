import { describe, expect, it } from 'vitest'
import { getVisibleNavItems, adminNavItems, type NavItem } from '@/components/app-nav-items'

describe('getVisibleNavItems', () => {
  it('hides admin-only items from USER', () => {
    const items = getVisibleNavItems('USER')
    const labels = items.map((i: NavItem) => i.labelKey)
    expect(labels).not.toContain('navigation.adminUsers')
    expect(labels).toContain('navigation.dashboard')
  })

  it('shows admin-only items to ADMIN', () => {
    const items = getVisibleNavItems('ADMIN')
    const labels = items.map((i: NavItem) => i.labelKey)
    expect(labels).toContain('navigation.adminUsers')
    expect(labels).toContain('navigation.dashboard')
  })

  it('admin items are all gated to ADMIN role', () => {
    expect(adminNavItems.every((i) => i.roles?.includes('ADMIN'))).toBe(true)
  })
})
