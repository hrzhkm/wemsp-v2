import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Package,
  Scale,
  Signature,
  Tag,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  AgreementStatus,
  DistributionType,
} from '@/generated/prisma/enums'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/authClient'
import { getStatusColor, getStatusDescription } from '@/lib/agreement/agreementWorkflow'

export const Route = createFileRoute('/app/agreement/view/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = Route.useParams()

  // Fetch session
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const data = await authClient.getSession()
      return data.data
    },
  })

  // Fetch agreement
  const { data: agreementData, isLoading } = useQuery({
    queryKey: ['agreement', id],
    queryFn: async () => {
      const response = await fetch(`/api/agreement/${id}`)
      if (!response.ok) throw new Error('Failed to fetch agreement')
      return response.json()
    },
    enabled: !!id,
  })

  const agreement = agreementData?.agreement

  // Sign as owner mutation
  const signOwnerMutation = useMutation({
    mutationFn: async (submit: boolean) => {
      const response = await fetch(`/api/agreement/${id}/sign/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submit }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign agreement')
      }
      return response.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['agreement', id] })
      queryClient.invalidateQueries({ queryKey: ['agreements'] })

      const txHash = data?.onChain?.ownerSignatureTxHash
      if (txHash) {
        const shortTx = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`
        toast.success(`Agreement signed on-chain (${shortTx})`)
      } else {
        toast.success(data?.message || 'Agreement signed successfully')
      }
    },
    onError: (error: Error) => {
      console.error('Error signing agreement:', error)
      toast.error(error.message || 'Failed to sign agreement')
    },
  })

  // Sign as beneficiary mutation
  const signBeneficiaryMutation = useMutation({
    mutationFn: async ({
      beneficiaryId,
      accept,
    }: {
      beneficiaryId: string
      accept: boolean
    }) => {
      const response = await fetch(`/api/agreement/${id}/sign/beneficiary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beneficiaryId, accept }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign agreement')
      }
      return response.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['agreement', id] })
      queryClient.invalidateQueries({ queryKey: ['agreements'] })

      const txHash = data?.onChain?.beneficiarySignatureTxHash
      if (txHash) {
        const shortTx = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`
        toast.success(`Signature recorded on-chain (${shortTx})`)
      } else {
        toast.success(data?.message || 'Signature recorded successfully')
      }
    },
    onError: (error: Error) => {
      console.error('Error signing agreement:', error)
      toast.error(error.message || 'Failed to sign agreement')
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agreement/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel agreement')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreement', id] })
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement cancelled successfully')
    },
    onError: (error: Error) => {
      console.error('Error cancelling agreement:', error)
      toast.error(error.message || 'Failed to cancel agreement')
    },
  })

  // Submit mutation (for owner to submit after signing)
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agreement/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit agreement')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreement', id] })
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement submitted for signatures')
    },
    onError: (error: Error) => {
      console.error('Error submitting agreement:', error)
      toast.error(error.message || 'Failed to submit agreement')
    },
  })

  // Complete mutation (for owner after agreement is active)
  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agreement/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to complete agreement')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreement', id] })
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement marked as completed')
    },
    onError: (error: Error) => {
      console.error('Error completing agreement:', error)
      toast.error(error.message || 'Failed to complete agreement')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!agreement) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Agreement not found</h3>
        <Button onClick={() => router.navigate({ to: '/app/agreement/view' })}>
          Back to Agreements
        </Button>
      </div>
    )
  }

  const isOwner = session?.user.id === agreement.owner.id

  const statusColors = getStatusColor(agreement.status)

  const getStatusLabel = (status: AgreementStatus): string => {
    const labels: Record<AgreementStatus, string> = {
      DRAFT: 'Draft',
      PENDING_SIGNATURES: 'Pending Signatures',
      PENDING_WITNESS: 'Pending Witness',
      ACTIVE: 'Active',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      EXPIRED: 'Expired',
    }
    return labels[status] || status
  }

  const getDistributionTypeLabel = (type: DistributionType): string => {
    const labels: Record<DistributionType, string> = {
      FARAID: 'Faraid',
      HIBAH: 'Hibah (Gift)',
      WASIYYAH: 'Wasiyyah (Will)',
      WAKAF: 'Wakaf (Endowment)',
    }
    return labels[type] || type
  }

  const getDistributionTypeColor = (type: DistributionType) => {
    switch (type) {
      case 'FARAID':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'HIBAH':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'WASIYYAH':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'WAKAF':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleSignAsOwner = (submit = false) => {
    signOwnerMutation.mutate(submit)
  }

  const handleSubmitAgreement = () => {
    submitMutation.mutate()
  }

  const handleCompleteAgreement = () => {
    completeMutation.mutate()
  }

  const handleSignAsBeneficiary = (beneficiaryId: string, accept = true) => {
    signBeneficiaryMutation.mutate({ beneficiaryId, accept })
  }

  // Find current beneficiary if user is a beneficiary
  const currentBeneficiary = agreement.beneficiaries.find((b: any) => {
    const userId = b.familyMember?.user?.id
    const sessionUserId = session?.user.id
    // Ensure both are strings for comparison
    return String(userId) === String(sessionUserId)
  })

  const isCurrentBeneficiary = !!currentBeneficiary
  const hasSigned = currentBeneficiary?.hasSigned || false

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Agreement Details</CardTitle>
              <CardDescription>
                {isOwner
                  ? 'View your agreement information'
                  : 'View agreement details'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.navigate({ to: '/app/agreement/view' })}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agreement Title & Status Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{agreement.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                >
                  {getStatusLabel(agreement.status)}
                </span>
                <Badge
                  className={getDistributionTypeColor(
                    agreement.distributionType,
                  )}
                >
                  {getDistributionTypeLabel(agreement.distributionType)}
                </Badge>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border-primary/20">
                  <Calendar className="h-3 w-3" />
                  {formatDate(agreement.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {agreement.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Description
              </p>
              <p className="text-sm">{agreement.description}</p>
            </div>
          )}

          {/* Fields */}
          <FieldGroup className="gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Distribution Type
              </p>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={getDistributionTypeLabel(agreement.distributionType)}
                  disabled
                  className="h-10 pl-10 bg-muted/50"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Status
              </p>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={getStatusLabel(agreement.status)}
                  disabled
                  className="h-10 pl-10 bg-muted/50"
                />
              </div>
            </div>

            {agreement.effectiveDate && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Effective Date
                </p>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={formatDate(agreement.effectiveDate)}
                    disabled
                    className="h-10 pl-10 bg-muted/50"
                  />
                </div>
              </div>
            )}

            {agreement.expiryDate && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Expiry Date
                </p>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={formatDate(agreement.expiryDate)}
                    disabled
                    className="h-10 pl-10 bg-muted/50"
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Created Date
              </p>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={formatDate(agreement.createdAt)}
                  disabled
                  className="h-10 pl-10 bg-muted/50"
                />
              </div>
            </div>
          </FieldGroup>

          {/* Signature Progress Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Signature className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Signature Progress</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Role
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Name
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Owner */}
                  <tr className="border-b last:border-b-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {agreement.ownerSignature?.hasSigned ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <span className="text-sm font-medium">Owner</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">{agreement.owner.name}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-xs text-muted-foreground">
                        {agreement.ownerSignature?.hasSigned
                          ? formatDate(agreement.ownerSignature.signedAt)
                          : 'Pending'}
                      </div>
                      {agreement.ownerSignature?.explorerUrl && (
                        <a
                          href={agreement.ownerSignature.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View tx
                        </a>
                      )}
                    </td>
                  </tr>

                  {/* Beneficiaries */}
                  {agreement.beneficiaries.map((beneficiary: any) => (
                    <tr
                      key={beneficiary.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {beneficiary.hasSigned &&
                          beneficiary.isAccepted !== false ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : beneficiary.isAccepted === false ? (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-sm font-medium">
                            Beneficiary
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {beneficiary.familyMember?.user?.name ||
                            beneficiary.nonRegisteredFamilyMember?.name ||
                            'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {beneficiary.familyMember?.relation ||
                            beneficiary.nonRegisteredFamilyMember?.relation ||
                            'N/A'}{' '}
                          • {beneficiary.sharePercentage}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-xs text-muted-foreground">
                          {beneficiary.hasSigned &&
                          beneficiary.isAccepted !== false
                            ? formatDate(beneficiary.signedAt)
                            : beneficiary.isAccepted === false
                              ? 'Rejected'
                              : 'Pending'}
                        </div>
                        {beneficiary.explorerUrl && (
                          <a
                            href={beneficiary.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View tx
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Witness */}
                  {agreement.status !== 'DRAFT' && (
                    <tr className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {agreement.witnessedAt ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-sm font-medium">Witness</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {agreement.witness
                            ? agreement.witness.name
                            : 'Pending assignment'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-xs text-muted-foreground">
                          {agreement.witnessedAt
                            ? formatDate(agreement.witnessedAt)
                            : 'Pending'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assets Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Allocated Assets ({agreement.assets.length})
              </p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Asset Name
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Type
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agreement.assets.map((item: any) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium">
                          {item.asset.name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-muted-foreground">
                          {item.asset.type}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-medium">
                          ${item.asset.value.toLocaleString()}
                        </div>
                        {item.allocatedPercentage && (
                          <div className="text-xs text-muted-foreground">
                            {item.allocatedPercentage}%
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50">
                    <td className="py-2 px-4 font-medium text-xs" colSpan={2}>
                      Total Assets
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-xs">
                      {agreement.assets
                        .reduce(
                          (sum: number, item: any) => sum + item.asset.value,
                          0,
                        )
                        .toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Beneficiaries Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Beneficiaries ({agreement.beneficiaries.length})
              </p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Name
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium">
                      Relation
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agreement.beneficiaries.map((beneficiary: any) => (
                    <tr
                      key={beneficiary.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium">
                          {beneficiary.familyMember?.user?.name ||
                            beneficiary.nonRegisteredFamilyMember?.name ||
                            'Unknown'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-muted-foreground">
                          {beneficiary.familyMember?.relation ||
                            beneficiary.nonRegisteredFamilyMember?.relation ||
                            'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-medium">
                          {beneficiary.sharePercentage}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50">
                    <td className="py-2 px-4 font-medium text-xs" colSpan={2}>
                      Total
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-xs">
                      {agreement.beneficiaries.reduce(
                        (sum: number, b: any) => sum + b.sharePercentage,
                        0,
                      )}
                      %
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {getStatusDescription(agreement.status)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a
                  href={`/api/agreement/${id}/document`}
                  download={`agreement-${id}.pdf`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </a>
              </Button>

              {/* Owner actions */}
              {isOwner &&
                agreement.status === 'DRAFT' &&
                !agreement.ownerSignature?.hasSigned && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleSignAsOwner(false)}
                      disabled={signOwnerMutation.isPending}
                    >
                      {signOwnerMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Signature className="mr-2 h-4 w-4" />
                      )}
                      Sign On-Chain
                    </Button>
                    <Button
                      onClick={() => handleSignAsOwner(true)}
                      disabled={signOwnerMutation.isPending}
                    >
                      {signOwnerMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Signature className="mr-2 h-4 w-4" />
                      )}
                      Sign On-Chain & Submit
                    </Button>
                  </>
                )}

              {/* Owner submit button (after signing but before submitting) */}
              {isOwner &&
                agreement.status === 'DRAFT' &&
                agreement.ownerSignature?.hasSigned && (
                  <Button
                    onClick={handleSubmitAgreement}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Signature className="mr-2 h-4 w-4" />
                    )}
                    Submit Agreement
                  </Button>
                )}

              {/* Owner completion button */}
              {isOwner && agreement.status === 'ACTIVE' && (
                <Button
                  onClick={handleCompleteAgreement}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Mark Completed
                </Button>
              )}

              {/* Beneficiary actions */}
              {!isOwner &&
                isCurrentBeneficiary &&
                !hasSigned &&
                agreement.status === 'PENDING_SIGNATURES' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleSignAsBeneficiary(currentBeneficiary.id, true)
                      }
                      disabled={signBeneficiaryMutation.isPending}
                    >
                      {signBeneficiaryMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Accept & Sign On-Chain
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleSignAsBeneficiary(currentBeneficiary.id, false)
                      }
                      disabled={signBeneficiaryMutation.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}

              {/* Cancel button */}
              {isOwner &&
                ['DRAFT', 'PENDING_SIGNATURES', 'PENDING_WITNESS'].includes(
                  agreement.status,
                ) && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel Agreement
                  </Button>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
