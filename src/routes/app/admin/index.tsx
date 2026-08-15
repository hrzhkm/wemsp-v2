import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAdminSession } from '@/middleware'

export const Route = createFileRoute('/app/admin/')({
  loader: async () => {
    const admin = await getAdminSession()
    if (admin) {
      throw redirect({ to: '/app/admin/dashboard' })
    } else {
      throw redirect({ to: '/app/dashboard' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
