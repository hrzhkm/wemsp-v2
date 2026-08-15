import { createFileRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/app/profile/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    onboarding: typeof search.onboarding === 'boolean'
      ? search.onboarding
      : search.onboarding === 'true',
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
})

function RouteComponent() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = Route.useSearch()

  // Check if coming from onboarding flow
  const isOnboarding = searchParams.onboarding
  const redirectPath = searchParams.redirect

  useEffect(() => {
    // Redirect /app/profile to /app/profile/view, or to edit if onboarding
    if (location.pathname === '/app/profile') {
      if (isOnboarding) {
        navigate({
          to: '/app/profile/edit',
          search: { onboarding: true, redirect: redirectPath },
          replace: true,
        })
      } else {
        navigate({ to: '/app/profile/view', replace: true })
      }
    }
  }, [navigate, location.pathname, isOnboarding, redirectPath])

  return <Outlet />
}
