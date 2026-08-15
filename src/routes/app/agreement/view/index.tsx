import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Clock3, Crown, FileText, Filter, Loader2, Plus, Search, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgreementStatus, DistributionType } from '@/generated/prisma/enums'
import { authClient } from '@/lib/auth/authClient'
import { getStatusColor } from '@/lib/agreement/agreementWorkflow'
import { useLanguage } from '@/lib/i18n/context'

interface AgreementListItem {
  assetCount: number
  beneficiaryCount: number
  createdAt: string
  description: string | null
  distributionType: DistributionType
  id: string
  isBeneficiary: boolean
  isOwner: boolean
  ownerHasSigned: boolean
  signedBeneficiaryCount: number
  status: AgreementStatus
  title: string
  witnessedAt: string | null
}

interface AgreementsResponse {
  agreements?: Array<AgreementListItem>
}

const getStatusLabel = (status: AgreementStatus, t: (key: string) => string): string => {
  const labels: Record<AgreementStatus, string> = {
    ACTIVE: t('agreementPage.status.active'),
    CANCELLED: t('agreementPage.status.cancelled'),
    COMPLETED: t('agreementPage.status.completed'),
    DRAFT: t('agreementPage.status.draft'),
    EXPIRED: t('agreementPage.status.expired'),
    PENDING_SIGNATURES: t('agreementPage.status.pendingSignatures'),
    PENDING_WITNESS: t('agreementPage.status.pendingWitness'),
  }
  return labels[status] || status
}

const getDistributionTypeLabel = (type: DistributionType, t: (key: string) => string): string => {
  const labels: Record<DistributionType, string> = {
    FARAID: t('agreementPage.distribution.faraid'),
    HIBAH: t('agreementPage.distribution.hibah'),
    WAKAF: t('agreementPage.distribution.wakaf'),
    WASIYYAH: t('agreementPage.distribution.wasiyyah'),
  }
  return labels[type] || type
}

const formatDate = (value: string, language: 'en' | 'ms') =>
  new Date(value).toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const getSignatureProgress = (agreement: AgreementListItem, t: (key: string) => string): string => {
  const signed = agreement.signedBeneficiaryCount || 0
  const total = agreement.beneficiaryCount || 0
  const ownerSigned = agreement.ownerHasSigned
  const witnessed = !!agreement.witnessedAt

  const parts: Array<string> = []
  if (ownerSigned) parts.push(t('agreementPage.progress.ownerSigned'))
  parts.push(`${t('agreementPage.progress.beneficiaries')} ${signed}/${total}`)
  if (witnessed) parts.push(t('agreementPage.progress.witnessed'))
  return parts.join(' • ')
}

