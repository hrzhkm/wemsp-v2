import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader2, Search, User, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { FamilyRelationType } from '@/lib/family/familyTypes'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FamilyRelation } from '@/lib/family/familyTypes'
import { formatMalaysianIc } from '@/lib/family/malaysianIc'

const MALAYSIAN_IC_REGEX = /^\d{12}$/

interface UserSearchResult {
  email: string
  existingRelation?: string
  id: string
  image?: string | null
  name: string
}

interface NonRegisteredSearchResult {
  address?: string | null
  icNumber: string
  id: number
  name: string
  phoneNumber?: string | null
}

type SearchResult =
  | { data: UserSearchResult; type: 'exists' }
  | { data: NonRegisteredSearchResult; type: 'non-registered' }
  | { data: UserSearchResult; type: 'registered' }
  | { data: UserSearchResult; type: 'self' }
  | { type: 'not-found' }

const formatRelationLabel = (relation: string) =>
  relation
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const validateMalaysianIC = (ic: string): boolean => MALAYSIAN_IC_REGEX.test(ic)

export const Route = createFileRoute('/app/family/add')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const [hasSearched, setHasSearched] = useState(false)
  const [icError, setIcError] = useState('')
  const [icNumber, setIcNumber] = useState('')
  const [relation, setRelation] = useState<FamilyRelationType | ''>('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)

  const searchMutation = useMutation({
    mutationFn: async (ic: string): Promise<SearchResult> => {
      const response = await fetch(`/api/family/search?icNumber=${encodeURIComponent(ic)}`)
      if (!response.ok) {
        throw new Error('Search failed')
      }
      return response.json() as Promise<SearchResult>
    },
    onError: () => {
      toast.error('Failed to search for IC number')
    },
    onSuccess: (result) => {
      setSearchResult(result)
      setHasSearched(true)
      setIcError('')
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: {
      memberData: any
      type: string
    }) => {
      const response = await fetch('/api/family', {
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to add family member')
      }
      return response.json()
    },
    onError: (error: Error) => {
      console.error('Error adding family member:', error)
      toast.error(error.message || 'Failed to add family member')
    },
    onSuccess: () => {
      toast.success('Family member added successfully')
      router.navigate({ to: '/app/family' })
    },
  })

  const showEditableFields = searchResult?.type === 'not-found'
  const showFormSection = hasSearched && searchResult?.type !== 'exists' && searchResult?.type !== 'self'
  const canSubmit = relation !== '' && !createMutation.isPending

  const handleIcChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 12)
    setIcNumber(value)

    if (value.length > 0 && value.length < 12) {
      setIcError('IC must be exactly 12 digits.')
      return
    }

    if (value.length === 12 && !validateMalaysianIC(value)) {
      setIcError('Invalid IC format.')
      return
    }

    setIcError('')
  }

  const handleSearch = () => {
    if (!icNumber.trim()) {
      toast.error('Please enter an IC number')
      return
    }

    if (!validateMalaysianIC(icNumber)) {
      setIcError('Invalid Malaysian IC format. Must be exactly 12 digits.')
      toast.error('Please enter a valid Malaysian IC number')
      return
    }

    setHasSearched(false)
    setRelation('')
    setSearchResult(null)
    searchMutation.mutate(icNumber)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!relation) {
      toast.error('Please select a relationship')
      return
    }

    if (searchResult?.type === 'registered') {
      await createMutation.mutateAsync({
        memberData: { familyMemberUserId: searchResult.data.id, relation },
        type: 'registered',
      })
      return
    }

    if (searchResult?.type === 'non-registered') {
      await createMutation.mutateAsync({
        memberData: {
          address: searchResult.data.address,
          icNumber: searchResult.data.icNumber,
          name: searchResult.data.name,
          phoneNumber: searchResult.data.phoneNumber,
          relation,
        },
        type: 'non-registered',
      })
      return
    }

    const formData = new FormData(event.currentTarget)
    const address = formData.get('address') as string
    const name = formData.get('name') as string
    const phoneNumber = formData.get('phoneNumber') as string

    if (!name) {
      toast.error('Please fill in the name field')
      return
    }

    await createMutation.mutateAsync({
      memberData: { address, icNumber, name, phoneNumber, relation },
      type: 'non-registered',
    })
  }

  const renderSearchResult = () => {
    if (!hasSearched || !searchResult) return null

    if (searchResult.type === 'exists') {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            {searchResult.data.image ? (
              <img
                src={searchResult.data.image}
                alt={searchResult.data.name}
                className="h-11 w-11 rounded-xl object-cover ring-1 ring-amber-200"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
                <User className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{searchResult.data.name}</p>
              <p className="truncate text-sm text-muted-foreground">{searchResult.data.email}</p>
              <p className="mt-1 text-xs text-amber-700">
                Already added as {searchResult.data.existingRelation ? formatRelationLabel(searchResult.data.existingRelation) : 'a family member'}.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => router.navigate({ to: '/app/family' })}
          >
            Back to Family List
          </Button>
        </div>
      )
    }

    if (searchResult.type === 'self') {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            {searchResult.data.image ? (
              <img
                src={searchResult.data.image}
                alt={searchResult.data.name}
                className="h-11 w-11 rounded-xl object-cover ring-1 ring-red-200"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500 text-white">
                <User className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{searchResult.data.name}</p>
              <p className="truncate text-sm text-muted-foreground">{searchResult.data.email}</p>
              <p className="mt-1 text-xs text-red-700">You cannot add yourself as a family member.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => router.navigate({ to: '/app/family' })}
          >
            Back to Family List
          </Button>
        </div>
      )
    }

    if (searchResult.type === 'registered') {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            {searchResult.data.image ? (
              <img
                src={searchResult.data.image}
                alt={searchResult.data.name}
                className="h-11 w-11 rounded-xl object-cover ring-1 ring-emerald-200"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <User className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{searchResult.data.name}</p>
              <p className="truncate text-sm text-muted-foreground">{searchResult.data.email}</p>
              <p className="mt-1 text-xs text-emerald-700">Registered user found.</p>
            </div>
          </div>
        </div>
      )
    }

    if (searchResult.type === 'non-registered') {
      return (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{searchResult.data.name}</p>
              <p className="truncate text-sm text-muted-foreground">IC: {searchResult.data.icNumber}</p>
              <p className="mt-1 text-xs text-sky-700">Matched an existing non-registered record.</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium">No existing record found</p>
            <p className="text-sm text-muted-foreground">Fill the details below to create a new non-registered family member.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">1. Search By IC Number</CardTitle>
            <CardDescription>Enter their Malaysian IC number to find an existing record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ic-number">IC Number</Label>
              <div className="relative">
                <Input
                  id="ic-number"
                  value={formatMalaysianIc(icNumber)}
                  onChange={handleIcChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearch()
                    }
                  }}
                  placeholder="Enter IC number"
                  className="pr-28"
                  maxLength={14}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || icNumber.length !== 12 || icError !== ''}
                  className="absolute right-1.5 top-1.5 h-7"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>
              {icError ? <p className="text-xs text-destructive">{icError}</p> : null}
            </div>

            {renderSearchResult()}
          </CardContent>
        </Card>

        {showFormSection ? (
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">2. Confirm Details</CardTitle>
              <CardDescription>Review or complete member information before adding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {searchResult?.type === 'not-found' ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Enter full name"
                      required
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="member-name">Name</Label>
                    <Input
                      id="member-name"
                      value={searchResult?.data.name}
                      disabled
                      className="bg-muted/60"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    defaultValue={searchResult?.type === 'non-registered' ? searchResult.data.phoneNumber || '' : ''}
                    placeholder="e.g., 0123456789"
                    disabled={!showEditableFields && searchResult?.type === 'registered'}
                    className={!showEditableFields && searchResult?.type === 'registered' ? 'bg-muted/60' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={searchResult?.type === 'non-registered' ? searchResult.data.address || '' : ''}
                    placeholder="Enter full address"
                    disabled={!showEditableFields && searchResult?.type === 'registered'}
                    className={!showEditableFields && searchResult?.type === 'registered' ? 'bg-muted/60' : ''}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="relation">Relationship *</Label>
                  <Select
                    name="relation"
                    value={relation}
                    onValueChange={(value) => setRelation(value as FamilyRelationType)}
                    required
                  >
                    <SelectTrigger id="relation">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FamilyRelation).map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatRelationLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.navigate({ to: '/app/family' })}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Add Family Member
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </form>
    </div>
  )
}
