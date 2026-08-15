import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Calendar, DollarSign, ExternalLink, FileText, Loader2, Package, Tag, User } from 'lucide-react'
import type { Asset } from '@/components/assets/assetsTable'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/authClient'
import { cn } from '@/lib/utils'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    currency: 'MYR',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const getAssetTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'PROPERTY':
      return 'bg-sky-600 text-white'
    case 'VEHICLE':
      return 'bg-emerald-600 text-white'
    case 'INVESTMENT':
      return 'bg-amber-600 text-white'
    default:
      return 'bg-slate-600 text-white'
  }
}

export const Route = createFileRoute('/app/assets/view/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const { id } = Route.useParams()

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  const currentUserId = session?.user.id || ''

  const { data: assetData, isLoading } = useQuery<{ asset: Asset }>({
    enabled: !!id,
    queryKey: ['asset', id],
    queryFn: async () => {
      const response = await fetch(`/api/asset/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch asset')
      }
      return response.json()
    },
  })

  const asset = assetData?.asset
  const isOwner = asset && (!asset.owner || asset.owner.id === currentUserId)

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!asset) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Asset not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.navigate({ to: '/app/assets' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Assets
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Asset Details</CardTitle>
              <CardDescription className="mt-1">
                {isOwner ? 'View and manage your asset information.' : 'View family member asset information.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <Button onClick={() => router.navigate({ to: `/app/assets/edit/${id}` as any })}>
                  Edit Asset
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => router.navigate({ to: '/app/assets' })}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Package className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold">{asset.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className={cn('px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase', getAssetTypeBadgeClass(asset.type))}>
                    {formatLabel(asset.type)}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(asset.createdAt)}
                  </span>
                  {!isOwner && asset.owner ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {asset.owner.name}
                      {asset.relationship ? ` (${formatLabel(asset.relationship)})` : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardContent className="pt-6">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Asset Name</p>
              <div className="relative">
                <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={asset.name} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Asset Type</p>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={formatLabel(asset.type)} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Value</p>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={formatCurrency(asset.value)} disabled className="bg-muted/50 pl-10 font-semibold" />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Created Date</p>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={formatDate(asset.createdAt)} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>

            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={asset.description || 'No description'} disabled className="bg-muted/50 pl-10" />
              </div>
            </div>

            {asset.documentUrl ? (
              <div className="md:col-span-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Document</p>
                <Button
                  variant="outline"
                  onClick={() => window.open(asset.documentUrl as string, '_blank')}
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4" />
                  View Document
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
