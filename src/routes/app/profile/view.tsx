import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AlertTriangle, Calendar, CheckCircle2, Clock, IdCard, Mail, MapPin, Phone, Shield, Sparkles, UserCircle2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { authClient } from '@/lib/auth/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/profile/view')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    onboarding:
      typeof search.onboarding === 'boolean'
        ? search.onboarding
        : search.onboarding === 'true',
    redirect:
      typeof search.redirect === 'string'
        ? search.redirect
        : undefined,
  }),
})

function getInitials(name: string, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((segment) => segment[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email.charAt(0).toUpperCase() || 'U'
}

function RouteComponent() {
  const router = useRouter()
  const { language, t } = useLanguage()
  const searchParams = Route.useSearch()
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [redirectPath, setRedirectPath] = useState<string | undefined>(undefined)

  const { data: session, isPending, refetch: refetchSession } = authClient.useSession()
  const user = session?.user

  useEffect(() => {
    refetchSession()
  }, [refetchSession])

  useEffect(() => {
    if (!searchParams.onboarding) return

    setIsOnboarding(true)
    setRedirectPath(searchParams.redirect)
    router.navigate({
      replace: true,
      search: { onboarding: false, redirect: undefined },
      to: '.',
    })
  }, [router, searchParams])

  const profileCompletion = useMemo(() => {
    if (!user) return 0
    const fields = [
      user.name,
      user.email,
      (user as any).icNumber,
      (user as any).phoneNumber,
      (user as any).address,
    ]
    const filledCount = fields.filter(Boolean).length
    return Math.round((filledCount / fields.length) * 100)
  }, [user])

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t('profilePage.accessDenied')}</h2>
          <p className="text-muted-foreground">{t('profilePage.accessDeniedDescription')}</p>
        </CardContent>
      </Card>
    )
  }

  const createdAt = new Date((user as any).createdAt || Date.now())
  const updatedAt = new Date((user as any).updatedAt || Date.now())
  const isEmailVerified = Boolean((user as any).emailVerified)

  return (
    <div className="space-y-4">
      {isOnboarding ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">{t('profilePage.completeProfileTitle')}</h3>
            <p className="mt-1 text-sm text-amber-700">
              {t('profilePage.completeProfileDescription')}
            </p>
          </div>
        </div>
      ) : null}

      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{t('profilePage.title')}</CardTitle>
              <CardDescription className="mt-1">
                {t('profilePage.subtitle')}
              </CardDescription>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() =>
                router.navigate({
                  search: isOnboarding
                    ? { onboarding: true, redirect: redirectPath }
                    : { onboarding: false, redirect: undefined },
                  to: '/app/profile/edit',
                })
              }
            >
              {t('profilePage.editProfile')}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.image || undefined} alt={user.name || t('profilePage.user')} />
                <AvatarFallback className="text-xl font-semibold">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h2 className="truncate text-2xl font-semibold">{user.name || t('profilePage.user')}</h2>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{user.email}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium',
                      isEmailVerified
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    )}
                  >
                    {isEmailVerified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {isEmailVerified ? t('profilePage.verified') : t('profilePage.unverified')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {t('profilePage.joined')} {createdAt.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">{t('profilePage.profileCompletion')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-primary">{profileCompletion}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">{t('profilePage.personalInfoTitle')}</CardTitle>
          <CardDescription>{t('profilePage.personalInfoDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.fullName')}</p>
              <div className="relative">
                <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={user.name || ''} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.emailAddress')}</p>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={user.email} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.icNumber')}</p>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={(user as any).icNumber || ''} placeholder={t('profilePage.notProvided')} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.phoneNumber')}</p>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={(user as any).phoneNumber || ''} placeholder={t('profilePage.notProvided')} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.address')}</p>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={(user as any).address || ''} placeholder={t('profilePage.notProvided')} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            {t('profilePage.accountDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t('profilePage.userId')}</p>
            <p className="truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">{user.id}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t('profilePage.created')}
            </p>
            <p className="text-sm">
              {createdAt.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              {t('profilePage.lastUpdated')}
            </p>
            <p className="text-sm">
              {updatedAt.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
