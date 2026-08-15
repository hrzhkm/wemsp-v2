import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, IdCard, Loader2, Mail, MapPin, Phone, User, UserCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth/authClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface NonRegisteredData {
  addedBy: {
    email: string
    id: string
    name: string
  }
  address: string | null
  icNumber: string
  id: number
  name: string
  phoneNumber: string | null
  relation: string
}

export const Route = createFileRoute('/app/profile/edit')({
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

const formatRelation = (relation: string) =>
  relation
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = Route.useSearch()
  const [confirmClaim, setConfirmClaim] = useState(false)
  const [formData, setFormData] = useState({
    address: '',
    email: '',
    icNumber: '',
    name: '',
    phoneNumber: '',
  })
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [nonRegisteredData, setNonRegisteredData] = useState<Array<NonRegisteredData> | null>(null)
  const [redirectPath, setRedirectPath] = useState<string | undefined>(undefined)
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false)

  const { data: session, isPending, refetch: refetchSession } = authClient.useSession()
  const user = session?.user

  useEffect(() => {
    if (!searchParams.onboarding) return

    setIsOnboarding(true)
    setRedirectPath(searchParams.redirect)
    router.navigate({
      replace: true,
      search: {},
      to: '.',
    })
  }, [router, searchParams])

  useEffect(() => {
    if (!user) return

    setFormData({
      address: (user as any).address || '',
      email: user.email || '',
      icNumber: (user as any).icNumber || '',
      name: user.name || '',
      phoneNumber: (user as any).phoneNumber || '',
    })
  }, [user])

  const updateProfileMutation = useMutation({
    mutationFn: async (claimNonRegistered = false) => {
      const response = await fetch('/api/user/profile', {
        body: JSON.stringify({
          address: formData.address,
          claimNonRegistered,
          icNumber: formData.icNumber,
          name: formData.name,
          phoneNumber: formData.phoneNumber,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }
      return data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile')
    },
    onSuccess: async (data) => {
      if (data.requiresClaim) {
        setNonRegisteredData(data.nonRegisteredData)
        setShowClaimConfirmation(true)
        return
      }

      toast.success('Profile updated successfully')
      setConfirmClaim(false)
      setNonRegisteredData(null)
      setShowClaimConfirmation(false)

      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey[0] as string
          return queryKey.startsWith('better-auth') || (typeof queryKey === 'string' && queryKey.includes('session'))
        },
      })

      await refetchSession()
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (isOnboarding) {
        if (redirectPath) {
          router.navigate({ to: redirectPath })
        } else {
          router.navigate({ search: { onboarding: false, redirect: undefined }, to: '/app/profile' })
        }
      } else {
        router.navigate({ search: { onboarding: false, redirect: undefined }, to: '/app/profile' })
      }
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!formData.icNumber.trim()) {
      toast.error('IC number is required')
      return
    }
    if (formData.icNumber.length !== 12) {
      toast.error('IC number must be exactly 12 digits')
      return
    }
    if (!formData.phoneNumber.trim()) {
      toast.error('Phone number is required')
      return
    }
    if (!formData.address.trim()) {
      toast.error('Address is required')
      return
    }

    updateProfileMutation.mutate(false)
  }

  const handleConfirmClaim = () => {
    if (!confirmClaim) {
      toast.error('Please confirm this is your information')
      return
    }
    updateProfileMutation.mutate(true)
  }

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <IdCard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to edit your profile.</p>
        </CardContent>
      </Card>
    )
  }

  if (showClaimConfirmation && nonRegisteredData) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <h3 className="font-semibold text-blue-900">We Found Your Information</h3>
            <p className="mt-1 text-sm text-blue-700">
              A family member has already added your IC number. Please verify the records below.
            </p>
          </div>
        </div>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Verify Identity
            </CardTitle>
            <CardDescription>Confirm these records belong to you before linking accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nonRegisteredData.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Added by:</span>
                  <span className="font-medium">{item.addedBy.name}</span>
                  <Badge variant="secondary">{formatRelation(item.relation)}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{item.icNumber}</span>
                  </div>
                  {item.phoneNumber ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{item.phoneNumber}</span>
                    </div>
                  ) : null}
                  {item.address ? (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{item.address}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="mb-2 text-sm font-medium">Your Submitted Information</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Name:</span> {formData.name}</p>
                <p><span className="text-muted-foreground">IC:</span> {formData.icNumber}</p>
                <p><span className="text-muted-foreground">Phone:</span> {formData.phoneNumber}</p>
                <p><span className="text-muted-foreground">Address:</span> {formData.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
              <Checkbox
                checked={confirmClaim}
                id="confirm-claim"
                onCheckedChange={(checked: boolean | 'indeterminate') => setConfirmClaim(checked === true)}
              />
              <label htmlFor="confirm-claim" className="cursor-pointer text-sm leading-relaxed">
                I confirm this IC number belongs to me, and I want to link my account with these family records.
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={() => {
                  setConfirmClaim(false)
                  setNonRegisteredData(null)
                  setShowClaimConfirmation(false)
                }}
                disabled={updateProfileMutation.isPending}
              >
                Cancel
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleConfirmClaim} disabled={!confirmClaim || updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm & Link Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isOnboarding ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">Complete Your Profile to Continue</h3>
            <p className="mt-1 text-sm text-amber-700">
              Fill your details below to continue to the requested page.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="border-border/70 bg-gradient-to-r from-slate-100/70 via-background to-sky-50/50">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">
              {isOnboarding ? 'Complete Profile' : 'Edit Profile'}
            </CardTitle>
            <CardDescription className="mt-1">
              Update your identity and contact information.
            </CardDescription>
          </div>
          {!isOnboarding ? (
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
              onClick={() => router.navigate({ search: { onboarding: false, redirect: undefined }, to: '/app/profile' })}
              disabled={updateProfileMutation.isPending}
            >
              Cancel
            </Button>
          ) : null}
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup className="gap-4 md:grid md:grid-cols-2">
              <Field className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="name">Full Name *</FieldLabel>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter your full name"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" value={formData.email} disabled className="cursor-not-allowed bg-muted/50 pl-10" />
                </div>
              </Field>

              <Field className="space-y-2">
                <FieldLabel htmlFor="icNumber">IC Number *</FieldLabel>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="icNumber"
                    value={formData.icNumber}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '').slice(0, 12)
                      setFormData((prev) => ({ ...prev, icNumber: value }))
                    }}
                    maxLength={12}
                    placeholder="12-digit IC number"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2">
                <FieldLabel htmlFor="phoneNumber">Phone Number *</FieldLabel>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(event) => setFormData((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                    placeholder="+60123456789"
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field className="space-y-2 md:col-span-2">
                <FieldLabel htmlFor="address">Address *</FieldLabel>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Enter your residential address"
                    className="pl-10"
                  />
                </div>
              </Field>
            </FieldGroup>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!isOnboarding ? (
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  variant="outline"
                  onClick={() => router.navigate({ search: { onboarding: false, redirect: undefined }, to: '/app/profile' })}
                  disabled={updateProfileMutation.isPending}
                >
                  Cancel
                </Button>
              ) : null}
              <Button className="w-full sm:w-auto" type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
