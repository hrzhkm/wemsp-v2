import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/app/assets/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Redirect /app/assets to /app/assets/view
    if (location.pathname === '/app/assets') {
      navigate({ to: '/app/assets/view', replace: true })
    }
  }, [navigate, location.pathname])

  return <Outlet />
}
