import { auth } from '@/lib/auth/auth'
import { prisma } from '@/db'

/**
 * Returns the authenticated user only if their role is ADMIN, else null.
 * This is THE server-side authorization boundary for admin API routes.
 * Uses the better-auth session; client-side hiding is not sufficient.
 *
 * The role is re-read from the database (not taken from the session) because
 * better-auth does not reliably keep session `additionalFields` like `role`
 * in sync with the current DB value. Reading the authoritative role here means
 * a demoted admin loses access immediately, without waiting for their session
 * to expire or be revoked.
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
  const sessionUser = session?.user as
    | { id: string; name?: string | null; email?: string | null }
    | undefined
  if (!sessionUser?.id) {
    return null
  }

  // Authoritative role check against the current DB row, not the session.
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, name: true, email: true },
  })
  if (!dbUser || dbUser.role !== 'ADMIN') {
    return null
  }

  return {
    id: dbUser.id,
    role: dbUser.role,
    name: dbUser.name,
    email: dbUser.email,
  }
}
