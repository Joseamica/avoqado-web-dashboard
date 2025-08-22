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
        title: 'Rol actualizado',
        description: 'El rol del usuario ha sido actualizado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error updating user role:', error)
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el rol del usuario.',
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
        title: `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`,
        description: `El usuario ha sido ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error toggling user status:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del usuario.',
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
        title: 'Usuario creado',
        description: 'El nuevo usuario ha sido creado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error creating user:', error)
      toast({
        title: 'Error',
        description: 'No se pudo crear el usuario.',
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
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => {
      console.error('Error deleting user:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el usuario.',
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
        title: 'Venue asignado',
        description: 'El usuario ha sido asignado al venue correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserToAssignVenue(null)
      setSelectedVenueId('')
    },
    onError: error => {
      console.error('Error assigning venue:', error)
      toast({
        title: 'Error',
        description: 'No se pudo asignar el venue al usuario.',
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
      header: 'Nombre',
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'role',
      header: 'Rol',
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
            <SelectItem value="USER">Usuario</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="VENUEADMIN">Admin de Venue</SelectItem>
            <SelectItem value="WAITER">Mesero</SelectItem>
            {isSuperAdmin && <SelectItem value="SUPERADMIN">Super Admin</SelectItem>}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: 'venue',
      header: 'Venue',
      cell: ({ row }) => <div className="max-w-[200px] truncate">{row.original.venueName || 'No asignado'}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <div className={`flex items-center ${row.original.status === 'active' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {row.original.status === 'active' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
          {row.original.status === 'active' ? 'Activo' : 'Inactivo'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
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
              'Desactivar'
            ) : (
              'Activar'
            )}
          </Button>

          {/* Only show these buttons for superadmins */}
          {isSuperAdmin && (
            <>
              <Button variant="outline" size="icon" onClick={() => setUserToAssignVenue(row.original)} title="Asignar a venue">
                <Building className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setUserToDelete(row.original)}
                className="text-red-500 hover:text-red-700"
                title="Eliminar usuario"
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
        Volver al Panel de Administración
      </Link>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h2>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">Crear Nuevo Usuario</DialogTitle>
              <DialogDescription className="text-muted-foreground">Completa los detalles para crear un nuevo usuario.</DialogDescription>
            </DialogHeader>
            <form id="createUserForm" onSubmit={handleCreateUser} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right text-sm font-medium text-muted-foreground">
                  Nombre
                </label>
                <Input id="name" className="col-span-3 bg-input" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input id="email" type="email" className="col-span-3 bg-input" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className="text-right text-sm font-medium text-muted-foreground">
                  Rol
                </label>
                <Select>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Usuario</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="VENUEADMIN">Admin de Venue</SelectItem>
                    <SelectItem value="WAITER">Mesero</SelectItem>
                    {isSuperAdmin && <SelectItem value="SUPERADMIN">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="venue" className="text-right text-sm font-medium text-muted-foreground">
                    Venue
                  </label>
                  <Select>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecciona un venue (opcional)" />
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
                    Guardando...
                  </>
                ) : (
                  'Guardar Usuario'
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
            <AlertDialogTitle className="text-foreground">Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar a {userToDelete?.name}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-red-50 hover:bg-red-600 dark:text-red-50"
              onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog for Venue Assignment */}
      <Dialog open={!!userToAssignVenue} onOpenChange={open => !open && setUserToAssignVenue(null)}>
        <DialogContent className="sm:max-w-[425px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Asignar a Venue</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecciona un venue para asignar a {userToAssignVenue?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un venue" />
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
              Cancelar
            </Button>
            <Button onClick={handleAssignVenue} disabled={!selectedVenueId || assignVenueMutation.isPending}>
              {assignVenueMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                'Asignar'
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
                placeholder="Buscar usuarios..."
                className="pl-8 w-[250px] bg-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="USER">Usuario</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="VENUEADMIN">Admin de Venue</SelectItem>
                <SelectItem value="WAITER">Mesero</SelectItem>
              </SelectContent>
            </Select>
            {filterRole !== 'all' && (
              <Button variant="ghost" size="icon" onClick={() => setFilterRole('all')} className="h-10 w-10">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <DataTable columns={columns} data={filteredUsers} rowCount={filteredUsers.length} isLoading={usersLoading} />

          <div className="text-xs text-muted-foreground mt-2">
            Mostrando {filteredUsers.length} de {userData.length} usuarios
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
