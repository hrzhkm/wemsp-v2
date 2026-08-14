import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/app/agreement/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Redirect /app/agreement to /app/agreement/view
    if (location.pathname === '/app/agreement') {
      navigate({ to: '/app/agreement/view', replace: true })
    }
  }, [navigate, location.pathname])

  return <Outlet />
}
