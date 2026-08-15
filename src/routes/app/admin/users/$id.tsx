import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import {
  Building2Icon,
  CalendarIcon,
  CheckCircleIcon,
  EditIcon,
  FileTextIcon,
  KeyIcon,
  Loader2,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'
import { getAdminSession } from '@/middleware'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface UserDetail {
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
  assets: Array<Asset>
  agreements: Array<Agreement>
  familyMembers: Array<FamilyMember>
  nonRegisteredFamilyMembers: Array<NonRegisteredFamilyMember>
  sessions: Array<Session>
  accounts: Array<Account>
}

interface Asset {
  id: number
  name: string
  type: string
  description: string | null
  value: number
  documentUrl: string | null
  createdAt: string
}

interface Agreement {
  id: string
  title: string
  description: string | null
  distributionType: string
  status: string
  createdAt: string
  updatedAt: string
  assets: Array<AgreementAsset>
  beneficiaries: Array<AgreementBeneficiary>
}

interface AgreementAsset {
  id: string
  assetId: number
  asset: {
    name: string
    type: string
  }
  allocatedValue: number | null
  allocatedPercentage: number | null
}

interface AgreementBeneficiary {
  id: string
  familyMemberId: number | null
  nonRegisteredFamilyMemberId: number | null
  sharePercentage: number
  shareDescription: string | null
  hasSigned: boolean
  isAccepted: boolean | null
  familyMember?: {
    relation: string
    familyMemberUser: {
      name: string
    }
  }
  nonRegisteredFamilyMember?: {
    name: string
    relation: string
  }
}

interface FamilyMember {
  id: number
  relation: string
  familyMemberUser: {
    id: string
    name: string
    email: string
  }
  createdAt: string
}

interface NonRegisteredFamilyMember {
  id: number
  name: string
  relation: string
  icNumber: string
  phoneNumber: string | null
  createdAt: string
}

interface Session {
  id: string
  token: string
  expiresAt: string
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
}

interface Account {
  id: string
  providerId: string
  accountId: string
  createdAt: string
}

export const Route = createFileRoute('/app/admin/users/$id')({
  loader: async ({ params }) => {
    const admin = await getAdminSession()
    if (!admin) {
      throw redirect({ to: '/app/dashboard' })
    }
    return { admin, userId: params.id }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { userId } = Route.useLoaderData()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Agreement | Asset | null>(
    null,
  )
  const [detailType, setDetailType] = useState<'agreement' | 'asset' | null>(
    null,
  )
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    icNumber: '',
    phoneNumber: '',
    address: '',
    emailVerified: false,
  })

  const fetchUserDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/detail`)
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setEditForm({
          name: data.user.name,
          email: data.user.email,
          icNumber: data.user.icNumber || '',
          phoneNumber: data.user.phoneNumber || '',
          address: data.user.address || '',
          emailVerified: data.user.emailVerified,
        })
      } else {
        toast.error('Failed to fetch user details')
        navigate({ to: '/app/admin/users' })
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('Failed to fetch user details')
      navigate({ to: '/app/admin/users' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserDetails()
  }, [userId])

  const handleUpdateUser = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        toast.success('User updated successfully')
        setEditDialogOpen(false)
        fetchUserDetails()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    }
  }

  const handleDeleteUser = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('User deleted successfully')
        setDeleteDialogOpen(false)
        navigate({ to: '/app/admin/users' })
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
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
    return variants[status] || 'secondary'
  }

  const canDeleteUser = user
    ? user.agreements.length === 0 && user.assets.length === 0
    : false

  const openDetailDialog = (
    item: Agreement | Asset,
    type: 'agreement' | 'asset',
  ) => {
    setSelectedItem(item)
    setDetailType(type)
    setDetailDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">User not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-border/70 bg-gradient-to-r from-sky-50/60 via-background to-emerald-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserIcon className="h-5 w-5" />
                {user.name}
              </CardTitle>
              <CardDescription className="mt-1">User Details</CardDescription>
            </div>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <EditIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={!canDeleteUser}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardAction>
          </div>
        </CardHeader>
      </Card>

      {/* Personal Information */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            Basic user details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Full Name
              </p>
              <p className="text-base">{user.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <div className="flex items-center gap-2">
                <MailIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{user.email}</p>
                {user.emailVerified ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                IC Number
              </p>
              <p className="text-base">{user.icNumber || 'Not provided'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Phone Number
              </p>
              <div className="flex items-center gap-2">
                <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">
                  {user.phoneNumber || 'Not provided'}
                </p>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                Address
              </p>
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{user.address || 'Not provided'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Member Since
              </p>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Last Updated
              </p>
              <p className="text-base">{formatDate(user.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{user.assets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Agreements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {user.agreements.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Family Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {user.familyMembers.length +
                user.nonRegisteredFamilyMembers.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {
                user.sessions.filter((s) => new Date(s.expiresAt) > new Date())
                  .length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2Icon className="h-5 w-5" />
            Assets ({user.assets.length})
          </CardTitle>
          <CardDescription>All assets owned by this user</CardDescription>
        </CardHeader>
        <CardContent>
          {user.assets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No assets found
            </p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/35">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.assets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetailDialog(asset, 'asset')}
                  >
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.type}</Badge>
                    </TableCell>
                    <TableCell>{asset.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(asset.value)}
                    </TableCell>
                    <TableCell>{formatDate(asset.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Agreements */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileTextIcon className="h-5 w-5" />
            Agreements ({user.agreements.length})
          </CardTitle>
          <CardDescription>
            All distribution agreements created by this user
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.agreements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No agreements found
            </p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/35">
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
                {user.agreements.map((agreement) => (
                  <TableRow
                    key={agreement.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetailDialog(agreement, 'agreement')}
                  >
                    <TableCell className="font-medium">
                      {agreement.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {agreement.distributionType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(agreement.status)}>
                        {agreement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{agreement.assets.length}</TableCell>
                    <TableCell>{agreement.beneficiaries.length}</TableCell>
                    <TableCell>{formatDate(agreement.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Family Members */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Registered Family Members */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersIcon className="h-5 w-5" />
              Registered Family Members ({user.familyMembers.length})
            </CardTitle>
            <CardDescription>
              Family members who are also system users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.familyMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No registered family members
              </p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Relation</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.familyMembers.map((fm) => (
                    <TableRow key={fm.id}>
                      <TableCell className="font-medium">
                        {fm.familyMemberUser.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{fm.relation}</Badge>
                      </TableCell>
                      <TableCell>{fm.familyMemberUser.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Non-Registered Family Members */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">
              Non-Registered Family Members (
              {user.nonRegisteredFamilyMembers.length})
            </CardTitle>
            <CardDescription>
              Family members not yet registered in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.nonRegisteredFamilyMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No non-registered family members
              </p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Relation</TableHead>
                    <TableHead>IC Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.nonRegisteredFamilyMembers.map((nrfm) => (
                    <TableRow key={nrfm.id}>
                      <TableCell className="font-medium">{nrfm.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{nrfm.relation}</Badge>
                      </TableCell>
                      <TableCell>{nrfm.icNumber}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sessions & Accounts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sessions */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyIcon className="h-5 w-5" />
              Sessions ({user.sessions.length})
            </CardTitle>
            <CardDescription>Login history and active sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {user.sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No sessions found
              </p>
            ) : (
              <div className="space-y-3">
                {user.sessions.map((session) => {
                  const isExpired = new Date(session.expiresAt) < new Date()
                  return (
                    <Card key={session.id} className="border-border/70">
                      <CardContent className="text-sm p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Created: {formatDate(session.createdAt)}
                          </span>
                          {isExpired ? (
                            <Badge variant="secondary">Expired</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          Expires: {formatDate(session.expiresAt)}
                        </p>
                        {session.ipAddress && (
                          <p className="text-muted-foreground">
                            IP: {session.ipAddress}
                          </p>
                        )}
                        {session.userAgent && (
                          <p className="text-xs text-muted-foreground truncate">
                            {session.userAgent}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">
              Accounts ({user.accounts.length})
            </CardTitle>
            <CardDescription>Linked authentication providers</CardDescription>
          </CardHeader>
          <CardContent>
            {user.accounts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No linked accounts
              </p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/35">
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Linked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium capitalize">
                        {account.providerId}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.accountId}
                      </TableCell>
                      <TableCell>{formatDate(account.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information.</DialogDescription>
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
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ic">IC Number</Label>
              <Input
                id="edit-ic"
                value={editForm.icNumber}
                onChange={(e) =>
                  setEditForm({ ...editForm, icNumber: e.target.value })
                }
                placeholder="Enter IC number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editForm.phoneNumber}
                onChange={(e) =>
                  setEditForm({ ...editForm, phoneNumber: e.target.value })
                }
                placeholder="+60123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
                placeholder="Enter address"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-verified"
                checked={editForm.emailVerified}
                onChange={(e) =>
                  setEditForm({ ...editForm, emailVerified: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="edit-verified">Email Verified</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={!editForm.name || !editForm.email}
            >
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
              Are you sure you want to delete this user? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              <strong>Name:</strong> {user.name}
              <br />
              <strong>Email:</strong> {user.email}
            </p>
            {!canDeleteUser && (
              <p className="text-sm text-red-600 mt-2">
                Warning: This user has {user.agreements.length} agreement(s) and{' '}
                {user.assets.length} asset(s). You cannot delete users with
                existing agreements or assets.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={!canDeleteUser}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open)
          if (!open) {
            setSelectedItem(null)
            setDetailType(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailType === 'agreement'
                ? 'Agreement Details'
                : 'Asset Details'}
            </DialogTitle>
            <DialogDescription>
              {detailType === 'agreement'
                ? selectedItem && (selectedItem as Agreement).title
                : selectedItem && (selectedItem as Asset).name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {detailType === 'agreement' && selectedItem ? (
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-1">Description</h5>
                  <p className="text-sm text-muted-foreground">
                    {(selectedItem as Agreement).description ||
                      'No description'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium mb-1">
                      Distribution Type
                    </h5>
                    <Badge variant="outline">
                      {(selectedItem as Agreement).distributionType}
                    </Badge>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium mb-1">Status</h5>
                    <Badge
                      variant={getStatusBadge(
                        (selectedItem as Agreement).status,
                      )}
                    >
                      {(selectedItem as Agreement).status}
                    </Badge>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium mb-1">Created</h5>
                    <p className="text-sm text-muted-foreground">
                      {formatDate((selectedItem as Agreement).createdAt)}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium mb-1">Last Updated</h5>
                    <p className="text-sm text-muted-foreground">
                      {formatDate((selectedItem as Agreement).updatedAt)}
                    </p>
                  </div>
                </div>
                {(selectedItem as Agreement).assets.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">
                      Allocated Assets
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedItem as Agreement).assets.map((aa) => (
                        <div
                          key={aa.id}
                          className="text-sm p-3 bg-muted/50 rounded"
                        >
                          <div className="font-medium">{aa.asset.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {aa.asset.type}
                            {aa.allocatedPercentage &&
                              ` • ${aa.allocatedPercentage}%`}
                            {aa.allocatedValue &&
                              ` • ${formatCurrency(aa.allocatedValue)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(selectedItem as Agreement).beneficiaries.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Beneficiaries</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedItem as Agreement).beneficiaries.map((ab) => (
                        <div
                          key={ab.id}
                          className="text-sm p-3 bg-muted/50 rounded"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {ab.familyMember?.familyMemberUser?.name ||
                                ab.nonRegisteredFamilyMember?.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {ab.familyMember?.relation ||
                                ab.nonRegisteredFamilyMember?.relation}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground text-xs mb-2">
                            {ab.sharePercentage}% share
                            {ab.shareDescription && ` • ${ab.shareDescription}`}
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span
                              className={
                                ab.hasSigned ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {ab.hasSigned ? 'Signed' : 'Not Signed'}
                            </span>
                            {ab.isAccepted === true && (
                              <span className="text-green-600">Accepted</span>
                            )}
                            {ab.isAccepted === false && (
                              <span className="text-red-600">Rejected</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : detailType === 'asset' && selectedItem ? (
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-1">Name</h5>
                  <p className="text-base">{(selectedItem as Asset).name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium mb-1">Type</h5>
                    <Badge variant="outline">
                      {(selectedItem as Asset).type}
                    </Badge>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium mb-1">Value</h5>
                    <p className="text-base font-medium">
                      {formatCurrency((selectedItem as Asset).value)}
                    </p>
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-1">Description</h5>
                  <p className="text-sm text-muted-foreground">
                    {(selectedItem as Asset).description || 'No description'}
                  </p>
                </div>
                {(selectedItem as Asset).documentUrl && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Document</h5>
                    <a
                      href={(selectedItem as Asset).documentUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Document
                    </a>
                  </div>
                )}
                <div>
                  <h5 className="text-sm font-medium mb-1">Created</h5>
                  <p className="text-sm text-muted-foreground">
                    {formatDate((selectedItem as Asset).createdAt)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
