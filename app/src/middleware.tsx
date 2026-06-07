import { createMiddleware } from '@tanstack/react-start'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/db'

/**
 * Check if a user has completed their profile.
 * A profile is considered complete if icNumber, address, and phoneNumber are provided.
 */
async function isProfileComplete(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { icNumber: true, address: true, phoneNumber: true },
  })
  if (!user) return false
  return !!(user.icNumber && user.address && user.phoneNumber)
}

/**
 * Authentication middleware for server-side route protection.
 * Checks if the user has a valid session before allowing access.
 *
 * Usage with server functions:
 * ```ts
 * const protectedServerFn = createServerFn({ method: 'GET' })
 *   .middleware([authMiddleware])
 *   .handler(async ({ context }) => {
 *     // context.session is available here
 *     return { user: context.session.user }
 *   })
 * ```
 */
export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    // Return a redirect response to the home/login page
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    })
  }

  // Pass the session to the next handler via context
  return next({
    context: {
      session,
    },
  })
})

/**
 * Profile completion middleware.
 * Checks if the user has completed their profile (icNumber, address, phoneNumber).
 * If not complete, redirects to the profile edit page with an onboarding prompt.
 * Should be used AFTER authMiddleware.
 *
 * Usage with routes:
 * ```ts
 * export const Route = createFileRoute('/app/some-route')({
 *   beforeLoad: ({ context }) => {
 *     // This will redirect to profile edit if profile is incomplete
 *   },
 *   loader: async () => {
 *     // Your loader logic
 *   }
 * })
 * ```
 *
 * For route-level protection, wrap the route component or use in beforeLoad:
 * ```ts
 * import { requireCompletedProfile } from '@/middleware'
 *
 * export const Route = createFileRoute('/app/assets')({
 *   beforeLoad: async () => {
 *     await requireCompletedProfile()
 *   }
 * })
 * ```
 */
export const profileCompletionMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    })
  }

  const profileComplete = await isProfileComplete(session.user.id)

  if (!profileComplete) {
    // Redirect to profile edit with onboarding prompt
    const url = new URL(request.url)
    const currentPath = url.pathname + url.search
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/app/profile/view?onboarding=true&redirect=${encodeURIComponent(currentPath)}`,
      },
    })
  }

  return next({
    context: {
      session,
      profileComplete: true,
    },
  })
})

/**
 * Server function to check and enforce profile completion.
 * Use this in route loaders or beforeLoad hooks.
 * Redirects to profile edit page if profile is incomplete.
 */
export const requireCompletedProfile = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    if (!request) {
      return null
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return { requiresAuth: true }
    }

    const profileComplete = await isProfileComplete(session.user.id)

    return {
      requiresAuth: false,
      profileComplete,
      user: session.user,
    }
  }
)

/**
 * Server function to get the current session.
 * Can be used in loaders or beforeLoad hooks for server-side auth checks.
 * Uses getWebRequest() to properly access cookies/headers from the incoming request.
 */
export const getServerSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    if (!request) {
      return null
    }
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  }
)

/**
 * Returns the authenticated user only if their role is ADMIN, else null.
 * This is THE server-side authorization boundary for admin API routes.
 * Uses the better-auth session; client-side hiding is not sufficient.
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

/**
 * Admin authentication middleware for server-side route protection.
 * Checks if the admin has a valid session before allowing access.
 *
 * Usage with server functions:
 * ```ts
 * const protectedAdminFn = createServerFn({ method: 'GET' })
 *   .middleware([adminAuthMiddleware])
 *   .handler(async ({ context }) => {
 *     // context.admin is available here
 *     return { admin: context.admin }
 *   })
 * ```
 */
export const adminAuthMiddleware = createMiddleware().server(async ({ next, request }) => {
  const admin = await requireAdminFromHeaders(request.headers)

  if (!admin) {
    // Not authenticated or not an admin: send to the shared app dashboard.
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/app/dashboard',
      },
    })
  }

  return next({
    context: {
      admin,
    },
  })
})

/**
 * Server function returning the current admin user (role === ADMIN) or null.
 * Used in route loaders / beforeLoad for server-side admin checks.
 */
export const getAdminSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    if (!request) {
      return null
    }
    return await requireAdminFromHeaders(request.headers)
  }
)
