import { useRouter } from '@tanstack/react-router'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ExternalLink, FileText, Loader2, MoreVertical, Package, Pencil, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

export interface Asset {
  createdAt: string
  description: string | null
  documentUrl: string | null
  id: number
  name: string
  owner?: {
    id: string
    name: string
  }
  relationship?: string
  type: string
  value: number
}

interface AssetsTableProps {
  currentUserId?: string
  data: Array<Asset>
  emptyDescription?: string
  emptyTitle?: string
  isLoading?: boolean
  onDelete?: (id: number) => void | Promise<void>
  showOwner?: boolean
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    currency: 'MYR',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)

const formatTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

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

const createColumns = ({
  currentUserId,
  isDeleting,
  onDelete,
  onEdit,
  router,
  showOwner,
  t,
}: {
  currentUserId: string
  isDeleting: number | null
  onDelete: (id: number) => void
  onEdit: (asset: Asset) => void
  router: ReturnType<typeof useRouter>
  showOwner: boolean
  t: (key: string) => string
}): Array<ColumnDef<Asset>> => {
  const columns: Array<ColumnDef<Asset>> = [
    {
      accessorKey: 'name',
      header: t('assetsTable.asset'),
      cell: ({ row }) => {
        const asset = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <button
                onClick={() => router.navigate({ to: `/app/assets/view/${asset.id}` as any })}
                className="truncate text-left font-medium hover:text-primary hover:underline"
              >
                {asset.name}
              </button>
              <p className="truncate text-xs text-muted-foreground">{asset.description || t('assetsTable.noDescription')}</p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: t('assetsTable.type'),
      cell: ({ row }) => (
        <Badge className={cn('px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase', getAssetTypeBadgeClass(row.original.type))}>
          {formatTitleCase(row.original.type)}
        </Badge>
      ),
    },
    {
      accessorKey: 'value',
      header: t('assetsTable.value'),
      cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.value)}</span>,
    },
  ]

  if (showOwner) {
    columns.push({
      id: 'owner',
      header: t('assetsTable.owner'),
      cell: ({ row }) => {
        const asset = row.original
        const ownerName = asset.owner ? asset.owner.name : t('assetsTable.you')
        const relationship = asset.relationship ? formatTitleCase(asset.relationship) : null

        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{ownerName}</span>
            </div>
            {relationship ? (
              <p className="truncate pl-5 text-xs text-muted-foreground">{relationship}</p>
            ) : null}
          </div>
        )
      },
    })
  }

  columns.push({
    id: 'document',
    header: t('assetsTable.document'),
    cell: ({ row }) => {
      const asset = row.original
      if (!asset.documentUrl) {
        return <span className="text-sm text-muted-foreground">{t('assetsTable.noDocument')}</span>
      }
      return (
        <Button variant="ghost" size="sm" onClick={() => window.open(asset.documentUrl as string, '_blank')}>
          <FileText className="h-4 w-4" />
          {t('assetsTable.view')}
          <ExternalLink className="h-3 w-3" />
        </Button>
      )
    },
  })

  columns.push({
    id: 'actions',
    cell: ({ row }) => {
      const asset = row.original
      const isOwner = !asset.owner || asset.owner.id === currentUserId
      if (!isOwner) {
        return null
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="rounded-lg">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t('assetsTable.openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(asset)}>
              <Pencil className="h-4 w-4" />
              <span>{t('assetsTable.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(asset.id)}
              disabled={isDeleting === asset.id}
              className="text-destructive focus:text-destructive"
            >
              {isDeleting === asset.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>{isDeleting === asset.id ? t('assetsTable.deleting') : t('assetsTable.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  })

  return columns
}

export function AssetsTable({
  currentUserId = '',
  data,
  emptyDescription,
  emptyTitle,
  isLoading = false,
  onDelete,
  showOwner = false,
}: AssetsTableProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const handleEdit = (asset: Asset) => {
    router.navigate({ to: `/app/assets/edit/${asset.id}` as any })
  }

  const handleDelete = async (id: number) => {
    if (isDeleting) return

    setIsDeleting(id)
    try {
      await onDelete?.(id)
    } finally {
      setIsDeleting(null)
    }
  }

  const columns = createColumns({
    currentUserId,
    isDeleting,
    onDelete: handleDelete,
    onEdit: handleEdit,
    router,
    showOwner,
    t,
  })

  const resolvedEmptyTitle = emptyTitle || t('assetsTable.emptyTitle')
  const resolvedEmptyDescription = emptyDescription || t('assetsTable.emptyDescription')

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{t('assetsTable.loading')}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{resolvedEmptyTitle}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{resolvedEmptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {data.map((asset) => {
          const ownerName = asset.owner ? asset.owner.name : t('assetsTable.you')
          const relationship = asset.relationship ? formatTitleCase(asset.relationship) : null
          const isOwner = !asset.owner || asset.owner.id === currentUserId

          return (
            <div key={asset.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => router.navigate({ to: `/app/assets/view/${asset.id}` as any })}
                  className="min-w-0 text-left"
                >
                  <p className="truncate font-medium hover:text-primary">{asset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{asset.description || t('assetsTable.noDescription')}</p>
                </button>
                {isOwner ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="rounded-lg">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">{t('assetsTable.openMenu')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(asset)}>
                        <Pencil className="h-4 w-4" />
                        <span>{t('assetsTable.edit')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(asset.id)}
                        disabled={isDeleting === asset.id}
                        className="text-destructive focus:text-destructive"
                      >
                        {isDeleting === asset.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>{isDeleting === asset.id ? t('assetsTable.deleting') : t('assetsTable.delete')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className={cn('px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase', getAssetTypeBadgeClass(asset.type))}>
                  {formatTitleCase(asset.type)}
                </Badge>
                <span className="text-sm font-semibold">{formatCurrency(asset.value)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {showOwner ? `${ownerName}${relationship ? ` (${relationship})` : ''}` : ownerName}
                </p>
                {asset.documentUrl ? (
                  <Button variant="ghost" size="sm" onClick={() => window.open(asset.documentUrl as string, '_blank')}>
                    <FileText className="h-4 w-4" />
                    {t('assetsTable.view')}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
        <Table>
          <TableHeader className="bg-muted/35">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t('assetsTable.noAssetsFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
