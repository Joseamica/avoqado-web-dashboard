import api from '@/api'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { themeClasses } from '@/lib/theme-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { CheckCircle, Loader2, PlusCircle, Search, UserCog, X, XCircle } from 'lucide-react'
import { useState } from 'react'

// Define user interface
interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
}

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const { toast } = useToast()
  const queryClient = useQueryClient()

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
    onSuccess: (response, variables) => {
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
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <div className="flex items-center">
          {row.original.status === 'active' ? (
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="mr-2 h-4 w-4 text-red-500" />
          )}
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
          <Button variant="outline" size="icon">
            <UserCog className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 h-screen space-y-6 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${themeClasses.text}`}>Gestión de Usuarios</h2>

        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className={`${themeClasses.cardBg} ${themeClasses.border}`}>
            <DialogHeader>
              <DialogTitle className={themeClasses.text}>Añadir Nuevo Usuario</DialogTitle>
              <DialogDescription className={themeClasses.textMuted}>
                Completa los datos para crear un nuevo usuario en el sistema
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className={`text-right ${themeClasses.text}`}>
                  Nombre
                </label>
                <Input id="name" className={`col-span-3 ${themeClasses.inputBg}`} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className={`text-right ${themeClasses.text}`}>
                  Email
                </label>
                <Input id="email" type="email" className={`col-span-3 ${themeClasses.inputBg}`} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className={`text-right ${themeClasses.text}`}>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreateUser} disabled={createUserMutation.isPending}>
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

      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-4">
        <div className="flex gap-2 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar usuarios..."
              className={`pl-8 w-[250px] ${themeClasses.inputBg}`}
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

        <div className={`text-xs ${themeClasses.textMuted} mt-2`}>
          Mostrando {filteredUsers.length} de {userData.length} usuarios
        </div>
      </div>
    </div>
  )
}
