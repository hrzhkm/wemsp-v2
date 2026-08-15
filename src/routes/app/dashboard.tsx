import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowRight, Bell, FileText, Loader2, Plus, TrendingUp, UserCheck, Users, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AgreementStatus } from '@/generated/prisma/enums'
import { authClient } from '@/lib/auth/authClient'
import { useLanguage } from '@/lib/i18n/context'

interface AssetSummary {
  id: number
  name: string
  type: string
  value: number
}

interface AssetsResponse {
  assets?: Array<AssetSummary>
}

interface FamilyMemberSummary {
  id: number | string
}

interface FamilyResponse {
  nonRegistered?: Array<FamilyMemberSummary>
  registered?: Array<FamilyMemberSummary>
}

interface AgreementSummary {
  assetCount: number
  createdAt: string
  id: string
  isBeneficiary: boolean
  isOwner: boolean
  status: AgreementStatus
  title: string
}

interface AgreementsResponse {
  agreements?: Array<AgreementSummary>
}

const getLocale = (language: 'en' | 'ms') => (language === 'ms' ? 'ms-MY' : 'en-MY')

const formatCurrency = (value: number, language: 'en' | 'ms') =>
  new Intl.NumberFormat(getLocale(language), {
    currency: 'MYR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)

const formatAssetType = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const formatDate = (value: string, language: 'en' | 'ms') =>
  new Date(value).toLocaleDateString(getLocale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const getAgreementTaskText = (
  agreement: AgreementSummary,
  t: (key: string) => string,
) => {
  if (agreement.isOwner && agreement.status === AgreementStatus.DRAFT) {
    return t('appDashboard.task.ownerDraft')
  }
  if (agreement.isOwner && agreement.status === AgreementStatus.PENDING_SIGNATURES) {
    return t('appDashboard.task.ownerPendingSignatures')
  }
  if (agreement.isOwner && agreement.status === AgreementStatus.PENDING_WITNESS) {
    return t('appDashboard.task.ownerPendingWitness')
  }
  if (agreement.isBeneficiary && agreement.status === AgreementStatus.PENDING_SIGNATURES) {
    return t('appDashboard.task.beneficiaryPendingSignatures')
  }
  return t('appDashboard.task.default')
}

export const Route = createFileRoute('/app/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const { language, t } = useLanguage()

  const { data: sessionData, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  const { data: assetsData, isLoading: isAssetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await fetch('/api/asset')
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      return response.json() as Promise<AssetsResponse>
    },
  })

  const userId = sessionData?.user.id
  const { data: familyData, isLoading: isFamilyLoading } = useQuery({
    enabled: !!userId,
    queryKey: ['familyMembers', userId],
    queryFn: async () => {
      if (!userId) return null
      const response = await fetch(`/api/family?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch family members')
      }
      return response.json() as Promise<FamilyResponse>
    },
  })

  const { data: agreementsData, isLoading: isAgreementsLoading } = useQuery({
    queryKey: ['agreements'],
    queryFn: async () => {
      const response = await fetch('/api/agreement')
      if (!response.ok) {
        throw new Error('Failed to fetch agreements')
      }
      return response.json() as Promise<AgreementsResponse>
    },
  })

  const isLoading =
    isSessionLoading ||
    isAssetsLoading ||
    isFamilyLoading ||
    isAgreementsLoading

  const assets = assetsData?.assets || []
  const agreements = agreementsData?.agreements || []
  const familyMembers = [
    ...(familyData?.registered || []),
    ...(familyData?.nonRegistered || []),
  ]

  const totalAssetValue = assets.reduce((sum, asset) => sum + asset.value, 0)
  const ownerAgreements = agreements.filter((agreement) => agreement.isOwner)
  const actionableOwnerStatuses: AgreementStatus[] = [
    AgreementStatus.DRAFT,
    AgreementStatus.PENDING_SIGNATURES,
    AgreementStatus.PENDING_WITNESS,
  ]
  const pendingActions = agreements.filter((agreement) =>
    (agreement.isOwner &&
      actionableOwnerStatuses.includes(agreement.status)) ||
    (agreement.isBeneficiary &&
      agreement.status === AgreementStatus.PENDING_SIGNATURES)
  )
  const recentAssets = [...assets]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
  const recentAgreements = [...agreements]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 4)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                {t('appDashboard.welcome')}
                {sessionData?.user.name ? `, ${sessionData.user.name}` : ''}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('appDashboard.subtitle')}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button className="w-full sm:w-auto" onClick={() => router.navigate({ to: '/app/agreement/create' })}>
                <Plus className="h-4 w-4" />
                {t('appDashboard.newAgreement')}
              </Button>
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => router.navigate({ to: '/app/assets/add' })}>
                <Plus className="h-4 w-4" />
                {t('appDashboard.addAsset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm lg:col-span-1">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <p className="text-lg font-semibold">{formatCurrency(totalAssetValue, language)}</p>
              <p className="text-xs text-muted-foreground">{assets.length} {t('appDashboard.totalAssets')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
                <FileText className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{agreements.length}</p>
              <p className="text-xs text-muted-foreground">{ownerAgreements.length} {t('appDashboard.asOwner')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
                <Bell className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{pendingActions.length}</p>
              <p className="text-xs text-muted-foreground">{t('appDashboard.pendingActions')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-700">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{familyMembers.length}</p>
              <p className="text-xs text-muted-foreground">{t('appDashboard.familyMembersLinked')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="order-2 border-border/70 lg:order-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              {t('appDashboard.actionRequired')}
            </CardTitle>
            <CardDescription>{t('appDashboard.actionRequiredDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingActions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {t('appDashboard.noUrgentActions')}
              </div>
            ) : (
              pendingActions.slice(0, 5).map((agreement) => (
                <div
                  key={agreement.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{agreement.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getAgreementTaskText(agreement, t)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      router.navigate({
                        params: { id: agreement.id },
                        to: '/app/agreement/view/$id',
                      })
                    }
                  >
                    {t('appDashboard.open')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="order-1 border-border/70 lg:order-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4" />
              {t('appDashboard.quickLinks')}
            </CardTitle>
            <CardDescription>{t('appDashboard.quickLinksDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to="/app/assets/view"
              className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 text-sm hover:bg-muted/40"
            >
              <span>{t('appDashboard.manageAssets')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/app/family/view"
              className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 text-sm hover:bg-muted/40"
            >
              <span>{t('appDashboard.updateFamily')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/app/agreement/view"
              className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 text-sm hover:bg-muted/40"
            >
              <span>{t('appDashboard.viewAgreements')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() =>
                router.navigate({
                  search: { onboarding: false, redirect: undefined },
                  to: '/app/profile/view',
                })
              }
              className="flex w-full items-center justify-between rounded-lg border border-border/70 p-2.5 text-left text-sm hover:bg-muted/40"
            >
              <span>{t('appDashboard.profile')}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {t('appDashboard.topAssets')}
            </CardTitle>
            <CardDescription>{t('appDashboard.topAssetsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {t('appDashboard.noAssets')}
              </div>
            ) : (
              recentAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{asset.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatAssetType(asset.type)}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(asset.value, language)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t('appDashboard.recentAgreements')}
            </CardTitle>
            <CardDescription>{t('appDashboard.recentAgreementsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAgreements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {t('appDashboard.noAgreements')}
              </div>
            ) : (
              recentAgreements.map((agreement) => (
                <button
                  key={agreement.id}
                  onClick={() =>
                    router.navigate({
                      params: { id: agreement.id },
                      to: '/app/agreement/view/$id',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-border/70 p-3 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{agreement.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agreement.assetCount} {t('appDashboard.assetsLabel')} • {formatDate(agreement.createdAt, language)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
