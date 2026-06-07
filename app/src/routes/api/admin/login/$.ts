import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '@/db'
import { verifyPassword, createAdminSessionToken } from '@/lib/admin-auth'
import { corsHeaders } from '@/lib/cors'

export const adminLoginHandlers = {
  OPTIONS: async () => {
    return new Response(null, { headers: corsHeaders })
  },
  POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { email, password } = body

          if (!email || !password) {
            return Response.json(
              { error: 'Email and password are required' },
              { status: 400, headers: corsHeaders }
            )
          }

          // Find admin by email
          const admin = await prisma.admin.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              isActive: true,
            },
          })

          if (!admin) {
            return Response.json(
              { error: 'Invalid credentials' },
              { status: 401, headers: corsHeaders }
            )
          }

          // Check if admin is active
          if (!admin.isActive) {
            return Response.json(
              { error: 'Account is inactive' },
              { status: 401, headers: corsHeaders }
            )
          }

          // Verify password
          const isValidPassword = await verifyPassword(password, admin.password)
          if (!isValidPassword) {
            return Response.json(
              { error: 'Invalid credentials' },
              { status: 401, headers: corsHeaders }
            )
          }

          // Create session token
          const sessionToken = await createAdminSessionToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
          })

          // Set an HttpOnly session cookie so same-origin /admin navigations
          // authenticate via the admin_session cookie. The token is also
          // returned in the body for any Bearer-header based callers.
          const isProd = process.env.NODE_ENV === 'production'
          const sessionCookie = [
            `admin_session=${sessionToken}`,
            'HttpOnly',
            'Path=/',
            'SameSite=Lax',
            'Max-Age=86400',
            ...(isProd ? ['Secure'] : []),
          ].join('; ')

          // Return token in response body for client-side storage
          return Response.json({
            success: true,
            token: sessionToken,
            admin: {
              id: admin.id,
              email: admin.email,
              name: admin.name,
            },
          }, { headers: { ...corsHeaders, 'Set-Cookie': sessionCookie } })
        } catch (error) {
          console.error('Admin login error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
          )
        }
  },
}

export const Route = createFileRoute('/api/admin/login/$')({
  server: {
    handlers: adminLoginHandlers,
  },
})
