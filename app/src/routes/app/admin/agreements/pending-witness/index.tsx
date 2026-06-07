import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { CheckCircle2Icon, EyeIcon } from 'lucide-react'
import { getAdminSession } from '@/middleware'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface Beneficiary {
  id: string
  sharePercentage: number
  shareDescription: string | null
  hasSigned: boolean
  nonRegisteredFamilyMember: {
    id: number
    name: string
    icNumber: string
  } | null
  familyMember: {
    familyMemberUser: {
      id: string
      name: string
      email: string
    }
  } | null
}

interface AgreementAsset {
  id: string
  asset: {
    id: number
    name: string
    type: string
    value: number
  }
  allocatedValue: number | null
  allocatedPercentage: number | null
  notes: string | null
}

interface Agreement {
  id: string
  title: string
  description: string | null
  distributionType: string
  status: string
  effectiveDate: string | null
  expiryDate: string | null
  ownerHasSigned: boolean
  createdAt: string
  updatedAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  beneficiaries: Array<Beneficiary>
  assets: Array<AgreementAsset>
}

export const Route = createFileRoute('/app/admin/agreements/pending-witness/')({
  loader: async () => {
    const admin = await getAdminSession()
    if (!admin) {
      throw redirect({ to: '/app/dashboard' })
    }
    return { admin }
  },
  component: PendingWitnessPage,
})