export const Route = createFileRoute('/app/agreement/view/')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { language, t } = useLanguage()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'beneficiary' | 'owner'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AgreementStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | DistributionType>('all')

  useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  const { data: agreementsData, isLoading } = useQuery({
    queryKey: ['agreements'],
    queryFn: async () => {
      const response = await fetch('/api/agreement')
      if (!response.ok) {
        throw new Error(t('agreementPage.errors.fetchFailed'))
      }
      return response.json() as Promise<AgreementsResponse>
    },
  })

  const agreements = agreementsData?.agreements || []

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/agreement/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(t('agreementPage.errors.deleteFailed'))
      }
      return response.json()
    },
    onError: (error) => {
      console.error('Error deleting agreement:', error)
      toast.error(t('agreementPage.errors.deleteFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success(t('agreementPage.messages.deleteSuccess'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/agreement/${id}/status`, {
        body: JSON.stringify({ action: 'cancel' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(t('agreementPage.errors.cancelFailed'))
      }
      return response.json()
    },
    onError: (error) => {
      console.error('Error cancelling agreement:', error)
      toast.error(t('agreementPage.errors.cancelFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success(t('agreementPage.messages.cancelSuccess'))
    },
  })

  const filteredAgreements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return agreements.filter((agreement) => {
      if (roleFilter === 'owner' && !agreement.isOwner) return false
      if (roleFilter === 'beneficiary' && !agreement.isBeneficiary) return false
      if (statusFilter !== 'all' && agreement.status !== statusFilter) return false
      if (typeFilter !== 'all' && agreement.distributionType !== typeFilter) return false

      if (!normalizedQuery) return true
      return `${agreement.title} ${agreement.description || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [agreements, query, roleFilter, statusFilter, typeFilter])

  const stats = useMemo(() => {
    const drafts = agreements.filter((agreement) => agreement.status === AgreementStatus.DRAFT).length
    const active = agreements.filter((agreement) => agreement.status === AgreementStatus.ACTIVE).length
    const actionableStatuses: AgreementStatus[] = [
      AgreementStatus.PENDING_SIGNATURES,
      AgreementStatus.PENDING_WITNESS,
    ]
    const pending = agreements.filter((agreement) =>
      actionableStatuses.includes(agreement.status)
    ).length
    const ownerCount = agreements.filter((agreement) => agreement.isOwner).length
    return { active, drafts, ownerCount, pending, total: agreements.length }
  }, [agreements])

  const hasActiveFilters =
    query.trim().length > 0 ||
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all'

  const handleDelete = async (id: string) => {
    if (!confirm(t('agreementPage.confirmDelete'))) {
      return
    }
    await deleteMutation.mutateAsync(id)
  }

  const handleCancel = async (id: string) => {
    if (!confirm(t('agreementPage.confirmCancel'))) {
      return
    }
    await cancelMutation.mutateAsync(id)
  }

  const renderRoleBadge = (agreement: AgreementListItem) => {
    if (agreement.isOwner) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Crown className="h-3 w-3" />
          {t('agreementPage.owner')}
        </Badge>
      )
    }
    if (agreement.isBeneficiary) {
      return (
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          {t('agreementPage.beneficiary')}
        </Badge>
      )
    }
    return <Badge variant="outline">{t('agreementPage.viewer')}</Badge>
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5" />
                {t('agreementPage.title')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('agreementPage.subtitle')}
              </CardDescription>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => router.navigate({ to: '/app/agreement/create' })}>
              <Plus className="h-4 w-4" />
              {t('agreementPage.newAgreement')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="col-span-2 rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm lg:col-span-1">
              <p className="text-2xl font-semibold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('agreementPage.stats.totalAgreements')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <p className="text-2xl font-semibold">{stats.ownerCount}</p>
              <p className="text-xs text-muted-foreground">{t('agreementPage.stats.asOwner')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <p className="text-2xl font-semibold">{stats.drafts}</p>
              <p className="text-xs text-muted-foreground">{t('agreementPage.stats.draft')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <p className="text-2xl font-semibold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">{t('agreementPage.stats.pendingActions')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <p className="text-2xl font-semibold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t('agreementPage.stats.active')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('agreementPage.filterTitle')}</CardTitle>
              <CardDescription>{t('agreementPage.filterDescription')}</CardDescription>
            </div>
            {hasActiveFilters ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('')
                  setRoleFilter('all')
                  setStatusFilter('all')
                  setTypeFilter('all')
                }}
              >
                {t('agreementPage.clearFilters')}
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_200px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('agreementPage.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value: 'all' | 'beneficiary' | 'owner') => setRoleFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('agreementPage.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agreementPage.allRoles')}</SelectItem>
                <SelectItem value="owner">{t('agreementPage.owner')}</SelectItem>
                <SelectItem value="beneficiary">{t('agreementPage.beneficiary')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: 'all' | AgreementStatus) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('agreementPage.statusLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agreementPage.allStatus')}</SelectItem>
                {Object.values(AgreementStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusLabel(status, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value: 'all' | DistributionType) => setTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('agreementPage.distributionLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('agreementPage.allTypes')}</SelectItem>
                {Object.values(DistributionType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getDistributionTypeLabel(type, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgreements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-14 text-center">
              <Filter className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {hasActiveFilters ? t('agreementPage.emptyFilteredTitle') : t('agreementPage.emptyTitle')}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {hasActiveFilters
                  ? t('agreementPage.emptyFilteredDescription')
                  : t('agreementPage.emptyDescription')}
              </p>
              {!hasActiveFilters ? (
                <Button className="mt-4" onClick={() => router.navigate({ to: '/app/agreement/create' })}>
                  <Plus className="h-4 w-4" />
                  {t('agreementPage.createAgreement')}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredAgreements.map((agreement) => {
                  const statusColors = getStatusColor(agreement.status)
                  const canDelete = agreement.isOwner && agreement.status === AgreementStatus.DRAFT
                  const cancellableStatuses: AgreementStatus[] = [
                    AgreementStatus.DRAFT,
                    AgreementStatus.PENDING_SIGNATURES,
                    AgreementStatus.PENDING_WITNESS,
                  ]
                  const canCancel = agreement.isOwner &&
                    cancellableStatuses.includes(agreement.status)

                  return (
                    <div key={agreement.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => router.navigate({ to: `/app/agreement/view/$id`, params: { id: agreement.id } })}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate font-medium hover:text-primary">{agreement.title}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{agreement.description || t('agreementPage.noDescription')}</p>
                        </button>
                        {renderRoleBadge(agreement)}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                          {getStatusLabel(agreement.status, t)}
                        </span>
                        <Badge variant="outline">{getDistributionTypeLabel(agreement.distributionType, t)}</Badge>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">{getSignatureProgress(agreement, t)}</p>

                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('agreementPage.assets')}: {agreement.assetCount}</span>
                        <span>{t('agreementPage.created')}: {formatDate(agreement.createdAt, language)}</span>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => router.navigate({ to: `/app/agreement/view/$id`, params: { id: agreement.id } })}
                        >
                          {t('agreementPage.view')}
                        </Button>
                        {canDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive sm:w-auto"
                            onClick={() => handleDelete(agreement.id)}
                          >
                            {t('agreementPage.delete')}
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive sm:w-auto"
                            onClick={() => handleCancel(agreement.id)}
                          >
                            {t('agreementPage.cancel')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                <table className="w-full">
                  <thead className="bg-muted/35">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.title')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.role')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.type')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.status')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.progress')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('agreementPage.table.assets')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{t('agreementPage.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgreements.map((agreement) => {
                      const statusColors = getStatusColor(agreement.status)
                      const canDelete = agreement.isOwner && agreement.status === AgreementStatus.DRAFT
                      const cancellableStatuses: AgreementStatus[] = [
                        AgreementStatus.DRAFT,
                        AgreementStatus.PENDING_SIGNATURES,
                        AgreementStatus.PENDING_WITNESS,
                      ]
                      const canCancel = agreement.isOwner &&
                        cancellableStatuses.includes(agreement.status)

                      return (
                        <tr key={agreement.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 align-top">
                            <div>
                              <button
                                onClick={() => router.navigate({ to: `/app/agreement/view/$id`, params: { id: agreement.id } })}
                                className="font-medium hover:text-primary hover:underline"
                              >
                                {agreement.title}
                              </button>
                              {agreement.description ? (
                                <p className="max-w-xs truncate text-sm text-muted-foreground">{agreement.description}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">{renderRoleBadge(agreement)}</td>
                          <td className="px-4 py-3 align-top text-sm">{getDistributionTypeLabel(agreement.distributionType, t)}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                              {getStatusLabel(agreement.status, t)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-muted-foreground">{getSignatureProgress(agreement, t)}</td>
                          <td className="px-4 py-3 align-top text-sm">{agreement.assetCount}</td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.navigate({ to: `/app/agreement/view/$id`, params: { id: agreement.id } })}
                              >
                                {t('agreementPage.view')}
                              </Button>
                              {canDelete ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(agreement.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {t('agreementPage.delete')}
                                </Button>
                              ) : null}
                              {canCancel ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancel(agreement.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {t('agreementPage.cancel')}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isLoading && filteredAgreements.length > 0 ? (
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {t('agreementPage.showing')} {filteredAgreements.length} {t('agreementPage.of')} {agreements.length} {t('agreementPage.agreements')}
        </div>
      ) : null}
    </div>
  )
}
