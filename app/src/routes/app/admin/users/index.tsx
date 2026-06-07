import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAdminSession } from '@/middleware'
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
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { PencilIcon, TrashIcon, PlusIcon, SearchIcon } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  icNumber: string | null
  phoneNumber: string | null
  address: string | null
  emailVerified: boolean
  image: string | null
  createdAt: string
  updatedAt: string
  _count: {
    agreements: number
    assets: number
    familyMembers: number
  }
}

interface UsersResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Asset {
  id: string
  name: string
  type: string
  description: string | null
  value: number | null
  documentUrl: string | null
  createdAt: string
}

interface AgreementAsset {
  id: string
  assetId: string
  allocatedValue: number | null
  allocatedPercentage: number | null
  asset: {
    name: string
    type: string
  }
}

interface Beneficiary {
  id: string
  familyMemberId: string | null
  nonRegisteredFamilyMemberId: string | null
  sharePercentage: number | null
  shareDescription: string | null
  hasSigned: boolean
  isAccepted: boolean
  familyMember: {
    relation: string
    familyMemberUser: {
      name: string
    } | null
  } | null
  nonRegisteredFamilyMember: {
    name: string
    relation: string
  } | null
}

interface Agreement {
  id: string
  title: string
  description: string | null
  distributionType: string
  status: string
  createdAt: string
  updatedAt: string
  assets: AgreementAsset[]
  beneficiaries: Beneficiary[]
}

interface UserDetails {
  id: string
  name: string
  email: string
  assets: Asset[]
  agreements: Agreement[]
}

