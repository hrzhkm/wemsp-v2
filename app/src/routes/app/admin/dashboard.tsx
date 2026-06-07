import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { getAdminSession } from '@/middleware'

export const Route = createFileRoute('/app/admin/dashboard')({
  loader: async () => {
    const admin = await getAdminSession()
    if (!admin) {
      throw redirect({ to: '/app/dashboard' })
    }
    return { admin }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/app/admin/users"
          className="bg-background rounded-lg border p-6 hover:bg-accent/50 transition-colors cursor-pointer block"
        >
          <h3 className="text-lg font-semibold mb-2">User Management</h3>
          <p className="text-muted-foreground text-sm">
            Manage user accounts, view user details, and perform CRUD operations.
          </p>
        </Link>
      </div>

      <div className="bg-background rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-2">Welcome to the Admin Portal</h2>
        <p className="text-muted-foreground">
          This is the admin dashboard where you can manage agreements, users, and system settings.
        </p>
      </div>
    </div>
  )
}
