import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { PlusCircle, Search, UserCog, X, CheckCircle, XCircle } from 'lucide-react'

// Datos de ejemplo para la tabla de usuarios
const mockUsers = [
  { id: '1', name: 'Juan Pérez', email: 'juan@ejemplo.com', role: 'USER', status: 'active' },
  { id: '2', name: 'Ana López', email: 'ana@ejemplo.com', role: 'ADMIN', status: 'active' },
  { id: '3', name: 'Carlos García', email: 'carlos@ejemplo.com', role: 'USER', status: 'inactive' },
  { id: '4', name: 'María Rodríguez', email: 'maria@ejemplo.com', role: 'VENUEADMIN', status: 'active' },
  { id: '5', name: 'Roberto Sánchez', email: 'roberto@ejemplo.com', role: 'USER', status: 'active' },
]

export default function UserManagement() {
  const [users, setUsers] = useState(mockUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const { toast } = useToast()

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = filterRole ? user.role === filterRole : true

    return matchesSearch && matchesRole
  })

  const handleRoleChange = (userId: string, newRole: string) => {
    // En una implementación real, aquí se enviaría una petición al servidor
    setUsers(users.map(user => (user.id === userId ? { ...user, role: newRole } : user)))

    toast({
      title: 'Rol actualizado',
      description: 'El rol del usuario ha sido actualizado correctamente.',
    })
  }

  const handleStatusToggle = (userId: string) => {
    // En una implementación real, aquí se enviaría una petición al servidor
    setUsers(
      users.map(user =>
        user.id === userId
          ? {
              ...user,
              status: user.status === 'active' ? 'inactive' : 'active',
            }
          : user,
      ),
    )

    const newStatus = users.find(u => u.id === userId)?.status === 'active' ? 'inactive' : 'active'

    toast({
      title: `Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`,
      description: `El usuario ha sido ${newStatus === 'active' ? 'activado' : 'desactivado'} correctamente.`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar usuarios..."
              className="pl-8 w-[250px]"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los roles</SelectItem>
              <SelectItem value="USER">Usuario</SelectItem>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="VENUEADMIN">Admin de Venue</SelectItem>
              <SelectItem value="WAITER">Mesero</SelectItem>
            </SelectContent>
          </Select>
          {filterRole && (
            <Button variant="ghost" size="icon" onClick={() => setFilterRole('')} className="h-10 w-10">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Nuevo Usuario</DialogTitle>
              <DialogDescription>Completa los datos para crear un nuevo usuario en el sistema</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Nombre
                </label>
                <Input id="name" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right">
                  Email
                </label>
                <Input id="email" type="email" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className="text-right">
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
              <Button type="submit">Guardar Usuario</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select defaultValue={user.role} onValueChange={value => handleRoleChange(user.id, value)}>
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
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {user.status === 'active' ? (
                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4 text-red-500" />
                      )}
                      {user.status === 'active' ? 'Activo' : 'Inactivo'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleStatusToggle(user.id)}>
                        {user.status === 'active' ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button variant="outline" size="icon">
                        <UserCog className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No se encontraron usuarios con los criterios de búsqueda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Mostrando {filteredUsers.length} de {users.length} usuarios
      </div>
    </div>
  )
}
