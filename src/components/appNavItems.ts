import {
  Contact,
  FileText,
  History,
  Home,
  Package,
  Settings,
  Shield,
  Stamp,
  User,
  Users,
  Wallet2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppRole } from '@/lib/auth/rbac'

export type NavSection = 'application' | 'account' | 'administration'

export type NavItem = {
  to: string
  labelKey: string
  matchPath: string
  icon: LucideIcon
  section: NavSection
  roles?: Array<AppRole>
}

export const applicationNavItems: Array<NavItem> = [
  {
    to: '/app/dashboard',
    labelKey: 'navigation.dashboard',
    matchPath: '/app/dashboard',
    icon: Home,
    section: 'application',
  },
  {
    to: '/app/family/view',
    labelKey: 'navigation.family',
    matchPath: '/app/family',
    icon: Contact,
    section: 'application',
  },
  {
    to: '/app/assets/view',
    labelKey: 'navigation.assets',
    matchPath: '/app/assets',
    icon: Wallet2,
    section: 'application',
  },
  {
    to: '/app/agreement',
    labelKey: 'navigation.agreement',
    matchPath: '/app/agreement',
    icon: FileText,
    section: 'application',
  },
]

export const accountNavItems: Array<NavItem> = [
  {
    to: '/app/profile',
    labelKey: 'navigation.profile',
    matchPath: '/app/profile',
    icon: User,
    section: 'account',
  },
  {
    to: '/app/settings',
    labelKey: 'navigation.settings',
    matchPath: '/app/settings',
    icon: Settings,
    section: 'account',
  },
]

export const adminNavItems: Array<NavItem> = [
  {
    to: '/app/admin/dashboard',
    labelKey: 'navigation.adminDashboard',
    matchPath: '/app/admin/dashboard',
    icon: Shield,
    section: 'administration',
    roles: ['ADMIN'],
  },
  {
    to: '/app/admin/users',
    labelKey: 'navigation.adminUsers',
    matchPath: '/app/admin/users',
    icon: Users,
    section: 'administration',
    roles: ['ADMIN'],
  },
  {
    to: '/app/admin/assets',
    labelKey: 'navigation.adminAssets',
    matchPath: '/app/admin/assets',
    icon: Package,
    section: 'administration',
    roles: ['ADMIN'],
  },
  {
    to: '/app/admin/agreements',
    labelKey: 'navigation.adminAgreements',
    matchPath: '/app/admin/agreements',
    icon: FileText,
    section: 'administration',
    roles: ['ADMIN'],
  },
  {
    to: '/app/admin/agreements/pending-witness',
    labelKey: 'navigation.adminPendingWitness',
    matchPath: '/app/admin/agreements/pending-witness',
    icon: Stamp,
    section: 'administration',
    roles: ['ADMIN'],
  },
  {
    to: '/app/admin/transactions',
    labelKey: 'navigation.adminTransactions',
    matchPath: '/app/admin/transactions',
    icon: History,
    section: 'administration',
    roles: ['ADMIN'],
  },
]

const allNavItems: Array<NavItem> = [
  ...applicationNavItems,
  ...accountNavItems,
  ...adminNavItems,
]

export function getVisibleNavItems(role: AppRole): Array<NavItem> {
  return allNavItems.filter((item) => !item.roles || item.roles.includes(role))
}
