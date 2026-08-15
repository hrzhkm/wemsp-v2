import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Filter, Loader2, Plus, RefreshCcw, Search, UserCheck, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { FamilyRelationType } from '@/lib/family/family-types'
import type { FamilyMember } from '@/types/family'

import { FamilyMembersTable } from '@/components/family/family-members-table'
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
import { isRegisteredFamilyMember } from '@/types/family'

interface FamilyResponse {
  registered?: Array<FamilyMember>
  nonRegistered?: Array<FamilyMember>
}

export const Route = createFileRoute('/app/family/view')({
  component: RouteComponent,
})

function formatRelationLabel(relation: string) {
  return relation
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [memberTypeFilter, setMemberTypeFilter] = useState<'all' | 'non-registered' | 'registered'>('all')
  const [query, setQuery] = useState('')
  const [relationFilter, setRelationFilter] = useState<'all' | FamilyRelationType>('all')

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  const userId = session?.user.id

  const { data: familyData, isLoading: familyLoading } = useQuery({
    enabled: !!userId,
    queryKey: ['familyMembers', userId],
    queryFn: async () => {
      if (!userId) return null
      const response = await fetch(`/api/family?userId=${userId}`)
      if (!response.ok) {
        throw new Error(t('familyPage.errors.fetchFailed'))
      }
      return response.json() as Promise<FamilyResponse>
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string | number; type: string }) => {
      const response = await fetch(`/api/family?type=${type}&id=${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(t('familyPage.errors.deleteFailed'))
      }
      return response.json()
    },
    onError: (error) => {
      console.error('Error deleting family member:', error)
      toast.error(t('familyPage.errors.deleteFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['familyMembers', userId] })
      toast.success(t('familyPage.messages.deleteSuccess'))
    },
  })

  const familyMembers = useMemo(() => {
    const members: Array<FamilyMember> = []
    if (familyData?.registered) {
      members.push(...familyData.registered)
    }
    if (familyData?.nonRegistered) {
      members.push(...familyData.nonRegistered)
    }
    return members
  }, [familyData])

  const relationOptions = useMemo(() => {
    const options = new Set<FamilyRelationType>()
    for (const member of familyMembers) {
      options.add(member.relation)
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b))
  }, [familyMembers])

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return familyMembers.filter((member) => {
      if (memberTypeFilter !== 'all' && member.type !== memberTypeFilter) {
        return false
      }

      if (relationFilter !== 'all' && member.relation !== relationFilter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const contactValue = isRegisteredFamilyMember(member)
        ? member.email || ''
        : `${member.phoneNumber || ''} ${member.address || ''} ${member.icNumber || ''}`

      return `${member.name} ${contactValue} ${member.relation}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [familyMembers, memberTypeFilter, query, relationFilter])

  const stats = useMemo(() => {
    const registeredCount = familyMembers.filter((member) => member.type === 'registered').length
    const nonRegisteredCount = familyMembers.length - registeredCount
    const uniqueRelations = new Set(familyMembers.map((member) => member.relation)).size
    return {
      nonRegisteredCount,
      registeredCount,
      total: familyMembers.length,
      uniqueRelations,
    }
  }, [familyMembers])

  const hasActiveFilters = query.trim().length > 0 || memberTypeFilter !== 'all' || relationFilter !== 'all'

  const handleDelete = async (type: string, id: string | number) => {
    if (!confirm(t('familyPage.confirmDelete'))) {
      return
    }
    await deleteMutation.mutateAsync({ id, type })
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['familyMembers', userId] })
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{t('familyPage.title')}</CardTitle>
              <CardDescription className="mt-1">
                {t('familyPage.subtitle')}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button className="w-full sm:w-auto" variant="outline" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4" />
                {t('familyPage.refresh')}
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => router.navigate({ to: '/app/family/add' })}>
                <Plus className="h-4 w-4" />
                {t('familyPage.addMember')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('familyPage.stats.totalMembers')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
                <UserCheck className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{stats.registeredCount}</p>
              <p className="text-xs text-muted-foreground">{t('familyPage.stats.registeredUsers')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-700">
                <UserX className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{stats.nonRegisteredCount}</p>
              <p className="text-xs text-muted-foreground">{t('familyPage.stats.nonRegisteredUsers')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
                <Filter className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold">{stats.uniqueRelations}</p>
              <p className="text-xs text-muted-foreground">{t('familyPage.stats.relationTypes')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('familyPage.directoryTitle')}</CardTitle>
              <CardDescription>{t('familyPage.directoryDescription')}</CardDescription>
            </div>
            {hasActiveFilters ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMemberTypeFilter('all')
                  setQuery('')
                  setRelationFilter('all')
                }}
              >
                {t('familyPage.clearFilters')}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('familyPage.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select
              value={memberTypeFilter}
              onValueChange={(value: 'all' | 'non-registered' | 'registered') => setMemberTypeFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('familyPage.memberType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('familyPage.allTypes')}</SelectItem>
                <SelectItem value="registered">{t('familyPage.registered')}</SelectItem>
                <SelectItem value="non-registered">{t('familyPage.nonRegistered')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={relationFilter}
              onValueChange={(value: 'all' | FamilyRelationType) => setRelationFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('familyPage.relation')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('familyPage.allRelations')}</SelectItem>
                {relationOptions.map((relation) => (
                  <SelectItem key={relation} value={relation}>
                    {formatRelationLabel(relation)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <FamilyMembersTable
            data={filteredMembers}
            isLoading={familyLoading}
            onDelete={handleDelete}
            emptyDescription={
              hasActiveFilters
                ? t('familyPage.emptyFilteredDescription')
                : t('familyPage.emptyDescription')
            }
            emptyTitle={
              hasActiveFilters ? t('familyPage.emptyFilteredTitle') : t('familyPage.emptyTitle')
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
