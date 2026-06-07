import { corsHeaders } from '@/lib/cors'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/admin/logout/$')({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, { headers: corsHeaders })
      },
      POST: async () => {
        // Clear the same-origin admin session cookie.
        const clearedCookie = [
          'admin_session=',
          'HttpOnly',
          'Path=/',
          'SameSite=Lax',
          'Max-Age=0',
        ].join('; ')

        return Response.json({
          success: true,
          message: 'Logged out successfully',
        }, { headers: { ...corsHeaders, 'Set-Cookie': clearedCookie } })
      },
    },
  },
})
