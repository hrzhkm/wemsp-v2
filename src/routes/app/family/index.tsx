import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/app/family/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Redirect /app/family to /app/family/view
    if (location.pathname === '/app/family') {
      navigate({ to: '/app/family/view', replace: true })
    }
  }, [navigate, location.pathname])

  return <Outlet />
}
