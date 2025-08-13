import api from '@/api'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { CheckCircle, Loader2, PlusCircle, UserCog, XCircle, PencilIcon, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// Define admin user interface
interface VenueAdmin {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  role: string
  status: 'active' | 'inactive'
}

export default function Teams() {
  const { venueId } = useCurrentVenue()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Get current user from auth context
  const { user: currentUser } = useAuth()

  // Query to fetch venue admins
  const { data: adminData = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['venue-admins', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/admins`)
      return response.data.data as VenueAdmin[]
    },
  })

  // Filter admins based on search and permissions
  const filteredAdmins =
    adminData && adminData.length > 0
      ? adminData.filter(admin => {
          // If the current user is not a SUPERADMIN, hide SUPERADMIN users
          const hasPermissionToView = currentUser?.role === 'SUPERADMIN' || admin.role !== 'SUPERADMIN'

          const matchesSearch =
            admin?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || admin?.email?.toLowerCase().includes(searchTerm.toLowerCase())

          return hasPermissionToView && matchesSearch
        })
      : []

  // Mutation to change admin role
  const roleChangeMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return await api.patch(`/v2/dashboard/${venueId}/admins/${userId}/role`, { role: newRole })
    },
    onSuccess: () => {
      toast({
        title: 'Rol actualizado',
        description: 'El rol del usuario ha sido actualizado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['venue-admins', venueId] })
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

  // Mutation to toggle admin status
  const statusToggleMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: string }) => {
      return await api.patch(`/v2/dashboard/${venueId}/admins/${userId}/status`, {
        status: currentStatus === 'active' ? 'inactive' : 'active',
      })
    },
    onSuccess: (_, variables) => {
      const newStatus = variables.currentStatus === 'active' ? 'inactive' : 'active'
      toast({
        title: `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`,
        description: `El usuario ha sido ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
      })
      queryClient.invalidateQueries({ queryKey: ['venue-admins', venueId] })
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

  // Mutation to add a new admin
  const addAdminMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return await api.post(`/v2/dashboard/${venueId}/admins`, userData)
    },
    onSuccess: () => {
      toast({
        title: 'Administrador añadido',
        description: 'El nuevo administrador ha sido añadido correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['venue-admins', venueId] })
      setIsAddUserDialogOpen(false)
      setNewUser({ firstName: '', lastName: '', email: '' })
    },
    onError: error => {
      console.error('Error adding admin:', error)
      toast({
        title: 'Error',
        description: 'No se pudo añadir el administrador.',
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

  // Handle add admin form submission
  const handleAddAdmin = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      toast({
        title: 'Datos incompletos',
        description: 'Por favor completa todos los campos.',
        variant: 'destructive',
      })
      return
    }

    addAdminMutation.mutate(newUser)
  }

  // Define columns for the DataTable
  const columns: ColumnDef<VenueAdmin>[] = [
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
      cell: ({ row }) => {
        const isSuperAdmin = row.original.role === 'SUPERADMIN'
        // Only SUPERADMIN users can change roles of other users to SUPERADMIN
        const canChangeSuperAdmin = currentUser?.role === 'SUPERADMIN'

        return (
          <Select
            defaultValue={row.original.role}
            onValueChange={value => handleRoleChange(row.original.id, value)}
            disabled={
              (roleChangeMutation.isPending && roleChangeMutation.variables?.userId === row.original.id) ||
              (isSuperAdmin && !canChangeSuperAdmin) /* Disable editing SUPERADMIN roles for non-SUPERADMIN users */
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="VENUEADMIN">Admin de Venue</SelectItem>
              {/* Only show SUPERADMIN option if the user already has that role or current user is SUPERADMIN */}
              {(isSuperAdmin || canChangeSuperAdmin) && <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <div className={`flex items-center ${row.original.status === 'active' ? themeClasses.success.text : themeClasses.error.text}`}>
          {row.original.status === 'active' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
          {row.original.status === 'active' ? 'Activo' : 'Inactivo'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        // Don't show actions for SUPERADMIN users unless current user is SUPERADMIN
        const isSuperAdmin = row.original.role === 'SUPERADMIN'
        const canManageSuperAdmin = currentUser?.role === 'SUPERADMIN'
        const shouldShowActions = !isSuperAdmin || canManageSuperAdmin

        if (!shouldShowActions) {
          return null
        }

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/dashboard/${venueId}/admins/${row.original.id}`)}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleStatusToggle(row.original.id, row.original.status)}
                  disabled={
                    (statusToggleMutation.isPending && statusToggleMutation.variables?.userId === row.original.id) || isSuperAdmin // Disable for SUPERADMIN users
                  }
                  className={isSuperAdmin ? 'text-muted-foreground cursor-not-allowed' : ''}
                >
                  {statusToggleMutation.isPending && statusToggleMutation.variables?.userId === row.original.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : row.original.status === 'active' ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activar
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Equipo de Administradores</h2>
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir nuevo administrador</DialogTitle>
              <DialogDescription>Ingresa los datos del nuevo administrador para este venue.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="firstName" className="col-span-1 text-right">
                  Nombre
                </label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="lastName" className="col-span-1 text-right">
                  Apellido
                </label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="col-span-1 text-right">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddAdmin} disabled={addAdminMutation.isPending}>
                {addAdminMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCog className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={`p-2 mt-4 mb-4 border rounded ${themeClasses.inputBg} ${themeClasses.border} max-w-72`}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable data={filteredAdmins} columns={columns} isLoading={adminsLoading} rowCount={filteredAdmins.length} />
        </CardContent>
      </Card>
    </div>
  )
}
