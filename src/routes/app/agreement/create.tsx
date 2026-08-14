import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Loader2, X, FileText, Package, Users, Info, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useMemo, useRef } from 'react'
import { DistributionType } from '@/generated/prisma/enums'
import {
  calculateAutoFaraidDistribution,
  type FamilyMember,
  type BeneficiaryWithShare,
} from '@/lib/faraid/faraid-calculator'

export const Route = createFileRoute('/app/agreement/create')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch session
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  // Fetch assets
  const { data: assetsData } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await fetch('/api/asset')
      if (!response.ok) throw new Error('Failed to fetch assets')
      return response.json()
    },
  })

  // Fetch agreements to check which assets are already allocated
  const { data: agreementsData } = useQuery({
    queryKey: ['agreements'],
    queryFn: async () => {
      const response = await fetch('/api/agreement')
      if (!response.ok) throw new Error('Failed to fetch agreements')
      return response.json()
    },
  })

  // Fetch family members
  const { data: familyData } = useQuery({
    queryKey: ['familyMembers', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null
      const response = await fetch(`/api/family?userId=${session.user.id}`)
      if (!response.ok) throw new Error('Failed to fetch family members')
      return response.json()
    },
    enabled: !!session?.user?.id,
  })

  const assets = assetsData?.assets || []

  // Get IDs of assets that are already allocated in active agreements
  const allocatedAssetIds = useMemo(() => {
    const activeAgreements = agreementsData?.agreements?.filter(
      (agreement: any) => !['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(agreement.status)
    ) || []

    const assetIds = new Set<number>()
    activeAgreements.forEach((agreement: any) => {
      agreement.assets?.forEach((aa: any) => {
        assetIds.add(aa.assetId)
      })
    })

    return assetIds
  }, [agreementsData])
  const allMembers = useMemo(
    () => [...(familyData?.registered || []), ...(familyData?.nonRegistered || [])],
    [familyData?.registered, familyData?.nonRegistered]
  )

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    distributionType: 'FARAID' as DistributionType,
    effectiveDate: '',
    expiryDate: '',
  })

  // Selected assets as IDs
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([])

  // Beneficiaries: array of member IDs with their shares
  const [beneficiaries, setBeneficiaries] = useState<Array<{
    memberId: number
    type: 'registered' | 'non-registered'
    name: string
    relation: string
    sharePercentage: number
  }>>([])

  // Faraid calculation result
  const [faraidResult, setFaraidResult] = useState<BeneficiaryWithShare[] | null>(null)
  const [faraidDescription, setFaraidDescription] = useState<string>('')
  const [faraidWarnings, setFaraidWarnings] = useState<string[]>([])

  // Track the last calculated distribution type and member IDs to prevent infinite loops
  const faraidCalculationRef = useRef<{
    distributionType: string
    memberIds: string
  } | null>(null)

  // Auto-calculate Faraid distribution when distribution type changes to FARAID
  useEffect(() => {
    if (formData.distributionType === 'FARAID' && allMembers.length > 0) {
      // Create a stable key from member IDs
      const currentMemberIds = allMembers.map((m: any) => m.id).sort().join(',')

      // Check if we've already calculated for this exact set of members
      if (faraidCalculationRef.current?.memberIds === currentMemberIds &&
          faraidCalculationRef.current?.distributionType === formData.distributionType) {
        return // Skip - already calculated
      }

      // Convert family members to the format expected by the calculator
      const familyMembers: FamilyMember[] = allMembers.map((member: any) => ({
        id: member.id,
        type: member.type,
        name: member.name,
        relation: member.relation,
        email: member.email,
        icNumber: member.icNumber,
      }))

      const result = calculateAutoFaraidDistribution(familyMembers)
      setFaraidResult(result.beneficiaries)
      setFaraidDescription(result.description)
      setFaraidWarnings(result.warnings)

      // Set beneficiaries from Faraid calculation
      setBeneficiaries(
        result.beneficiaries.map((b) => ({
          memberId: b.memberId,
          type: b.type,
          name: b.name,
          relation: b.relation,
          sharePercentage: b.sharePercentage,
        }))
      )

      // Track this calculation
      faraidCalculationRef.current = {
        distributionType: formData.distributionType,
        memberIds: currentMemberIds,
      }
    } else if (formData.distributionType !== 'FARAID') {
      // Clear Faraid results when switching away from FARAID
      setFaraidResult(null)
      setFaraidDescription('')
      setFaraidWarnings([])
      faraidCalculationRef.current = null
    }
  }, [formData.distributionType, allMembers])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title: formData.title,
        description: formData.description || null,
        distributionType: formData.distributionType,
        effectiveDate: formData.effectiveDate || null,
        expiryDate: formData.expiryDate || null,
        assets: selectedAssetIds.map(assetId => ({ assetId })),
        beneficiaries: beneficiaries.map(b => ({
          familyMemberId: b.type === 'registered' ? b.memberId : undefined,
          nonRegisteredFamilyMemberId: b.type === 'non-registered' ? b.memberId : undefined,
          sharePercentage: b.sharePercentage,
          relation: b.relation,
        })),
      }

      const response = await fetch('/api/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create agreement')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement created successfully')
      router.navigate({ to: `/app/agreement/view/$id`, params: { id: data.agreement.id } })
    },
    onError: (error: Error) => {
      console.error('Error creating agreement:', error)
      toast.error(error.message || 'Failed to create agreement')
    },
  })

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleAsset = (assetId: number) => {
    // Prevent selecting assets that are already allocated in other agreements
    if (allocatedAssetIds.has(assetId)) {
      toast.error('This asset is already allocated in an active agreement')
      return
    }

    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    )
  }

  const addBeneficiary = (member: any) => {
    if (beneficiaries.find((b) => b.memberId === member.id)) {
      toast.error('This beneficiary is already added')
      return
    }

    setBeneficiaries([
      ...beneficiaries,
      {
        memberId: member.id,
        type: member.type,
        name: member.name,
        relation: member.relation,
        sharePercentage: 0,
      },
    ])
  }

  const removeBeneficiary = (memberId: number) => {
    setBeneficiaries(beneficiaries.filter((b) => b.memberId !== memberId))
  }

  const updateBeneficiaryShare = (memberId: number, share: number) => {
    setBeneficiaries(
      beneficiaries.map((b) =>
        b.memberId === memberId ? { ...b, sharePercentage: share } : b
      )
    )
  }

  const getTotalShare = () => {
    return beneficiaries.reduce((sum, b) => sum + b.sharePercentage, 0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!formData.distributionType) {
      toast.error('Distribution type is required')
      return
    }

    if (selectedAssetIds.length === 0) {
      toast.error('Please select at least one asset')
      return
    }

    if (beneficiaries.length === 0) {
      toast.error('Please add at least one beneficiary')
      return
    }

    // Check if shares add up to 100
    const totalShare = getTotalShare()
    const tolerance = formData.distributionType === 'FARAID' ? 5 : 0.1 // More tolerance for Faraid due to rounding
    if (Math.abs(totalShare - 100) > tolerance) {
      toast.error(`Total shares must equal 100%. Current total: ${totalShare.toFixed(1)}%`)
      return
    }

    createMutation.mutate()
  }

  const handleCancel = () => {
    router.navigate({ to: '/app/agreement/view' })
  }

  const formatAssetType = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Create Agreement</CardTitle>
              <CardDescription>Create a new Islamic asset distribution agreement</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup className="gap-6">
              {/* Title Field */}
              <Field className="group">
                <FieldLabel htmlFor="title" className="text-sm font-medium">
                  Agreement Title <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., My Family Inheritance Plan"
                    className="h-10 pl-10"
                  />
                </div>
              </Field>

              {/* Description Field */}
              <Field className="group">
                <FieldLabel htmlFor="description" className="text-sm font-medium">
                  Description
                </FieldLabel>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional description of this agreement"
                  rows={3}
                />
              </Field>

              {/* Distribution Type Field */}
              <Field className="group">
                <FieldLabel htmlFor="distributionType" className="text-sm font-medium">
                  Distribution Type <span className="text-destructive">*</span>
                </FieldLabel>
                <Select
                  value={formData.distributionType}
                  onValueChange={(value) => handleInputChange('distributionType', value as DistributionType)}
                >
                  <SelectTrigger id="distributionType" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FARAID">Faraid (Islamic Inheritance Law)</SelectItem>
                    <SelectItem value="HIBAH">Hibah (Gift)</SelectItem>
                    <SelectItem value="WASIYYAH">Wasiyyah (Will - up to 1/3)</SelectItem>
                    <SelectItem value="WAKAF">Wakaf (Endowment)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field className="group">
                  <FieldLabel htmlFor="effectiveDate" className="text-sm font-medium">
                    Effective Date
                  </FieldLabel>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
                    className="h-10"
                  />
                </Field>
                <Field className="group">
                  <FieldLabel htmlFor="expiryDate" className="text-sm font-medium">
                    Expiry Date
                  </FieldLabel>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    className="h-10"
                  />
                </Field>
              </div>

              {/* Assets Selection */}
              <Field className="group">
                <FieldLabel className="text-sm font-medium">
                  Select Assets <span className="text-destructive">*</span>
                </FieldLabel>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Choose the assets to distribute (must select at least one)
                </p>

                {assets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No assets found. Please add assets first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assets.map((asset: any) => {
                      const isSelected = selectedAssetIds.includes(asset.id)
                      const isAllocated = allocatedAssetIds.has(asset.id)
                      return (
                        <div
                          key={asset.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                            isAllocated
                              ? 'bg-muted/30 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'border-primary bg-primary/5 cursor-pointer'
                              : 'cursor-pointer hover:bg-muted/50'
                          }`}
                          onClick={() => !isAllocated && toggleAsset(asset.id)}
                        >
                          {isAllocated ? (
                            <Ban className="h-5 w-5 text-destructive shrink-0" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className={`font-medium ${isAllocated ? 'text-muted-foreground' : ''}`}>
                              {asset.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatAssetType(asset.type)} • ${asset.value.toLocaleString()}
                              {isAllocated && ' • Already allocated'}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAllocated}
                            onChange={() => !isAllocated && toggleAsset(asset.id)}
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </Field>

              {/* Beneficiaries */}
              <Field className="group">
                <FieldLabel className="text-sm font-medium">
                  {formData.distributionType === 'FARAID' ? 'Faraid Distribution' : 'Add Beneficiaries'}{' '}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  {formData.distributionType === 'FARAID'
                    ? 'Automatically calculated according to Islamic inheritance law (Faraid)'
                    : 'Add family members and specify their shares (must total 100%)'}
                </p>

                {/* FARAID: Auto-calculated distribution */}
                {formData.distributionType === 'FARAID' ? (
                  <div className="space-y-4">
                    {/* Faraid explanation */}
                    {faraidDescription && (
                      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm">
                          <p className="font-medium mb-1">Faraid Calculation</p>
                          <p className="text-muted-foreground">{faraidDescription}</p>
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {faraidWarnings.length > 0 && (
                      <div className="p-3 text-sm text-amber-700 bg-amber-50 border rounded-lg">
                        {faraidWarnings.map((warning, i) => (
                          <p key={i}>{warning}</p>
                        ))}
                      </div>
                    )}

                    {/* No eligible heirs message */}
                    {beneficiaries.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No eligible family members for Faraid distribution found.</p>
                        <p className="text-sm mt-1">
                          Please add family members with eligible relations (Father, Mother, Husband, Wife, Daughter, Son, etc.)
                        </p>
                      </div>
                    )}

                    {/* Faraid beneficiaries table (read-only) */}
                    {beneficiaries.length > 0 && (
                      <div className="border rounded-lg overflow-hidden bg-muted/30">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-4 text-sm font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-sm font-medium">Relation</th>
                              <th className="text-right py-2 px-4 text-sm font-medium">Faraid Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {faraidResult?.map((beneficiary) => (
                              <tr key={beneficiary.memberId} className="border-b last:border-b-0">
                                <td className="py-3 px-4 font-medium">{beneficiary.name}</td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {beneficiary.relation}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="font-medium">{beneficiary.shareFormatted}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t bg-muted/50">
                              <td className="py-2 px-4 font-medium" colSpan={2}>
                                Total
                              </td>
                              <td className="py-2 px-4 text-right font-medium">
                                {getTotalShare().toFixed(1)}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  /* NON-FARAID: Manual beneficiary selection */
                  <>
                    {/* Available family members */}
                    <div className="space-y-2 mb-4">
                      {allMembers.map((member: any) => {
                        const isAdded = beneficiaries.find((b) => b.memberId === member.id)
                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-3 border rounded-lg"
                          >
                            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {member.relation} {member.type === 'registered' ? `• ${member.email}` : `• ${member.icNumber}`}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isAdded ? 'secondary' : 'outline'}
                              onClick={() => !isAdded && addBeneficiary(member)}
                              disabled={!!isAdded}
                              className="shrink-0"
                            >
                              {isAdded ? 'Added' : 'Add'}
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Selected beneficiaries table */}
                    {beneficiaries.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left py-2 px-4 text-sm font-medium">Name</th>
                              <th className="text-left py-2 px-4 text-sm font-medium">Relation</th>
                              <th className="text-right py-2 px-4 text-sm font-medium">Share %</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {beneficiaries.map((beneficiary) => (
                              <tr key={beneficiary.memberId} className="border-b last:border-b-0">
                                <td className="py-2 px-4">{beneficiary.name}</td>
                                <td className="py-2 px-4 text-sm text-muted-foreground">
                                  {beneficiary.relation}
                                </td>
                                <td className="py-2 px-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={beneficiary.sharePercentage}
                                    onChange={(e) =>
                                      updateBeneficiaryShare(beneficiary.memberId, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-full max-w-28 text-right h-9"
                                  />
                                </td>
                                <td className="py-2 px-4">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBeneficiary(beneficiary.memberId)}
                                    className="text-destructive h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t bg-muted/50">
                              <td className="py-2 px-4 font-medium" colSpan={2}>
                                Total
                              </td>
                              <td className="py-2 px-4 text-right font-medium">
                                {getTotalShare().toFixed(1)}%
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                        {Math.abs(getTotalShare() - 100) > 0.1 && (
                          <div className="p-3 text-sm text-amber-700 bg-amber-50 border-t">
                            Total shares must equal 100%. Current: {getTotalShare().toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Field>
            </FieldGroup>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Agreement'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
