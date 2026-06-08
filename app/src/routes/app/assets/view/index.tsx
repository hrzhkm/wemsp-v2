import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Filter, Loader2, Plus, Search, Sparkles, Users, Wallet, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Asset } from '@/components/assets/assets-table'

import { AssetsTable } from '@/components/assets/assets-table'
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
import { authClient } from '@/lib/auth/auth-client'
import { useLanguage } from '@/lib/i18n/context'

interface AssetsResponse {
  assets?: Array<Asset>
  familyAssets?: Array<Asset>
}

const formatCurrency = (value: number, language: 'en' | 'ms') =>
  new Intl.NumberFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    currency: 'MYR',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)

const formatType = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const Route = createFileRoute('/app/assets/view/')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { language, t } = useLanguage()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all')

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  const currentUserId = session?.user.id || ''

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await fetch('/api/asset')
      if (!response.ok) {
        throw new Error(t('assetsPage.errors.fetchFailed'))
      }
      return response.json() as Promise<AssetsResponse>
    },
  })

  const assets = assetsData?.assets || []
  const familyAssets = assetsData?.familyAssets || []

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/asset/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(t('assetsPage.errors.deleteFailed'))
      }
      return response.json()
    },
    onError: (error) => {
      console.error('Error deleting asset:', error)
      toast.error(t('assetsPage.errors.deleteFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success(t('assetsPage.messages.deleteSuccess'))
    },
  })

  const allAssets = useMemo(() => [...assets, ...familyAssets], [assets, familyAssets])

  const typeOptions = useMemo(() => {
    const types = new Set<string>()
    for (const asset of allAssets) {
      types.add(asset.type)
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b))
  }, [allAssets])

  const filterAssets = (items: Array<Asset>) => {
    const normalizedQuery = query.trim().toLowerCase()
    return items.filter((asset) => {
      if (typeFilter !== 'all' && asset.type !== typeFilter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const ownerName = asset.owner ? asset.owner.name : ''
      return `${asset.name} ${asset.description || ''} ${asset.type} ${ownerName}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }

  const filteredAssets = filterAssets(assets)
  const filteredFamilyAssets = filterAssets(familyAssets)
  const hasActiveFilters = query.trim().length > 0 || typeFilter !== 'all'

  const totalValue = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.value, 0),
    [assets]
  )
  const familyValue = useMemo(
    () => familyAssets.reduce((sum, asset) => sum + asset.value, 0),
    [familyAssets]
  )

  const handleDelete = async (id: number) => {
    if (!confirm(t('assetsPage.confirmDelete'))) {
      return
    }
    await deleteMutation.mutateAsync(id)
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {t('assetsPage.overview')}
              </div>
              <CardTitle className="text-xl">{t('assetsPage.title')}</CardTitle>
              <CardDescription className="mt-1">
                {t('assetsPage.subtitle')}
              </CardDescription>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => router.navigate({ to: '/app/assets/add' })}>
              <Plus className="h-4 w-4" />
              {t('assetsPage.addAsset')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{assets.length}</p>
              <p className="text-xs text-muted-foreground">{t('assetsPage.stats.myAssets')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
                <WalletCards className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{familyAssets.length}</p>
              <p className="text-xs text-muted-foreground">{t('assetsPage.stats.familyAssets')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-lg font-semibold">{formatCurrency(totalValue, language)}</p>
              <p className="text-xs text-muted-foreground">{t('assetsPage.stats.myTotalValue')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-700">
                <Filter className="h-4 w-4" />
              </div>
              <p className="text-lg font-semibold">{formatCurrency(familyValue, language)}</p>
              <p className="text-xs text-muted-foreground">{t('assetsPage.stats.familyTotalValue')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('assetsPage.filterTitle')}</CardTitle>
              <CardDescription>{t('assetsPage.filterDescription')}</CardDescription>
            </div>
            {hasActiveFilters ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('')
                  setTypeFilter('all')
                }}
              >
                {t('assetsPage.clearFilters')}
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('assetsPage.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('assetsPage.assetType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('assetsPage.allTypes')}</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>{t('assetsPage.myAssetsTitle')}</CardTitle>
          <CardDescription>{t('assetsPage.myAssetsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AssetsTable
              data={filteredAssets}
              isLoading={isLoading}
              onDelete={handleDelete}
              currentUserId={currentUserId}
              showOwner={false}
              emptyTitle={hasActiveFilters ? t('assetsPage.emptyFilteredTitle') : t('assetsPage.emptyTitle')}
              emptyDescription={hasActiveFilters ? t('assetsPage.emptyFilteredDescription') : t('assetsPage.emptyDescription')}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('assetsPage.familyAssetsTitle')}
          </CardTitle>
          <CardDescription>{t('assetsPage.familyAssetsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetsTable
            data={filteredFamilyAssets}
            isLoading={isLoading}
            currentUserId={currentUserId}
            showOwner={true}
            emptyTitle={hasActiveFilters ? t('assetsPage.emptyFamilyFilteredTitle') : t('assetsPage.emptyFamilyTitle')}
            emptyDescription={
              hasActiveFilters
                ? t('assetsPage.emptyFilteredDescription')
                : t('assetsPage.emptyFamilyDescription')
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
