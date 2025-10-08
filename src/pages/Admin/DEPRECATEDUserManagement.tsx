import api from '@/api'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, CheckCircle, Loader2, PlusCircle, Search, Trash2, X, XCircle, Building } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from 'react-i18next'

// Define interfaces
interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  venueId?: string
  venueName?: string
}

interface Venue {
  id: string
  name: string
}

export default function UserManagement() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [userToAssignVenue, setUserToAssignVenue] = useState<User | null>(null)
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Check if current user is a superadmin
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  // Query to fetch all users
  const { data: userData = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/v1/admin/users')
      return response.data.data as User[]
    },
  })

  // Filter users based on search and role criteria
  const filteredUsers =
    userData && userData.length > 0
      ? userData.filter(user => {
          const matchesSearch =
            user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || user?.email?.toLowerCase().includes(searchTerm.toLowerCase())

          const matchesRole = filterRole === 'all' ? true : user.role === filterRole

          return matchesSearch && matchesRole
        })
      : []

  // Mutation to change user role
  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return await api.patch(`/v1/admin/users/${userId}/role`, { role: newRole })
    },
    onSuccess: () => {
      toast({
        title: t('admin.userManagement.roleUpdated'),
        description: t('admin.userManagement.roleUpdatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error updating user role:', error)
      toast({
        title: t('admin.userManagement.error'),
        description: t('admin.userManagement.roleUpdateError'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to toggle user status
  const statusToggleMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: string }) => {
      return await api.patch(`/v1/admin/users/${userId}/status`, {
        status: currentStatus === 'active' ? 'inactive' : 'active',
      })
    },
    onSuccess: (_, variables) => {
      const newStatus = variables.currentStatus === 'active' ? 'inactive' : 'active'
      toast({
        title: newStatus === 'active' ? t('admin.userManagement.userActivated') : t('admin.userManagement.userDeactivated'),
        description: newStatus === 'active' ? t('admin.userManagement.userActivatedDesc') : t('admin.userManagement.userDeactivatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error toggling user status:', error)
      toast({
        title: t('admin.userManagement.error'),
        description: t('admin.userManagement.statusUpdateError'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to create a new user
  const createUserMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      return await api.post('/v1/admin/users', userData)
    },
    onSuccess: () => {
      toast({
        title: t('admin.userManagement.userCreated'),
        description: t('admin.userManagement.userCreatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error creating user:', error)
      toast({
        title: t('admin.userManagement.error'),
        description: t('admin.userManagement.createUserError'),
        variant: 'destructive',
      })
    },
  })

  // Handle role change
  const handleRoleChange = (userId: string, newRole: string) => {
    roleChangeMutation.mutate({ userId, newRole })
  }

  // Handle status toggle
  const handleStatusToggle = (userId: string, currentStatus: string) => {
    statusToggleMutation.mutate({ userId, currentStatus })
  }

  // Handle create user form submission
  const handleCreateUser = (userData: any) => {
    createUserMutation.mutate(userData)
  }

  // Query to fetch all venues
  const { data: venuesData = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const response = await api.get('/v2/dashboard/venues')
      return response.data as Venue[]
    },
    // enabled: isSuperAdmin, // Only fetch if user is superadmin
  })

  // Mutation to delete a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await api.delete(`/v1/admin/users/${userId}`)
    },
    onSuccess: () => {
      toast({
        title: t('admin.userManagement.userDeleted'),
        description: t('admin.userManagement.userDeletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error deleting user:', error)
      toast({
        title: t('admin.userManagement.error'),
        description: t('admin.userManagement.deleteUserError'),
        variant: 'destructive',
      })
    },
  })

  // Mutation to assign user to venue
  const assignVenueMutation = useMutation({
    mutationFn: async ({ userId, venueId }: { userId: string; venueId: string }) => {
      return await api.post(`/v1/admin/users/${userId}/venue`, { venueId })
    },
    onSuccess: () => {
      toast({
        title: t('admin.userManagement.venueAssigned'),
        description: t('admin.userManagement.venueAssignedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserToAssignVenue(null)
      setSelectedVenueId('')
    },
    onError: error => {
      console.error('Error assigning venue:', error)
      toast({
        title: t('admin.userManagement.error'),
        description: t('admin.userManagement.assignVenueError'),
        variant: 'destructive',
      })
    },
  })

  // Handle user deletion
  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId)
    setUserToDelete(null)
  }

  // Handle venue assignment
  const handleAssignVenue = () => {
    if (userToAssignVenue && selectedVenueId) {
      assignVenueMutation.mutate({
        userId: userToAssignVenue.id,
        venueId: selectedVenueId,
      })
    }
  }

  // Define columns for the DataTable
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: t('admin.userManagement.columns.name'),
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: 'email',
      header: t('admin.userManagement.columns.email'),
    },
    {
      accessorKey: 'role',
      header: t('admin.userManagement.columns.role'),
      cell: ({ row }) => (
        <Select
          defaultValue={row.original.role}
          onValueChange={value => handleRoleChange(row.original.id, value)}
          disabled={roleChangeMutation.isPending && roleChangeMutation.variables?.userId === row.original.id}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">{t('admin.userManagement.roles.user')}</SelectItem>
            <SelectItem value="ADMIN">{t('admin.userManagement.roles.admin')}</SelectItem>
            <SelectItem value="VENUEADMIN">{t('admin.userManagement.roles.venueAdmin')}</SelectItem>
            <SelectItem value="WAITER">{t('admin.userManagement.roles.waiter')}</SelectItem>
            {isSuperAdmin && <SelectItem value="SUPERADMIN">{t('admin.userManagement.roles.superAdmin')}</SelectItem>}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: 'venue',
      header: t('admin.userManagement.columns.venue'),
      cell: ({ row }) => <div className="max-w-[200px] truncate">{row.original.venueName || t('admin.userManagement.notAssigned')}</div>,
    },
    {
      accessorKey: 'status',
      header: t('admin.userManagement.columns.status'),
      cell: ({ row }) => (
        <div className={`flex items-center ${row.original.status === 'active' ? 'text-green-700' : 'text-red-700'}`}>
          {row.original.status === 'active' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
          {row.original.status === 'active' ? t('admin.userManagement.status.active') : t('admin.userManagement.status.inactive')}
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('admin.userManagement.columns.actions'),
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusToggle(row.original.id, row.original.status)}
            disabled={statusToggleMutation.isPending && statusToggleMutation.variables?.userId === row.original.id}
          >
            {statusToggleMutation.isPending && statusToggleMutation.variables?.userId === row.original.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : row.original.status === 'active' ? (
              t('admin.userManagement.deactivate')
            ) : (
              t('admin.userManagement.activate')
            )}
          </Button>

          {/* Only show these buttons for superadmins */}
          {isSuperAdmin && (
            <>
              <Button variant="outline" size="icon" onClick={() => setUserToAssignVenue(row.original)} title={t('admin.userManagement.assignToVenue')}>
                <Building className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setUserToDelete(row.original)}
                className="text-red-500 hover:text-red-700"
                title={t('admin.userManagement.deleteUser')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]
  if (usersLoading || venuesLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }
  console.log(userToDelete)
  return (
    <div className="space-y-4 bg-background p-4 md:p-6 lg:p-8">
      <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('admin.userManagement.backToAdmin')}
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t('admin.userManagement.title')}</h2>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('admin.userManagement.addUser')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('admin.userManagement.createNewUser')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">{t('admin.userManagement.createNewUserDesc')}</DialogDescription>
            </DialogHeader>
            <form id="createUserForm" onSubmit={handleCreateUser} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right text-sm font-medium text-muted-foreground">
                  {t('admin.userManagement.form.name')}
                </label>
                <Input id="name" className="col-span-3 bg-input" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right text-sm font-medium text-muted-foreground">
                  {t('admin.userManagement.form.email')}
                </label>
                <Input id="email" type="email" className="col-span-3 bg-input" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className="text-right text-sm font-medium text-muted-foreground">
                  {t('admin.userManagement.form.role')}
                </label>
                <Select>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('admin.userManagement.form.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">{t('admin.userManagement.roles.user')}</SelectItem>
                    <SelectItem value="ADMIN">{t('admin.userManagement.roles.admin')}</SelectItem>
                    <SelectItem value="VENUEADMIN">{t('admin.userManagement.roles.venueAdmin')}</SelectItem>
                    <SelectItem value="WAITER">{t('admin.userManagement.roles.waiter')}</SelectItem>
                    {isSuperAdmin && <SelectItem value="SUPERADMIN">{t('admin.userManagement.roles.superAdmin')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="venue" className="text-right text-sm font-medium text-muted-foreground">
                    {t('admin.userManagement.form.venue')}
                  </label>
                  <Select>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={t('admin.userManagement.form.selectVenue')} />
                    </SelectTrigger>
                    <SelectContent>
                      {venuesData.map(venue => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form>
            <DialogFooter>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin.userManagement.saving')}
                  </>
                ) : (
                  t('admin.userManagement.saveUser')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={open => !open && setUserToDelete(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('admin.userManagement.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('admin.userManagement.confirmDeleteDesc', { name: userToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-foreground">{t('admin.userManagement.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-red-50 hover:bg-red-600"
              onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('admin.userManagement.deleting')}
                </>
              ) : (
                t('admin.userManagement.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog for Venue Assignment */}
      <Dialog open={!!userToAssignVenue} onOpenChange={open => !open && setUserToAssignVenue(null)}>
        <DialogContent className="sm:max-w-[425px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('admin.userManagement.assignVenue')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('admin.userManagement.assignVenueDesc', { name: userToAssignVenue?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.userManagement.selectVenue')} />
              </SelectTrigger>
              <SelectContent>
                {venuesData.map(venue => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToAssignVenue(null)}>
              {t('admin.userManagement.cancel')}
            </Button>
            <Button onClick={handleAssignVenue} disabled={!selectedVenueId || assignVenueMutation.isPending}>
              {assignVenueMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('admin.userManagement.assigning')}
                </>
              ) : (
                t('admin.userManagement.assign')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-card rounded-xl shadow-sm">
        {' '}
        {/* p-4 will be handled by CardContent */}
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('admin.userManagement.searchPlaceholder')}
                className="pl-8 w-[250px] bg-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('admin.userManagement.filterByRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.userManagement.allRoles')}</SelectItem>
                <SelectItem value="USER">{t('admin.userManagement.roles.user')}</SelectItem>
                <SelectItem value="ADMIN">{t('admin.userManagement.roles.admin')}</SelectItem>
                <SelectItem value="VENUEADMIN">{t('admin.userManagement.roles.venueAdmin')}</SelectItem>
                <SelectItem value="WAITER">{t('admin.userManagement.roles.waiter')}</SelectItem>
              </SelectContent>
            </Select>
            {filterRole !== 'all' && (
              <Button variant="ghost" size="icon" onClick={() => setFilterRole('all')} className="h-10 w-10">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <DataTable columns={columns} data={filteredUsers} rowCount={filteredUsers.length} isLoading={usersLoading} tableId="admin:users" />

          <div className="text-xs text-muted-foreground mt-2">
            {t('admin.userManagement.showing', { filtered: filteredUsers.length, total: userData.length })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
