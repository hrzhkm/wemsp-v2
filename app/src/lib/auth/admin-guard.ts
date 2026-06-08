import { auth } from '@/lib/auth/auth'

/**
 * Returns the authenticated user only if their role is ADMIN, else null.
 * This is THE server-side authorization boundary for admin API routes.
 * Uses the better-auth session; client-side hiding is not sufficient.
 *
 * NOTE: This lives in its own server-only module (not `@/middleware`) on
 * purpose. It is a plain function, so its body is NOT stripped from the
 * client bundle the way `createServerFn`/`createMiddleware` bodies are.
 * Keeping it out of the client-reachable `@/middleware` module prevents
 * `@/lib/auth` (and transitively `@prisma/client`) from being pulled into
 * the browser bundle. Import this only from server code (API routes and
 * stripped server-function bodies).
 */
export async function requireAdminFromHeaders(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  const user = session?.user as
    | { id: string; role?: string | null; name?: string | null; email?: string | null }
    | undefined
  if (!user || user.role !== 'ADMIN') {
    return null
  }
  return user
}
