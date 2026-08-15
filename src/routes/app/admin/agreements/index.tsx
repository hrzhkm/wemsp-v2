import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import {
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  FileText,
  Loader2,
  PencilIcon,
  Plus,
  SearchIcon,
  TrashIcon,
  XCircleIcon,
} from 'lucide-react'
import type { AgreementStatus, DistributionType } from '@/generated/prisma/enums'
import { getAdminSession } from '@/middleware'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Agreement {
  id: string
  title: string
  description: string | null
  distributionType: DistributionType
  status: AgreementStatus
  effectiveDate: string | null
  expiryDate: string | null
  createdAt: string
  updatedAt: string
  ownerHasSigned: boolean
  witnessedAt: string | null
  owner: {
    id: string
    name: string
    email: string
  }
  witness: {
    id: string
    name: string
    email: string
  } | null
  _count: {
    assets: number
    beneficiaries: number
  }
  signedBeneficiaryCount: number
}

interface AgreementsResponse {
  agreements: Array<Agreement>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface User {
  id: string
  name: string
  email: string
}

interface Asset {
  id: number
  name: string
  type: string
  value: number
  userId: string
}

interface FamilyMember {
  id: number
  relation: string
  familyMemberUser?: {
    id: string
    name: string
    email: string
  }
}

interface NonRegisteredFamilyMember {
  id: number
  name: string
  relation: string
  icNumber: string
}

interface AgreementAssetInput {
  assetId: number
  allocatedValue?: number
  allocatedPercentage?: number
  notes?: string
}

interface AgreementBeneficiaryInput {
  familyMemberId?: number
  nonRegisteredFamilyMemberId?: number
  sharePercentage: number
  shareDescription?: string
}

export const Route = createFileRoute('/app/admin/agreements/')({
  loader: async () => {
    const admin = await getAdminSession()
    if (!admin) {
      throw redirect({ to: '/app/dashboard' })
    }
    return { admin }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [agreements, setAgreements] = useState<Array<Agreement>>([])
  const [users, setUsers] = useState<Array<User>>([])
  const [userAssets, setUserAssets] = useState<Array<Asset>>([])
  const [userFamilyMembers, setUserFamilyMembers] = useState<
    Array<FamilyMember>
  >([])
  const [userNonRegisteredMembers, setUserNonRegisteredMembers] = useState<
    Array<NonRegisteredFamilyMember>
  >([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [witnessDialogOpen, setWitnessDialogOpen] = useState(false)
  const [witnessing, setWitnessing] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(
    null,
  )

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    distributionType: 'FARAID' as DistributionType,
    effectiveDate: '',
    expiryDate: '',
    ownerId: '',
    assets: [] as Array<AgreementAssetInput>,
    beneficiaries: [] as Array<AgreementBeneficiaryInput>,
  })
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    distributionType: 'FARAID' as DistributionType,
    effectiveDate: '',
    expiryDate: '',
    ownerId: '',
    assets: [] as Array<AgreementAssetInput>,
    beneficiaries: [] as Array<AgreementBeneficiaryInput>,
  })

  // Fetch agreements
  const fetchAgreements = async (page = 1, search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      })

