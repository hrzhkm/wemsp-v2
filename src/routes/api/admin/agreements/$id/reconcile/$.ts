import { createFileRoute } from '@tanstack/react-router'
import { requireAdminFromHeaders } from '@/lib/auth/adminGuard'
import { corsHeaders } from '@/lib/cors'
import { reconcileAgreement } from '@/lib/agreement/agreementReconciliation'

export const Route = createFileRoute('/api/admin/agreements/$id/reconcile/$')({
  server: {
    handlers: {
      OPTIONS: () => {
        return new Response(null, { headers: corsHeaders })
      },

      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        try {
          const admin = await requireAdminFromHeaders(request.headers)
          if (!admin) {
            return Response.json(
              { error: 'Unauthorized' },
              { status: 401, headers: corsHeaders },
            )
          }

          const result = await reconcileAgreement(params.id)

          return Response.json(
            {
              success: true,
              agreementId: result.agreementId,
              tokenId: result.tokenId,
              updatedFields: result.updatedFields,
            },
            { headers: corsHeaders },
          )
        } catch (error) {
          console.error('Error reconciling agreement:', error)
          return Response.json(
            { error: 'Reconciliation failed' },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  },
})
