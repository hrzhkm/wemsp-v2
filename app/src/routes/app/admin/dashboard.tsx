import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { getAdminSession } from '@/middleware'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users } from 'lucide-react'

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
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Admin Portal
            </div>
            <CardTitle className="text-xl">Welcome to the Admin Portal</CardTitle>
            <CardDescription className="mt-1">
              Manage agreements, users, and system settings from a single place.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/app/admin/users" className="block">
          <Card className="border-border/70 transition-colors hover:bg-accent/50">
            <CardHeader>
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription>
                Manage user accounts, view user details, and perform CRUD operations.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
