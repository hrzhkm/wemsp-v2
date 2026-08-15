import { describe, expect, it } from 'vitest'
import type {NavItem} from '@/components/appNavItems';
import {
  
  adminNavItems,
  getVisibleNavItems
} from '@/components/appNavItems'

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

  it('shows account items to both roles', () => {
    for (const role of ['USER', 'ADMIN'] as const) {
      const labels = getVisibleNavItems(role).map((i) => i.labelKey)
      expect(labels).toContain('navigation.profile')
      expect(labels).toContain('navigation.settings')
    }
  })

  it('shows the full admin set to ADMIN', () => {
    const labels = getVisibleNavItems('ADMIN').map((i) => i.labelKey)
    expect(labels).toEqual(
      expect.arrayContaining([
        'navigation.adminDashboard',
        'navigation.adminUsers',
        'navigation.adminAssets',
        'navigation.adminAgreements',
        'navigation.adminPendingWitness',
        'navigation.adminTransactions',
      ]),
    )
  })

  it('returns no administration-section items for USER', () => {
    const sections = getVisibleNavItems('USER').map((i) => i.section)
    expect(sections).not.toContain('administration')
  })
})
