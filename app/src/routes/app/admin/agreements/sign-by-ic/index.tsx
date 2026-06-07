import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { PenIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'

interface AgreementForSigning {
  beneficiaryId: string
  agreementId: string
  title: string
  status: string
  owner: { name: string; email: string }
  memberName: string
  sharePercentage: number
  shareDescription?: string | null
}

export const Route = createFileRoute('/app/admin/agreements/sign-by-ic/')({
  component: SignByICPage,
})

function SignByICPage() {
  const [icNumber, setIcNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [agreements, setAgreements] = useState<Array<AgreementForSigning>>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementForSigning | null>(null)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [signNotes, setSignNotes] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [signing, setSigning] = useState(false)

  const handleSearch = async () => {
    if (!icNumber || !/^\d{12}$/.test(icNumber)) {
      toast.error('Please enter a valid 12-digit IC number')
      return
    }

    setSearching(true)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/admin/agreements/by-ic/${icNumber}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          toast.error(data.error || 'No pending agreements found for this IC number')
          setAgreements([])
        } else {
          toast.error(data.error || 'Failed to search for agreements')
          setAgreements([])
        }
        return
      }

      setAgreements(data.agreements || [])

      if (data.agreements.length === 0) {
        toast.info('No pending agreements found for this IC number')
      } else {
        toast.success(`Found ${data.agreements.length} pending agreement(s)`)
      }
    } catch (error) {
      console.error('Error searching agreements:', error)
      toast.error('Failed to search for agreements')
      setAgreements([])
    } finally {
      setSearching(false)
    }
  }

  const openSignDialog = (agreement: AgreementForSigning) => {
    setSelectedAgreement(agreement)
    setSignNotes('')
    setNotesDialogOpen(true)
  }

  const handleContinueToConfirm = () => {
    setNotesDialogOpen(false)
    setConfirmDialogOpen(true)
  }

  const handleConfirmSign = async () => {
    if (!selectedAgreement) return

    setSigning(true)

    try {
      const response = await fetch('/api/admin/agreements/sign-on-behalf/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiaryId: selectedAgreement.beneficiaryId,
          adminNotes: signNotes || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to sign agreement')
        return
      }

      const txHash = data?.onChain?.beneficiarySignatureTxHash
      if (txHash) {
        toast.success(`Signed on-chain (${txHash.slice(0, 10)}...${txHash.slice(-6)})`)
      } else {
        toast.success(data.message || 'Signed successfully')
      }

      // Refresh the list
      await handleSearch()

      // Close dialogs
      setConfirmDialogOpen(false)
      setSelectedAgreement(null)
    } catch (error) {
      console.error('Error signing agreement:', error)
      toast.error('Failed to sign agreement')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sign by IC Number</h1>
        <p className="text-muted-foreground">
          Search for and sign agreements on behalf of non-registered users
        </p>
      </div>
      {/* IC Search Section */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md space-y-2">
          <Label htmlFor="ic-number">IC Number</Label>
          <Input
            id="ic-number"
            placeholder="Enter 12-digit IC number"
            value={icNumber}
            onChange={(e) => setIcNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            maxLength={12}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searching || !icNumber}
          className="mt-6"
        >
          <SearchIcon className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>
      {/* Results Table */}
      {hasSearched && (
        <div className="bg-background rounded-lg border">
          {agreements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No pending agreements found for this IC number
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement Title</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Share</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreements.map((agreement) => (
                  <TableRow key={agreement.beneficiaryId}>
                    <TableCell className="font-medium">{agreement.title}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agreement.owner.name}</div>
                        <div className="text-sm text-muted-foreground">{agreement.owner.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{agreement.memberName}</TableCell>
                    <TableCell>
                      {agreement.sharePercentage}%
                      {agreement.shareDescription && (
                        <div className="text-xs text-muted-foreground">
                          {agreement.shareDescription}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {agreement.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => openSignDialog(agreement)}
                      >
                        <PenIcon className="h-4 w-4 mr-2" />
                        Sign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
      {/* Optional Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notes (Optional)</DialogTitle>
            <DialogDescription>
              Add any notes for the audit record before signing on behalf of{' '}
              {selectedAgreement?.memberName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter notes (optional)..."
              value={signNotes}
              onChange={(e) => setSignNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueToConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Signing</DialogTitle>
            <DialogDescription>
              You are about to sign the following agreement on behalf of{' '}
              <strong>{selectedAgreement?.memberName}</strong>
            </DialogDescription>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Agreement:</span> {selectedAgreement.title}
              </div>
              <div className="text-sm">
                <span className="font-medium">Owner:</span> {selectedAgreement.owner.name}
              </div>
              <div className="text-sm">
                <span className="font-medium">Share:</span> {selectedAgreement.sharePercentage}%
              </div>
              {signNotes && (
                <div className="text-sm">
                  <span className="font-medium">Notes:</span> {signNotes}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSign} disabled={signing}>
              {signing ? 'Signing...' : 'Confirm Sign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
