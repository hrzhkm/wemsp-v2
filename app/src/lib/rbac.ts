export type AppRole = 'USER' | 'ADMIN'

type SessionLike =
  | {
      user?: {
        role?: string | null
      } | null
    }
  | null
  | undefined

const UNAUTHORIZED_REDIRECT = '/app/dashboard'

// Route prefixes that require the ADMIN role. Matched by exact path or
// `${prefix}/` boundary so lookalikes (e.g. /app/administration) are not gated.
const appRoutePermissions: Record<string, AppRole[]> = {
  '/app/admin': ['ADMIN'],
}

function normalizeAppRoutePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

export function getRoleFromSession(session?: SessionLike): AppRole {
  const role = session?.user?.role
  return role === 'ADMIN' ? 'ADMIN' : 'USER'
}

export function isAdmin(role: AppRole): boolean {
  return role === 'ADMIN'
}

export function canAccessAppRoute(role: AppRole, routePath: string): boolean {
  const normalized = normalizeAppRoutePath(routePath)
  for (const [protectedPath, requiredRoles] of Object.entries(appRoutePermissions)) {
    if (normalized === protectedPath || normalized.startsWith(`${protectedPath}/`)) {
      return requiredRoles.includes(role)
    }
  }
  return true
}

export function getUnauthorizedRedirect(): string {
  return UNAUTHORIZED_REDIRECT
}

export type AppGuardResult =
  | { type: 'allow' }
  | { type: 'redirect'; to: string }
  | { type: 'profile-incomplete' }

export function resolveAppGuard(input: {
  role: AppRole
  pathname: string
  isProfilePage: boolean
  profileComplete: boolean
}): AppGuardResult {
  if (!canAccessAppRoute(input.role, input.pathname)) {
    return { type: 'redirect', to: getUnauthorizedRedirect() }
  }
  if (isAdmin(input.role)) {
    return { type: 'allow' }
  }
  if (!input.isProfilePage && !input.profileComplete) {
    return { type: 'profile-incomplete' }
  }
  return { type: 'allow' }
}
