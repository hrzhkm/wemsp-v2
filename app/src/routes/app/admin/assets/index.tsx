import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import {
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from 'lucide-react'
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

interface Asset {
  id: number
  name: string
  type: string
  description: string | null
  value: number
  documentUrl: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
  }
  _count: {
    agreementAssets: number
  }
}

interface AssetsResponse {
  assets: Array<Asset>
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

export const Route = createFileRoute('/app/admin/assets/')({
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
  const [assets, setAssets] = useState<Array<Asset>>([])
  const [users, setUsers] = useState<Array<User>>([])
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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'PROPERTY',
    description: '',
    value: '',
    document: null as File | null,
    userId: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'PROPERTY',
    description: '',
    value: '',
    document: null as File | null,
    userId: '',
  })

  // Fetch assets
  const fetchAssets = async (page = 1, search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      })

      const response = await fetch(`/api/admin/assets?${params}`)
      if (response.ok) {
        const data: AssetsResponse = await response.json()
        setAssets(data.assets)
        setPagination(data.pagination)
      } else {
        toast.error('Failed to fetch assets')
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
      toast.error('Failed to fetch assets')
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

  useEffect(() => {
    fetchAssets(pagination.page, searchQuery)
    fetchUsers()
  }, [])

  // Search handler
  const handleSearch = () => {
    fetchAssets(1, searchQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Create asset handler
  const handleCreateAsset = async () => {
    try {
      const formData = new FormData()
      formData.append('name', createForm.name)
      formData.append('type', createForm.type)
      formData.append('description', createForm.description)
      formData.append('value', createForm.value)
      formData.append('userId', createForm.userId)
      if (createForm.document) {
        formData.append('document', createForm.document)
      }

      const response = await fetch('/api/admin/assets', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast.success('Asset created successfully')
        setCreateDialogOpen(false)
        setCreateForm({
          name: '',
          type: 'PROPERTY',
          description: '',
          value: '',
          document: null,
          userId: '',
        })
        fetchAssets(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create asset')
      }
    } catch (error) {
      console.error('Error creating asset:', error)
      toast.error('Failed to create asset')
    }
  }

  // Edit asset handlers
  const openEditDialog = (asset: Asset) => {
    setSelectedAsset(asset)
    setEditForm({
      name: asset.name,
      type: asset.type,
      description: asset.description || '',
      value: asset.value.toString(),
      document: null,
      userId: asset.user.id,
    })
    setEditDialogOpen(true)
  }

  const handleUpdateAsset = async () => {
    if (!selectedAsset) return

    try {
      const formData = new FormData()
      formData.append('name', editForm.name)
      formData.append('type', editForm.type)
      formData.append('description', editForm.description)
      formData.append('value', editForm.value)
      formData.append('userId', editForm.userId)
      if (editForm.document) {
        formData.append('document', editForm.document)
      }

      const response = await fetch(`/api/admin/assets/${selectedAsset.id}`, {
        method: 'PUT',
        body: formData,
      })

      if (response.ok) {
        toast.success('Asset updated successfully')
        setEditDialogOpen(false)
        setSelectedAsset(null)
        fetchAssets(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update asset')
      }
    } catch (error) {
      console.error('Error updating asset:', error)
      toast.error('Failed to update asset')
    }
  }

  // Delete asset handlers
  const openDeleteDialog = (asset: Asset) => {
    setSelectedAsset(asset)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return

    try {
      const response = await fetch(`/api/admin/assets/${selectedAsset.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Asset deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedAsset(null)
        fetchAssets(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete asset')
      }
    } catch (error) {
      console.error('Error deleting asset:', error)
      toast.error('Failed to delete asset')
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return `RM${value.toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Search and Create */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            placeholder="Search by name, type, or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="max-w-sm"
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <SearchIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Asset
        </Button>
      </div>

      {/* Assets Table */}
      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded text-xs bg-secondary">
                      {asset.type}
                    </span>
                  </TableCell>
                  <TableCell>{asset.user.name}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(asset.value)}
                  </TableCell>
                  <TableCell>
                    {asset.documentUrl ? (
                      <a
                        href={asset.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <FileTextIcon className="h-4 w-4" />
                        View
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(asset.createdAt)}</TableCell>
                  <TableCell>
                    {asset._count.agreementAssets > 0 ? (
                      <span className="text-sm">
                        {asset._count.agreementAssets} agreement
                        {asset._count.agreementAssets > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(asset)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDeleteDialog(asset)}
                        disabled={asset._count.agreementAssets > 0}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              of {pagination.total} assets
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => {
                  const newPage = pagination.page - 1
                  setPagination({ ...pagination, page: newPage })
                  fetchAssets(newPage, searchQuery)
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
                  fetchAssets(newPage, searchQuery)
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Asset Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Asset</DialogTitle>
            <DialogDescription>
              Create a new asset for a user. Name, type, value, and owner are
              required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Enter asset name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-type">Type *</Label>
              <Select
                value={createForm.type}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPERTY">Property</SelectItem>
                  <SelectItem value="VEHICLE">Vehicle</SelectItem>
                  <SelectItem value="INVESTMENT">Investment</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="Enter asset description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-value">Value (RM) *</Label>
              <Input
                id="create-value"
                type="number"
                step="0.01"
                value={createForm.value}
                onChange={(e) =>
                  setCreateForm({ ...createForm, value: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-owner">Owner *</Label>
              <Select
                value={createForm.userId}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, userId: value })
                }
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
            <div className="space-y-2">
              <Label htmlFor="create-document">Document (PDF, max 10MB)</Label>
              <Input
                id="create-document"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    document: e.target.files?.[0] || null,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAsset}
              disabled={
                !createForm.name || !createForm.value || !createForm.userId
              }
            >
              Create Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update asset information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Enter asset name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type *</Label>
              <Select
                value={editForm.type}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPERTY">Property</SelectItem>
                  <SelectItem value="VEHICLE">Vehicle</SelectItem>
                  <SelectItem value="INVESTMENT">Investment</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Enter asset description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-value">Value (RM) *</Label>
              <Input
                id="edit-value"
                type="number"
                step="0.01"
                value={editForm.value}
                onChange={(e) =>
                  setEditForm({ ...editForm, value: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner">Owner *</Label>
              <Select
                value={editForm.userId}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, userId: value })
                }
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
            <div className="space-y-2">
              <Label htmlFor="edit-document">Document (PDF, max 10MB)</Label>
              <Input
                id="edit-document"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    document: e.target.files?.[0] || null,
                  })
                }
              />
              {selectedAsset?.documentUrl && !editForm.document && (
                <p className="text-sm text-muted-foreground">
                  Current:{' '}
                  <a
                    href={selectedAsset.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View existing document
                  </a>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAsset}
              disabled={!editForm.name || !editForm.value || !editForm.userId}
            >
              Update Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Asset Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Name:</strong> {selectedAsset.name}
                <br />
                <strong>Type:</strong> {selectedAsset.type}
                <br />
                <strong>Value:</strong> {formatCurrency(selectedAsset.value)}
                <br />
                <strong>Owner:</strong> {selectedAsset.user.name}
              </p>
              {selectedAsset._count.agreementAssets > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Warning: This asset is used in{' '}
                  {selectedAsset._count.agreementAssets} agreement(s). You
                  cannot delete assets that are in use.
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
              onClick={handleDeleteAsset}
              disabled={
                selectedAsset ? selectedAsset._count.agreementAssets > 0 : true
              }
            >
              Delete Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