function PendingWitnessPage() {
  const [agreements, setAgreements] = useState<Array<Agreement>>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [witnessing, setWitnessing] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  const fetchAgreements = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/agreements/pending-witness/')
      if (response.ok) {
        const data = await response.json()
        setAgreements(data.agreements || [])
      } else {
        toast.error('Failed to fetch pending agreements')
      }
    } catch (error) {
      console.error('Error fetching agreements:', error)
      toast.error('Failed to fetch pending agreements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgreements()
  }, [])

  const openWitnessDialog = (agreement: Agreement) => {
    setSelectedAgreement(agreement)
    setConfirmDialogOpen(true)
  }

  const openViewDialog = (agreement: Agreement) => {
    setSelectedAgreement(agreement)
    setViewDialogOpen(true)
  }

  const handleWitness = async () => {
    if (!selectedAgreement) return

    setWitnessing(true)
    try {
      const response = await fetch(`/api/agreement/${selectedAgreement.id}/sign/witness/`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        const txHash = data?.onChain?.witnessSignatureTxHash
        if (txHash) {
          toast.success(`Agreement witnessed on-chain (${txHash.slice(0, 10)}...${txHash.slice(-6)})`)
        } else {
          toast.success(data.message || 'Agreement witnessed successfully')
        }
        setConfirmDialogOpen(false)
        setSelectedAgreement(null)
        fetchAgreements()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to witness agreement')
      }
    } catch (error) {
      console.error('Error witnessing agreement:', error)
      toast.error('Failed to witness agreement')
    } finally {
      setWitnessing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const getBeneficiaryName = (beneficiary: Beneficiary) => {
    if (beneficiary.nonRegisteredFamilyMember) {
      return beneficiary.nonRegisteredFamilyMember.name
    }
    if (beneficiary.familyMember?.familyMemberUser) {
      return beneficiary.familyMember.familyMemberUser.name
    }
    return 'Unknown'
  }

  const totalAssetValue = agreements.reduce(
    (sum, agreement) =>
      sum + agreement.assets.reduce((assetSum, asset) => assetSum + asset.asset.value, 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pending Witness Agreements</h1>
        <p className="text-muted-foreground">
          Review and witness agreements that have been signed by all parties
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Pending Witness</div>
          <div className="text-2xl font-bold">{agreements.length}</div>
        </div>
        <div className="bg-background rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Asset Value</div>
          <div className="text-2xl font-bold">RM{totalAssetValue.toLocaleString()}</div>
        </div>
        <div className="bg-background rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">All Parties Signed</div>
          <div className="text-2xl font-bold text-green-600">
            <CheckCircle2Icon className="h-6 w-6 inline mr-1" />
            Yes
          </div>
        </div>
      </div>

      {/* Agreements Table */}
      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Beneficiaries</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : agreements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2Icon className="h-12 w-12 text-green-600" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm text-muted-foreground">
                      No agreements pending witness signature
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              agreements.map((agreement) => {
                const allSigned = agreement.beneficiaries.every((b) => b.hasSigned)
                return (
                  <TableRow key={agreement.id}>
                    <TableCell className="font-medium">{agreement.title}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agreement.owner.name}</div>
                        <div className="text-sm text-muted-foreground">{agreement.owner.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{agreement.distributionType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {agreement.beneficiaries.length} beneficiary
                        {agreement.beneficiaries.length !== 1 ? 's' : ''}
                        <div className="text-xs text-muted-foreground">
                          {agreement.beneficiaries.filter((b) => b.hasSigned).length} signed
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{agreement.assets.length}</TableCell>
                    <TableCell>{formatDate(agreement.effectiveDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewDialog(agreement)}
                        >
                          <EyeIcon className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openWitnessDialog(agreement)}
                          disabled={!allSigned}
                        >
                          <CheckCircle2Icon className="h-4 w-4 mr-2" />
                          Witness
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Witness Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Witness Agreement</DialogTitle>
            <DialogDescription>
              You are about to witness this agreement. By confirming, you verify that all parties
              have signed and the agreement is ready to be activated.
            </DialogDescription>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{selectedAgreement.title}</h3>
                {selectedAgreement.description && (
                  <p className="text-sm text-muted-foreground">{selectedAgreement.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p className="font-medium">{selectedAgreement.owner.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Distribution Type:</span>
                  <p>{selectedAgreement.distributionType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p>{formatDate(selectedAgreement.effectiveDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assets:</span>
                  <p>{selectedAgreement.assets.length} asset(s)</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Beneficiaries:</p>
                <div className="border rounded-lg p-3 space-y-1">
                  {selectedAgreement.beneficiaries.map((beneficiary) => (
                    <div key={beneficiary.id} className="flex items-center justify-between text-sm">
                      <span>{getBeneficiaryName(beneficiary)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{beneficiary.sharePercentage}%</span>
                        {beneficiary.hasSigned ? (
                          <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-yellow-600">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWitness} disabled={witnessing}>
              {witnessing ? 'Witnessing...' : 'Confirm Witness'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Agreement Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agreement Details</DialogTitle>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedAgreement.title}</h3>
                {selectedAgreement.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedAgreement.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p className="font-medium">{selectedAgreement.owner.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedAgreement.owner.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Distribution Type:</span>
                  <p>{selectedAgreement.distributionType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p><Badge variant="outline">{selectedAgreement.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p>{formatDate(selectedAgreement.effectiveDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expiry Date:</span>
                  <p>{formatDate(selectedAgreement.expiryDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p>{formatDate(selectedAgreement.createdAt)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Beneficiaries:</p>
                <div className="border rounded-lg p-3 space-y-2">
                  {selectedAgreement.beneficiaries.map((beneficiary) => (
                    <div key={beneficiary.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{getBeneficiaryName(beneficiary)}</p>
                        {beneficiary.shareDescription && (
                          <p className="text-xs text-muted-foreground">{beneficiary.shareDescription}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{beneficiary.sharePercentage}%</span>
                        {beneficiary.hasSigned ? (
                          <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                        ) : (
                          <span className="text-xs text-yellow-600 px-2 py-1 bg-yellow-100 rounded">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Assets:</p>
                <div className="border rounded-lg p-3 space-y-2">
                  {selectedAgreement.assets.map((agreementAsset) => (
                    <div key={agreementAsset.id} className="text-sm p-2 bg-muted/50 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium">{agreementAsset.asset.name}</span>
                        <span>RM{agreementAsset.asset.value.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{agreementAsset.asset.type}</span>
                        {(agreementAsset.allocatedValue || agreementAsset.allocatedPercentage) && (
                          <span>
                            {agreementAsset.allocatedValue && `RM${agreementAsset.allocatedValue.toLocaleString()}`}
                            {agreementAsset.allocatedValue && agreementAsset.allocatedPercentage && ' • '}
                            {agreementAsset.allocatedPercentage && `${agreementAsset.allocatedPercentage}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                <span className="font-medium">Ready for Witness</span>
                <span className="text-muted-foreground">
                  - All parties have signed this agreement
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setViewDialogOpen(false)
                openWitnessDialog(selectedAgreement!)
              }}
            >
              Witness Agreement
            </Button>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