      const response = await fetch(`/api/admin/agreements?${params}`)
      if (response.ok) {
        const data: AgreementsResponse = await response.json()
        setAgreements(data.agreements)
        setPagination(data.pagination)
      } else {
        toast.error('Failed to fetch agreements')
      }
    } catch (error) {
      console.error('Error fetching agreements:', error)
      toast.error('Failed to fetch agreements')
    } finally {
      setLoading(false)
    }
  }

  // Fetch users for dropdown
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Fetch user's assets
  const fetchUserAssets = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/assets`)
      if (response.ok) {
        const data = await response.json()
        setUserAssets(data.assets || [])
      }
    } catch (error) {
      console.error('Error fetching user assets:', error)
    }
  }

  // Fetch user's family members
  const fetchUserFamilyMembers = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/family-members`)
      if (response.ok) {
        const data = await response.json()
        setUserFamilyMembers(data.familyMembers || [])
        setUserNonRegisteredMembers(data.nonRegisteredMembers || [])
      }
    } catch (error) {
      console.error('Error fetching family members:', error)
    }
  }

  useEffect(() => {
    fetchAgreements(pagination.page, searchQuery)
    fetchUsers()
  }, [])

  // Search handler
  const handleSearch = () => {
    fetchAgreements(1, searchQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Owner change handler
  const handleOwnerChange = (userId: string, isEdit = false) => {
    if (isEdit) {
      setEditForm({
        ...editForm,
        ownerId: userId,
        assets: [],
        beneficiaries: [],
      })
    } else {
      setCreateForm({
        ...createForm,
        ownerId: userId,
        assets: [],
        beneficiaries: [],
      })
    }
    if (userId) {
      fetchUserAssets(userId)
      fetchUserFamilyMembers(userId)
    } else {
      setUserAssets([])
      setUserFamilyMembers([])
      setUserNonRegisteredMembers([])
    }
  }

  // Asset selection handlers
  const toggleAsset = (asset: Asset, isEdit = false) => {
    const form = isEdit ? editForm : createForm
    const existingIndex = form.assets.findIndex((a) => a.assetId === asset.id)

    let newAssets: Array<AgreementAssetInput>
    if (existingIndex >= 0) {
      newAssets = form.assets.filter((a) => a.assetId !== asset.id)
    } else {
      newAssets = [...form.assets, { assetId: asset.id }]
    }

    if (isEdit) {
      setEditForm({ ...editForm, assets: newAssets })
    } else {
      setCreateForm({ ...createForm, assets: newAssets })
    }
  }

  const updateAssetAllocation = (
    assetId: number,
    field: 'allocatedValue' | 'allocatedPercentage' | 'notes',
    value: string | number,
    isEdit = false,
  ) => {
    const form = isEdit ? editForm : createForm
    const newAssets = form.assets.map((a) =>
      a.assetId === assetId
        ? {
            ...a,
            [field]:
              field === 'notes'
                ? value
                : value === ''
                  ? undefined
                  : Number(value),
          }
        : a,
    )

    if (isEdit) {
      setEditForm({ ...editForm, assets: newAssets })
    } else {
      setCreateForm({ ...createForm, assets: newAssets })
    }
  }

  // Beneficiary handlers
  const addBeneficiary = (
    type: 'registered' | 'non-registered',
    memberId: number,
    isEdit = false,
  ) => {
    const form = isEdit ? editForm : createForm

    const newBeneficiary: AgreementBeneficiaryInput = {
      sharePercentage: 0,
    }

    if (type === 'registered') {
      newBeneficiary.familyMemberId = memberId
    } else {
      newBeneficiary.nonRegisteredFamilyMemberId = memberId
    }

    const newBeneficiaries = [...form.beneficiaries, newBeneficiary]

    if (isEdit) {
      setEditForm({ ...editForm, beneficiaries: newBeneficiaries })
    } else {
      setCreateForm({ ...createForm, beneficiaries: newBeneficiaries })
    }
  }

  const removeBeneficiary = (index: number, isEdit = false) => {
    const form = isEdit ? editForm : createForm
    const newBeneficiaries = form.beneficiaries.filter((_, i) => i !== index)

    if (isEdit) {
      setEditForm({ ...editForm, beneficiaries: newBeneficiaries })
    } else {
      setCreateForm({ ...createForm, beneficiaries: newBeneficiaries })
    }
  }

  const updateBeneficiaryShare = (
    index: number,
    sharePercentage: number,
    isEdit = false,
  ) => {
    const form = isEdit ? editForm : createForm
    const newBeneficiaries = form.beneficiaries.map((b, i) =>
      i === index ? { ...b, sharePercentage } : b,
    )

    if (isEdit) {
      setEditForm({ ...editForm, beneficiaries: newBeneficiaries })
    } else {
      setCreateForm({ ...createForm, beneficiaries: newBeneficiaries })
    }
  }

  const updateBeneficiaryDescription = (
    index: number,
    shareDescription: string,
    isEdit = false,
  ) => {
    const form = isEdit ? editForm : createForm
    const newBeneficiaries = form.beneficiaries.map((b, i) =>
      i === index ? { ...b, shareDescription } : b,
    )

    if (isEdit) {
      setEditForm({ ...editForm, beneficiaries: newBeneficiaries })
    } else {
      setCreateForm({ ...createForm, beneficiaries: newBeneficiaries })
    }
  }

  // Get total shares
  const getTotalShares = (beneficiaries: Array<AgreementBeneficiaryInput>) => {
    return beneficiaries.reduce((sum, b) => sum + (b.sharePercentage || 0), 0)
  }

  // Create agreement handler
  const handleCreateAgreement = async () => {
    try {
      const response = await fetch('/api/admin/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      if (response.ok) {
        toast.success('Agreement created successfully')
        setCreateDialogOpen(false)
        setCreateForm({
          title: '',
          description: '',
          distributionType: 'FARAID',
          effectiveDate: '',
          expiryDate: '',
          ownerId: '',
          assets: [],
          beneficiaries: [],
        })
        setUserAssets([])
        setUserFamilyMembers([])
        setUserNonRegisteredMembers([])
        fetchAgreements(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create agreement')
      }
    } catch (error) {
      console.error('Error creating agreement:', error)
      toast.error('Failed to create agreement')
    }
  }

  // Edit agreement handlers
  const openEditDialog = async (agreement: Agreement) => {
    setSelectedAgreement(agreement)

    // Fetch agreement details
    const response = await fetch(`/api/admin/agreements/${agreement.id}`)
    if (response.ok) {
      const data = await response.json()

      // Fetch owner's assets and family members
      await fetchUserAssets(agreement.owner.id)
      await fetchUserFamilyMembers(agreement.owner.id)

      setEditForm({
        title: agreement.title,
        description: agreement.description || '',
        distributionType: agreement.distributionType,
        effectiveDate: agreement.effectiveDate
          ? agreement.effectiveDate.split('T')[0]
          : '',
        expiryDate: agreement.expiryDate
          ? agreement.expiryDate.split('T')[0]
          : '',
        ownerId: agreement.owner.id,
        assets: data.agreement.assets || [],
        beneficiaries: data.agreement.beneficiaries || [],
      })
    }
    setEditDialogOpen(true)
  }

  const handleUpdateAgreement = async () => {
    if (!selectedAgreement) return

    try {
      const response = await fetch(
        `/api/admin/agreements/${selectedAgreement.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        },
      )

      if (response.ok) {
        toast.success('Agreement updated successfully')
        setEditDialogOpen(false)
        setSelectedAgreement(null)
        fetchAgreements(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update agreement')
      }
    } catch (error) {
      console.error('Error updating agreement:', error)
      toast.error('Failed to update agreement')
    }
  }

  // Delete agreement handlers
  const openDeleteDialog = (agreement: Agreement) => {
    setSelectedAgreement(agreement)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAgreement = async () => {
    if (!selectedAgreement) return

    try {
      const response = await fetch(
        `/api/admin/agreements/${selectedAgreement.id}`,
        {
          method: 'DELETE',
        },
      )

      if (response.ok) {
        toast.success('Agreement deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedAgreement(null)
        fetchAgreements(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete agreement')
      }
    } catch (error) {
      console.error('Error deleting agreement:', error)
      toast.error('Failed to delete agreement')
    }
  }

  // View agreement handler
  const openViewDialog = async (agreement: Agreement) => {
    setSelectedAgreement(agreement)
    setViewDialogOpen(true)
  }

  // Witness agreement handlers
  const openWitnessDialog = (agreement: Agreement) => {
    setSelectedAgreement(agreement)
    setWitnessDialogOpen(true)
  }

  const handleWitnessAgreement = async () => {
    if (!selectedAgreement) return

    setWitnessing(true)
    try {
      const response = await fetch(
        `/api/agreement/${selectedAgreement.id}/sign/witness/`,
        {
          method: 'POST',
        },
      )

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Agreement witnessed successfully')
        setWitnessDialogOpen(false)
        setSelectedAgreement(null)
        fetchAgreements(pagination.page, searchQuery)
      } else {
        const errorText = await response.text()
        try {
          const error = JSON.parse(errorText)
          toast.error(error.error || 'Failed to witness agreement')
        } catch {
          toast.error(errorText || 'Failed to witness agreement')
        }
      }
    } catch (error) {
      console.error('Error witnessing agreement:', error)
      toast.error('Failed to witness agreement')
    } finally {
      setWitnessing(false)
    }
  }

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  // Get status badge
  const getStatusBadge = (status: AgreementStatus) => {
    const variants: Record<
      AgreementStatus,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      DRAFT: 'secondary',
      PENDING_SIGNATURES: 'outline',
      PENDING_WITNESS: 'outline',
      ACTIVE: 'default',
      COMPLETED: 'default',
      CANCELLED: 'destructive',
      EXPIRED: 'destructive',
    }

    return <Badge variant={variants[status]}>{status.replace(/_/g, ' ')}</Badge>
  }

  // Get status icon
  const getStatusIcon = (status: AgreementStatus) => {
    switch (status) {
      case 'DRAFT':
        return <ClockIcon className="h-4 w-4 text-muted-foreground" />
      case 'ACTIVE':
      case 'COMPLETED':
        return <CheckCircle2Icon className="h-4 w-4 text-green-600" />
      case 'CANCELLED':
      case 'EXPIRED':
        return <XCircleIcon className="h-4 w-4 text-red-600" />
      default:
        return <ClockIcon className="h-4 w-4 text-yellow-600" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Agreement Management
              </div>
              <CardTitle className="text-xl">Agreements</CardTitle>
              <CardDescription className="mt-1">
                Review and manage all agreements across the system.
              </CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              New Agreement
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Agreements Table */}
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Input
              placeholder="Search by title, owner, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="max-w-sm"
            />
            <Button onClick={handleSearch} size="icon" variant="outline">
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/35">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Beneficiaries</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8">
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    No agreements found
                  </TableCell>
                </TableRow>
              ) : (
                agreements.map((agreement) => (
                  <TableRow key={agreement.id}>
                    <TableCell className="font-medium">
                      {agreement.title}
                    </TableCell>
                    <TableCell>{agreement.owner.name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-secondary">
                        {agreement.distributionType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(agreement.status)}
                        {getStatusBadge(agreement.status)}
                      </div>
                    </TableCell>
                    <TableCell>{agreement._count.assets}</TableCell>
                    <TableCell>
                      {agreement._count.beneficiaries} (
                      {agreement.signedBeneficiaryCount} signed)
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {agreement.ownerHasSigned ? (
                          <span className="text-green-600">Owner ✓</span>
                        ) : (
                          <span className="text-muted-foreground">Owner</span>
                        )}
                        {agreement.witnessedAt && (
                          <span className="ml-2 text-green-600">Witness ✓</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(agreement.effectiveDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openViewDialog(agreement)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        {agreement.status === 'PENDING_WITNESS' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openWitnessDialog(agreement)}
                          >
                            <CheckCircle2Icon className="h-4 w-4 mr-2" />
                            Witness
                          </Button>
                        )}
                        {agreement.status === 'DRAFT' && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(agreement)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openDeleteDialog(agreement)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              of {pagination.total} agreements
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => {
                  const newPage = pagination.page - 1
                  setPagination({ ...pagination, page: newPage })
                  fetchAgreements(newPage, searchQuery)
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => {
                  const newPage = pagination.page + 1
                  setPagination({ ...pagination, page: newPage })
                  fetchAgreements(newPage, searchQuery)
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Agreement Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Agreement</DialogTitle>
            <DialogDescription>
              Create a new agreement for a user. Title, type, owner, assets, and
              beneficiaries are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm({ ...createForm, title: e.target.value })
                }
                placeholder="Enter agreement title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="Enter agreement description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-type">Distribution Type *</Label>
                <Select
                  value={createForm.distributionType}
                  onValueChange={(value) =>
                    setCreateForm({
                      ...createForm,
                      distributionType: value as DistributionType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select distribution type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FARAID">Faraid</SelectItem>
                    <SelectItem value="HIBAH">Hibah</SelectItem>
                    <SelectItem value="WASIYYAH">Wasiyyah</SelectItem>
                    <SelectItem value="WAKAF">Wakaf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-owner">Owner *</Label>
                <Select
                  value={createForm.ownerId}
                  onValueChange={(value) => handleOwnerChange(value, false)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-effective">Effective Date</Label>
                <Input
                  id="create-effective"
                  type="date"
                  value={createForm.effectiveDate}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      effectiveDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-expiry">Expiry Date</Label>
                <Input
                  id="create-expiry"
                  type="date"
                  value={createForm.expiryDate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, expiryDate: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Assets Selection */}
            {createForm.ownerId && (
              <div className="space-y-2">
                <Label>Assets *</Label>
                {userAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No assets found for this user
                  </p>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3">
                    {userAssets.map((asset) => (
                      <div key={asset.id} className="flex items-start gap-3">
                        <Checkbox
                          checked={createForm.assets.some(
                            (a) => a.assetId === asset.id,
                          )}
                          onCheckedChange={() => toggleAsset(asset, false)}
                        />
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.type} • RM{asset.value.toLocaleString()}
                            </p>
                          </div>
                          {createForm.assets.some(
                            (a) => a.assetId === asset.id,
                          ) && (
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                placeholder="Allocated value"
                                type="number"
                                value={
                                  createForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.allocatedValue || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'allocatedValue',
                                    e.target.value,
                                    false,
                                  )
                                }
                              />
                              <Input
                                placeholder="Allocated %"
                                type="number"
                                max="100"
                                value={
                                  createForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.allocatedPercentage || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'allocatedPercentage',
                                    e.target.value,
                                    false,
                                  )
                                }
                              />
                              <Input
                                placeholder="Notes"
                                value={
                                  createForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.notes || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'notes',
                                    e.target.value,
                                    false,
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Beneficiaries Selection */}
            {createForm.ownerId && (
              <div className="space-y-2">
                <Label>Beneficiaries *</Label>
                <div className="space-y-4">
                  {/* Registered family members */}
                  {userFamilyMembers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Registered Family Members
                      </p>
                      <div className="border rounded-lg p-4 space-y-2">
                        {userFamilyMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">
                                {member.familyMemberUser?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.relation}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                addBeneficiary('registered', member.id, false)
                              }
                              disabled={createForm.beneficiaries.some(
                                (b) => b.familyMemberId === member.id,
                              )}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Non-registered family members */}
                  {userNonRegisteredMembers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Non-Registered Family Members
                      </p>
                      <div className="border rounded-lg p-4 space-y-2">
                        {userNonRegisteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {member.relation} • {member.icNumber}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                addBeneficiary(
                                  'non-registered',
                                  member.id,
                                  false,
                                )
                              }
                              disabled={createForm.beneficiaries.some(
                                (b) =>
                                  b.nonRegisteredFamilyMemberId === member.id,
                              )}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected beneficiaries */}
                  {createForm.beneficiaries.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Selected Beneficiaries
                      </p>
                      <div className="border rounded-lg p-4 space-y-3">
                        {createForm.beneficiaries.map((beneficiary, index) => {
                          const familyMember = beneficiary.familyMemberId
                            ? userFamilyMembers.find(
                                (m) => m.id === beneficiary.familyMemberId,
                              )
                            : null
                          const nonRegMember =
                            beneficiary.nonRegisteredFamilyMemberId
                              ? userNonRegisteredMembers.find(
                                  (m) =>
                                    m.id ===
                                    beneficiary.nonRegisteredFamilyMemberId,
                                )
                              : null

                          return (
                            <div
                              key={index}
                              className="space-y-2 p-3 border rounded-lg"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {familyMember?.familyMemberUser?.name ||
                                      nonRegMember?.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {familyMember?.relation ||
                                      nonRegMember?.relation}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    removeBeneficiary(index, false)
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Share % *"
                                  type="number"
                                  max="100"
                                  value={beneficiary.sharePercentage}
                                  onChange={(e) =>
                                    updateBeneficiaryShare(
                                      index,
                                      Number(e.target.value),
                                      false,
                                    )
                                  }
                                />
                                <Input
                                  placeholder="Share description"
                                  value={beneficiary.shareDescription || ''}
                                  onChange={(e) =>
                                    updateBeneficiaryDescription(
                                      index,
                                      e.target.value,
                                      false,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                        <p className="text-sm">
                          Total shares:{' '}
                          <span
                            className={
                              getTotalShares(createForm.beneficiaries) === 100
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {getTotalShares(createForm.beneficiaries)}%
                          </span>
                          {getTotalShares(createForm.beneficiaries) !== 100 &&
                            ' (must equal 100%)'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAgreement}
              disabled={
                !createForm.title ||
                !createForm.ownerId ||
                createForm.assets.length === 0 ||
                createForm.beneficiaries.length === 0 ||
                getTotalShares(createForm.beneficiaries) !== 100
              }
            >
              Create Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Agreement Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agreement</DialogTitle>
            <DialogDescription>Update agreement information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                placeholder="Enter agreement title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Enter agreement description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Distribution Type *</Label>
                <Select
                  value={editForm.distributionType}
                  onValueChange={(value) =>
                    setEditForm({
                      ...editForm,
                      distributionType: value as DistributionType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select distribution type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FARAID">Faraid</SelectItem>
                    <SelectItem value="HIBAH">Hibah</SelectItem>
                    <SelectItem value="WASIYYAH">Wasiyyah</SelectItem>
                    <SelectItem value="WAKAF">Wakaf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-owner">Owner *</Label>
                <Select
                  value={editForm.ownerId}
                  onValueChange={(value) => handleOwnerChange(value, true)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-effective">Effective Date</Label>
                <Input
                  id="edit-effective"
                  type="date"
                  value={editForm.effectiveDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, effectiveDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expiry">Expiry Date</Label>
                <Input
                  id="edit-expiry"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, expiryDate: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Assets Selection - same as create */}
            {editForm.ownerId && (
              <div className="space-y-2">
                <Label>Assets *</Label>
                {userAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No assets found for this user
                  </p>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3">
                    {userAssets.map((asset) => (
                      <div key={asset.id} className="flex items-start gap-3">
                        <Checkbox
                          checked={editForm.assets.some(
                            (a) => a.assetId === asset.id,
                          )}
                          onCheckedChange={() => toggleAsset(asset, true)}
                        />
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.type} • RM{asset.value.toLocaleString()}
                            </p>
                          </div>
                          {editForm.assets.some(
                            (a) => a.assetId === asset.id,
                          ) && (
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                placeholder="Allocated value"
                                type="number"
                                value={
                                  editForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.allocatedValue || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'allocatedValue',
                                    e.target.value,
                                    true,
                                  )
                                }
                              />
                              <Input
                                placeholder="Allocated %"
                                type="number"
                                max="100"
                                value={
                                  editForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.allocatedPercentage || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'allocatedPercentage',
                                    e.target.value,
                                    true,
                                  )
                                }
                              />
                              <Input
                                placeholder="Notes"
                                value={
                                  editForm.assets.find(
                                    (a) => a.assetId === asset.id,
                                  )?.notes || ''
                                }
                                onChange={(e) =>
                                  updateAssetAllocation(
                                    asset.id,
                                    'notes',
                                    e.target.value,
                                    true,
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Beneficiaries Selection - same as create */}
            {editForm.ownerId && (
              <div className="space-y-2">
                <Label>Beneficiaries *</Label>
                <div className="space-y-4">
                  {userFamilyMembers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Registered Family Members
                      </p>
                      <div className="border rounded-lg p-4 space-y-2">
                        {userFamilyMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">
                                {member.familyMemberUser?.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.relation}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                addBeneficiary('registered', member.id, true)
                              }
                              disabled={editForm.beneficiaries.some(
                                (b) => b.familyMemberId === member.id,
                              )}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userNonRegisteredMembers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Non-Registered Family Members
                      </p>
                      <div className="border rounded-lg p-4 space-y-2">
                        {userNonRegisteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {member.relation} • {member.icNumber}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                addBeneficiary(
                                  'non-registered',
                                  member.id,
                                  true,
                                )
                              }
                              disabled={editForm.beneficiaries.some(
                                (b) =>
                                  b.nonRegisteredFamilyMemberId === member.id,
                              )}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editForm.beneficiaries.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Selected Beneficiaries
                      </p>
                      <div className="border rounded-lg p-4 space-y-3">
                        {editForm.beneficiaries.map((beneficiary, index) => {
                          const familyMember = beneficiary.familyMemberId
                            ? userFamilyMembers.find(
                                (m) => m.id === beneficiary.familyMemberId,
                              )
                            : null
                          const nonRegMember =
                            beneficiary.nonRegisteredFamilyMemberId
                              ? userNonRegisteredMembers.find(
                                  (m) =>
                                    m.id ===
                                    beneficiary.nonRegisteredFamilyMemberId,
                                )
                              : null

                          return (
                            <div
                              key={index}
                              className="space-y-2 p-3 border rounded-lg"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {familyMember?.familyMemberUser?.name ||
                                      nonRegMember?.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {familyMember?.relation ||
                                      nonRegMember?.relation}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeBeneficiary(index, true)}
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Share % *"
                                  type="number"
                                  max="100"
                                  value={beneficiary.sharePercentage}
                                  onChange={(e) =>
                                    updateBeneficiaryShare(
                                      index,
                                      Number(e.target.value),
                                      true,
                                    )
                                  }
                                />
                                <Input
                                  placeholder="Share description"
                                  value={beneficiary.shareDescription || ''}
                                  onChange={(e) =>
                                    updateBeneficiaryDescription(
                                      index,
                                      e.target.value,
                                      true,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                        <p className="text-sm">
                          Total shares:{' '}
                          <span
                            className={
                              getTotalShares(editForm.beneficiaries) === 100
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {getTotalShares(editForm.beneficiaries)}%
                          </span>
                          {getTotalShares(editForm.beneficiaries) !== 100 &&
                            ' (must equal 100%)'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAgreement}
              disabled={
                !editForm.title ||
                !editForm.ownerId ||
                editForm.assets.length === 0 ||
                editForm.beneficiaries.length === 0 ||
                getTotalShares(editForm.beneficiaries) !== 100
              }
            >
              Update Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agreement Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agreement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this agreement? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Title:</strong> {selectedAgreement.title}
                <br />
                <strong>Owner:</strong> {selectedAgreement.owner.name}
                <br />
                <strong>Type:</strong> {selectedAgreement.distributionType}
                <br />
                <strong>Status:</strong> {selectedAgreement.status}
              </p>
              {selectedAgreement.status !== 'DRAFT' && (
                <p className="text-sm text-red-600 mt-2">
                  Warning: Only DRAFT agreements can be deleted. This agreement
                  cannot be deleted.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAgreement}
              disabled={
                selectedAgreement ? selectedAgreement.status !== 'DRAFT' : true
              }
            >
              Delete Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Agreement Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agreement Details</DialogTitle>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4 space-y-4">
              <div>
                <h3 className="font-semibold">{selectedAgreement.title}</h3>
                {selectedAgreement.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedAgreement.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p>{selectedAgreement.owner.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Distribution Type:
                  </span>
                  <p>{selectedAgreement.distributionType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p>{getStatusBadge(selectedAgreement.status)}</p>
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
                <div>
                  <span className="text-muted-foreground">Assets:</span>
                  <p>{selectedAgreement._count.assets}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Beneficiaries:</span>
                  <p>
                    {selectedAgreement._count.beneficiaries} (
                    {selectedAgreement.signedBeneficiaryCount} signed)
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {selectedAgreement.ownerHasSigned ? (
                    <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                  ) : (
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>Owner signed</span>
                </div>
                {selectedAgreement.witnessedAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                    <span>Witnessed by {selectedAgreement.witness?.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Witness Agreement Dialog */}
      <Dialog open={witnessDialogOpen} onOpenChange={setWitnessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Witness Agreement</DialogTitle>
            <DialogDescription>
              You are about to witness this agreement. By confirming, you verify
              that all parties have signed and the agreement is ready to be
              activated.
            </DialogDescription>
          </DialogHeader>
          {selectedAgreement && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{selectedAgreement.title}</h3>
                {selectedAgreement.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedAgreement.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p className="font-medium">{selectedAgreement.owner.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Distribution Type:
                  </span>
                  <p>{selectedAgreement.distributionType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p>{formatDate(selectedAgreement.effectiveDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assets:</span>
                  <p>{selectedAgreement._count.assets}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                  <span>Owner has signed</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                  <span>
                    All {selectedAgreement.signedBeneficiaryCount} beneficiaries
                    have signed
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWitnessDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleWitnessAgreement} disabled={witnessing}>
              {witnessing ? 'Witnessing...' : 'Confirm Witness'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
