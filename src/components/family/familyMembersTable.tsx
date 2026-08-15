import { useRouter } from '@tanstack/react-router'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Loader2, MoreVertical, Pencil, Trash2, User, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { FamilyMember } from '@/types/family'

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
import {
  isNonRegisteredFamilyMember,
  isRegisteredFamilyMember,
} from '@/types/family'
import { useLanguage } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

interface FamilyMembersTableProps {
  data: Array<FamilyMember>
  isLoading?: boolean
  onDelete?: (type: string, id: string | number) => void | Promise<void>
  emptyTitle?: string
  emptyDescription?: string
}

const formatRelation = (relation: string) =>
  relation
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const createColumns = (
  onEdit: (member: FamilyMember) => void,
  onDelete: (type: string, id: string | number) => void,
  isDeleting: string | number | null,
  t: (key: string) => string,
): Array<ColumnDef<FamilyMember>> => [
  {
    accessorKey: 'name',
    header: t('familyTable.name'),
    cell: ({ row }) => {
      const member = row.original
      return (
        <div className="flex items-center gap-2">
          {isRegisteredFamilyMember(member) && member.image ? (
            <img
              src={member.image}
              alt={member.name}
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/5"
            />
          ) : (
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl text-xs font-medium',
                isNonRegisteredFamilyMember(member)
                  ? 'bg-muted text-muted-foreground ring-1 ring-border'
                  : 'bg-primary/12 text-primary ring-1 ring-primary/25'
              )}
            >
              {isNonRegisteredFamilyMember(member) ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{member.name}</p>
            <p className="truncate text-xs text-muted-foreground">{formatRelation(member.relation)}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'relation',
    header: t('familyTable.relationship'),
    cell: ({ row }) => <span>{formatRelation(row.original.relation)}</span>,
  },
  {
    id: 'type',
    header: t('familyTable.type'),
    cell: ({ row }) => {
      const type = row.original.type
      return (
        <Badge
          variant={type === 'registered' ? 'default' : 'secondary'}
          className={cn('px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase', type === 'registered' && 'bg-emerald-600 text-white')}
        >
          {type === 'registered' ? t('familyTable.registered') : t('familyTable.nonRegistered')}
        </Badge>
      )
    },
  },
  {
    id: 'contact',
    header: t('familyTable.contact'),
    cell: ({ row }) => {
      const member = row.original
      if (isNonRegisteredFamilyMember(member)) {
        return (
          <div className="text-sm text-muted-foreground">
            {member.phoneNumber || member.address || '-'}
          </div>
        )
      }
      return (
        <div className="text-sm text-muted-foreground">{member.email}</div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const member = row.original
      const id = isRegisteredFamilyMember(member) ? member.familyMemberUserId : member.id

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="rounded-lg">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t('familyTable.openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(member)}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>{t('familyTable.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(member.type, id)}
              disabled={isDeleting === id}
              className="text-destructive focus:text-destructive"
            >
              {isDeleting === id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              <span>{isDeleting === id ? t('familyTable.deleting') : t('familyTable.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function FamilyMembersTable({
  data,
  isLoading = false,
  onDelete,
  emptyTitle,
  emptyDescription,
}: FamilyMembersTableProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isDeleting, setIsDeleting] = useState<string | number | null>(null)

  const handleEdit = (member: FamilyMember) => {
    router.navigate({
      to: '/app/family/edit',
      // @ts-expect-error - TanStack Router state extension
      state: { member },
    })
  }

  const handleDelete = async (type: string, id: string | number) => {
    if (isDeleting) return

    setIsDeleting(id)
    try {
      await onDelete?.(type, id)
    } finally {
      setIsDeleting(null)
    }
  }

  const columns = createColumns(handleEdit, handleDelete, isDeleting, t)
  const resolvedEmptyTitle = emptyTitle || t('familyTable.emptyTitle')
  const resolvedEmptyDescription = emptyDescription || t('familyTable.emptyDescription')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{t('familyTable.loading')}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <UserPlus className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{resolvedEmptyTitle}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{resolvedEmptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {data.map((member) => {
          const memberId = isRegisteredFamilyMember(member) ? member.familyMemberUserId : member.id
          return (
            <div key={`${member.type}-${memberId}`} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {isRegisteredFamilyMember(member) && member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', isRegisteredFamilyMember(member) ? 'bg-primary/12 text-primary ring-primary/25' : 'bg-muted text-muted-foreground ring-border')}>
                      {isRegisteredFamilyMember(member) ? <User className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatRelation(member.relation)}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">{t('familyTable.openMenu')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(member)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>{t('familyTable.edit')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(member.type, memberId)}
                      disabled={isDeleting === memberId}
                      className="text-destructive focus:text-destructive"
                    >
                      {isDeleting === memberId ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      <span>{isDeleting === memberId ? t('familyTable.deleting') : t('familyTable.delete')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge
                  variant={member.type === 'registered' ? 'default' : 'secondary'}
                  className={cn('px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase', member.type === 'registered' && 'bg-emerald-600 text-white')}
                >
                  {member.type === 'registered' ? t('familyTable.registered') : t('familyTable.nonRegistered')}
                </Badge>
                <p className="truncate text-xs text-muted-foreground">
                  {isRegisteredFamilyMember(member)
                    ? member.email
                    : member.phoneNumber || member.address || t('familyTable.noContactInfo')}
                </p>
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
                  {t('familyTable.noMembersFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