export const Route = createFileRoute('/app/admin/users/')({
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
  const [users, setUsers] = useState<User[]>([])
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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    icNumber: '',
    phoneNumber: '',
    address: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    icNumber: '',
    phoneNumber: '',
    address: '',
    emailVerified: false,
  })

  // Fetch users
  const fetchUsers = async (page = 1, search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (response.ok) {
        const data: UsersResponse = await response.json()
        setUsers(data.users)
        setPagination(data.pagination)
      } else {
        toast.error('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(pagination.page, searchQuery)
  }, [])

  // Search handler
  const handleSearch = () => {
    fetchUsers(1, searchQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Create user handler
  const handleCreateUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      if (response.ok) {
        toast.success('User created successfully')
        setCreateDialogOpen(false)
        setCreateForm({ name: '', email: '', icNumber: '', phoneNumber: '', address: '' })
        fetchUsers(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
    }
  }

  // Edit user handlers
  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setEditForm({
      name: user.name,
      email: user.email,
      icNumber: user.icNumber || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      emailVerified: user.emailVerified,
    })
    setEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        toast.success('User updated successfully')
        setEditDialogOpen(false)
        setSelectedUser(null)
        fetchUsers(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    }
  }

  // Delete user handlers
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('User deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedUser(null)
        fetchUsers(pagination.page, searchQuery)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  // View user details handlers
  const openDetailsDialog = async (user: User, _view: 'agreements' | 'assets') => {
    setSelectedUser(user)
    setDetailsDialogOpen(true)
    setDetailsLoading(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/detail`)
      if (response.ok) {
        const data = await response.json()
        setUserDetails(data.user)
      } else {
        toast.error('Failed to fetch user details')
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('Failed to fetch user details')
    } finally {
      setDetailsLoading(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
          {/* Search and Create */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Input
                placeholder="Search by name, email, or IC..."
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
              New User
            </Button>
          </div>

          {/* Users Table */}
          <div className="bg-background rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>IC Number</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email Verified</TableHead>
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
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <a
                          href={`/app/admin/users/${user.id}`}
                          className="hover:underline hover:text-primary cursor-pointer"
                        >
                          {user.name}
                        </a>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.icNumber || '-'}</TableCell>
                      <TableCell>{user.phoneNumber || '-'}</TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-3 text-xs">
                          {user._count.agreements > 0 ? (
                            <button
                              onClick={() => openDetailsDialog(user, 'agreements')}
                              className="hover:underline hover:text-primary cursor-pointer text-muted-foreground"
                            >
                              {user._count.agreements} agreements
                            </button>
                          ) : (
                            <span className="text-muted-foreground">
                              {user._count.agreements} agreements
                            </span>
                          )}
                          <span className="text-muted-foreground">•</span>
                          {user._count.assets > 0 ? (
                            <button
                              onClick={() => openDetailsDialog(user, 'assets')}
                              className="hover:underline hover:text-primary cursor-pointer text-muted-foreground"
                            >
                              {user._count.assets} assets
                            </button>
                          ) : (
                            <span className="text-muted-foreground">
                              {user._count.assets} assets
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(user)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(user)}
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
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => {
                      const newPage = pagination.page - 1
                      setPagination({ ...pagination, page: newPage })
                      fetchUsers(newPage, searchQuery)
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
                      fetchUsers(newPage, searchQuery)
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account. Email and name are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-ic">IC Number</Label>
              <Input
                id="create-ic"
                value={createForm.icNumber}
                onChange={(e) => setCreateForm({ ...createForm, icNumber: e.target.value })}
                placeholder="Enter IC number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone Number</Label>
              <Input
                id="create-phone"
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                placeholder="+60123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-address">Address</Label>
              <Input
                id="create-address"
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="Enter address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={!createForm.name || !createForm.email}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave fields empty to keep current values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ic">IC Number</Label>
              <Input
                id="edit-ic"
                value={editForm.icNumber}
                onChange={(e) => setEditForm({ ...editForm, icNumber: e.target.value })}
                placeholder="Enter IC number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                placeholder="+60123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Enter address"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-verified"
                checked={editForm.emailVerified}
                onChange={(e) => setEditForm({ ...editForm, emailVerified: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-verified">Email Verified</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={!editForm.name || !editForm.email}>
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Name:</strong> {selectedUser.name}<br />
                <strong>Email:</strong> {selectedUser.email}<br />
                <strong>IC Number:</strong> {selectedUser.icNumber || 'N/A'}
              </p>
              {(selectedUser._count.agreements > 0 || selectedUser._count.assets > 0) && (
                <p className="text-sm text-red-600 mt-2">
                  Warning: This user has {selectedUser._count.agreements} agreement(s) and {selectedUser._count.assets} asset(s).
                  You cannot delete users with existing agreements or assets.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={selectedUser ? (selectedUser._count.agreements > 0 || selectedUser._count.assets > 0) : true}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open)
          if (!open) {
            setUserDetails(null)
            setSelectedAgreement(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {detailsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : userDetails ? (
              <div className="space-y-6">
                {/* Agreements Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Agreements ({userDetails.agreements.length})
                  </h3>
                  {userDetails.agreements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No agreements found</p>
                  ) : (
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assets</TableHead>
                            <TableHead>Beneficiaries</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetails.agreements.map((agreement) => (
                            <>
                              <TableRow
                                key={agreement.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() =>
                                  setSelectedAgreement(
                                    selectedAgreement?.id === agreement.id ? null : agreement
                                  )
                                }
                              >
                                <TableCell className="font-medium">{agreement.title}</TableCell>
                                <TableCell>{agreement.distributionType}</TableCell>
                                <TableCell>
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      agreement.status === 'ACTIVE'
                                        ? 'bg-green-100 text-green-700'
                                        : agreement.status === 'DRAFT'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {agreement.status}
                                  </span>
                                </TableCell>
                                <TableCell>{agreement.assets.length}</TableCell>
                                <TableCell>{agreement.beneficiaries.length}</TableCell>
                                <TableCell>{formatDate(agreement.createdAt)}</TableCell>
                              </TableRow>
                              {selectedAgreement?.id === agreement.id && (
                                <TableRow>
                                  <TableCell colSpan={6} className="bg-muted/30">
                                    <div className="p-4 space-y-4">
                                      {agreement.description && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-1">Description</h5>
                                          <p className="text-sm text-muted-foreground">
                                            {agreement.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Assets in agreement */}
                                      {agreement.assets.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-2">Assets:</h5>
                                          <div className="grid grid-cols-2 gap-2">
                                            {agreement.assets.map((aa) => (
                                              <div
                                                key={aa.id}
                                                className="text-sm p-3 bg-background border rounded"
                                              >
                                                <div className="font-medium">{aa.asset.name}</div>
                                                <div className="text-muted-foreground text-xs">
                                                  {aa.asset.type}
                                                  {aa.allocatedPercentage &&
                                                    ` • ${aa.allocatedPercentage}%`}
                                                  {aa.allocatedValue &&
                                                    ` • RM${aa.allocatedValue.toLocaleString()}`}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Beneficiaries */}
                                      {agreement.beneficiaries.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-2">Beneficiaries:</h5>
                                          <div className="grid grid-cols-2 gap-2">
                                            {agreement.beneficiaries.map((beneficiary) => (
                                              <div
                                                key={beneficiary.id}
                                                className="text-sm p-3 bg-background border rounded"
                                              >
                                                <div className="font-medium">
                                                  {beneficiary.familyMember?.familyMemberUser?.name ||
                                                    beneficiary.nonRegisteredFamilyMember?.name}
                                                </div>
                                                <div className="text-muted-foreground text-xs">
                                                  {beneficiary.familyMember?.relation ||
                                                    beneficiary.nonRegisteredFamilyMember?.relation}
                                                  {beneficiary.sharePercentage &&
                                                    ` • ${beneficiary.sharePercentage}%`}
                                                  {beneficiary.shareDescription &&
                                                    ` • ${beneficiary.shareDescription}`}
                                                </div>
                                                <div className="flex gap-3 mt-2 text-xs">
                                                  <span
                                                    className={
                                                      beneficiary.hasSigned
                                                        ? 'text-green-600'
                                                        : 'text-red-600'
                                                    }
                                                  >
                                                    {beneficiary.hasSigned ? 'Signed' : 'Not Signed'}
                                                  </span>
                                                  <span
                                                    className={
                                                      beneficiary.isAccepted
                                                        ? 'text-green-600'
                                                        : 'text-red-600'
                                                    }
                                                  >
                                                    {beneficiary.isAccepted
                                                      ? 'Accepted'
                                                      : 'Not Accepted'}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Assets Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Assets ({userDetails.assets.length})
                  </h3>
                  {userDetails.assets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assets found</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {userDetails.assets.map((asset) => (
                        <div key={asset.id} className="border rounded-lg p-4 space-y-2">
                          <h4 className="font-medium">{asset.name}</h4>
                          <p className="text-sm text-muted-foreground">{asset.type}</p>
                          {asset.description && (
                            <p className="text-sm text-muted-foreground">
                              {asset.description}
                            </p>
                          )}
                          {asset.value && (
                            <p className="text-sm font-medium">
                              Value: RM{asset.value.toLocaleString()}
                            </p>
                          )}
                          {asset.documentUrl && (
                            <a
                              href={asset.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              View Document
                            </a>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Added {formatDate(asset.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                No details available
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
