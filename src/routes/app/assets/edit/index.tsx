import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/app/assets/edit/')({
  component: RouteComponent,
})

function RouteComponent() {
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        // Redirect /app/assets to /app/assets/view
        if (location.pathname === '/app/assets/edit') {
        navigate({ to: '/app/assets/view', replace: true })
        }
    }, [navigate, location.pathname])

    return <Outlet />
}
