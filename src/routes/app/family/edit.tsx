import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2, PencilLine, User, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { FamilyMember } from '@/types/family'

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
import { FamilyRelation } from '@/lib/family/family-types'
import { isNonRegisteredFamilyMember, isRegisteredFamilyMember } from '@/types/family'

const formatRelationLabel = (relation: string) =>
  relation
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const Route = createFileRoute('/app/family/edit')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const routeState = router.state.location.state as { member?: FamilyMember } | undefined
  const member = routeState ? routeState.member : undefined

  const updateMutation = useMutation({
    mutationFn: async ({
      data,
      id,
      type,
    }: {
      data: any
      id: string
      type: string
    }) => {
      const response = await fetch(`/api/family?type=${type}&id=${id}`, {
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to update family member')
      }
      return response.json()
    },
    onError: (error: Error) => {
      console.error('Error updating family member:', error)
      toast.error(error.message || 'Failed to update family member')
    },
    onSuccess: () => {
      toast.success('Family member updated successfully')
      router.navigate({ to: '/app/family' })
    },
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (!member) return

    if (isNonRegisteredFamilyMember(member)) {
      const address = formData.get('address') as string
      const icNumber = formData.get('icNumber') as string
      const name = formData.get('name') as string
      const phoneNumber = formData.get('phoneNumber') as string
      const relation = formData.get('relation') as string

      if (!name || !icNumber || !relation) {
        toast.error('Please fill in all required fields')
        return
      }

      await updateMutation.mutateAsync({
        data: { address, icNumber, name, phoneNumber, relation },
        id: member.id.toString(),
        type: 'non-registered',
      })
      return
    }

    const relation = formData.get('relation') as string
    if (!relation) {
      toast.error('Please select a relationship')
      return
    }

    await updateMutation.mutateAsync({
      data: { relation },
      id: member.familyMemberUserId,
      type: 'registered',
    })
  }

  if (!member) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No family member selected.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.navigate({ to: '/app/family' })}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Family Members
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-gradient-to-r from-slate-100/70 via-background to-sky-50/50">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PencilLine className="h-5 w-5" />
              Edit Family Member
            </CardTitle>
            <CardDescription className="mt-1">
              Update relationship details and contact information.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.navigate({ to: '/app/family' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Family
          </Button>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-3">
            {isRegisteredFamilyMember(member) && member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="h-11 w-11 rounded-xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                {isRegisteredFamilyMember(member) ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{member.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {isRegisteredFamilyMember(member) ? member.email : `IC: ${member.icNumber}`}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isNonRegisteredFamilyMember(member) ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={member.name}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icNumber">IC Number *</Label>
                  <Input
                    id="icNumber"
                    name="icNumber"
                    defaultValue={member.icNumber}
                    placeholder="Enter IC number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relation-non-registered">Relationship *</Label>
                  <Select name="relation" defaultValue={member.relation} required>
                    <SelectTrigger id="relation-non-registered">
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

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    defaultValue={member.phoneNumber || ''}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={member.address || ''}
                    placeholder="Enter address"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="registered-name">Name</Label>
                  <Input
                    id="registered-name"
                    value={member.name}
                    disabled
                    className="bg-muted/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registered-email">Email</Label>
                  <Input
                    id="registered-email"
                    value={member.email}
                    disabled
                    className="bg-muted/60"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="relation-registered">Relationship *</Label>
                  <Select name="relation" defaultValue={member.relation} required>
                    <SelectTrigger id="relation-registered">
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
                  <p className="text-xs text-muted-foreground">
                    Registered user details are read-only. You can update the relationship only.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.navigate({ to: '/app/family' })}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
