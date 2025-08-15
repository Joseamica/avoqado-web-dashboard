import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UserPlus, MoreHorizontal, Pencil, Trash2, Mail, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { themeClasses } from '@/lib/theme-utils'
import DataTable from '@/components/data-table'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { TeamMember, StaffRole } from '@/types'
import teamService, { type Invitation } from '@/services/team.service'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import InviteTeamMemberForm from './components/InviteTeamMemberForm'
import EditTeamMemberForm from './components/EditTeamMemberForm'

export default function Teams() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)

  // Fetch team members
  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['team-members', venueId, pagination.pageIndex, pagination.pageSize, searchTerm],
    queryFn: () => teamService.getTeamMembers(venueId, pagination.pageIndex + 1, pagination.pageSize, searchTerm),
  })

  // Fetch pending invitations
  const { data: invitationsData, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['team-invitations', venueId],
    queryFn: () => teamService.getPendingInvitations(venueId),
  })

  // Remove team member mutation
  const removeTeamMemberMutation = useMutation({
    mutationFn: (memberId: string) => teamService.removeTeamMember(venueId, memberId),
    onSuccess: () => {
      toast({
        title: 'Miembro eliminado',
        description: 'El miembro del equipo ha sido eliminado correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      setRemovingMember(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar el miembro del equipo.',
        variant: 'destructive',
      })
    },
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.cancelInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: 'Invitación cancelada',
        description: 'La invitación ha sido cancelada correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo cancelar la invitación.',
        variant: 'destructive',
      })
    },
  })

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.resendInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: 'Invitación reenviada',
        description: 'La invitación ha sido reenviada correctamente.',
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo reenviar la invitación.',
        variant: 'destructive',
      })
    },
  })

  const getRoleBadgeColor = (role: StaffRole) => {
    const colors = {
      SUPERADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      OWNER: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
      ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
      MANAGER: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
      WAITER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
      CASHIER: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
      KITCHEN: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
      HOST: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
      VIEWER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
    }
    return colors[role] || colors.VIEWER
  }

  const getRoleDisplayName = (role: StaffRole) => {
    const names = {
      SUPERADMIN: 'Super Admin',
      OWNER: 'Propietario',
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      WAITER: 'Mesero',
      CASHIER: 'Cajero',
      KITCHEN: 'Cocina',
      HOST: 'Anfitrión',
      VIEWER: 'Visualizador',
    }
    return names[role] || role
  }

  const teamColumns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'firstName',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <div>
            <div className="font-medium">
              {row.original.firstName} {row.original.lastName}
            </div>
            <div className="text-sm text-gray-500">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge className={getRoleBadgeColor(row.original.role)}>
          {getRoleDisplayName(row.original.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'active',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'secondary'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalSales',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Ventas Totales
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          ${row.original.totalSales.toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: 'Órdenes',
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.totalOrders}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingMember(row.original)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setRemovingMember(row.original)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const invitationColumns: ColumnDef<Invitation>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.email}</div>
          <div className="text-sm text-gray-500">
            Invitado por {row.original.invitedBy.name}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge className={getRoleBadgeColor(row.original.role)}>
          {getRoleDisplayName(row.original.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Enviado',
      cell: ({ row }) => (
        <div className="text-sm">
          {new Date(row.original.createdAt).toLocaleDateString('es-ES')}
        </div>
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expira',
      cell: ({ row }) => {
        const isExpired = row.original.isExpired || row.original.status === 'EXPIRED'
        return (
          <div className={`text-sm ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
            <Clock className="h-4 w-4 inline mr-1" />
            {new Date(row.original.expiresAt).toLocaleDateString('es-ES')}
            {isExpired && <span className="ml-1 text-xs">(Expirada)</span>}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const isExpired = row.original.isExpired || row.original.status === 'EXPIRED'
        
        if (isExpired) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resendInvitationMutation.mutate(row.original.id)}
              disabled={resendInvitationMutation.isPending}
            >
              Reenviar
            </Button>
          )
        }
        
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => cancelInvitationMutation.mutate(row.original.id)}
            disabled={cancelInvitationMutation.isPending}
          >
            Cancelar
          </Button>
        )
      },
    },
  ]

  return (
    <div className={`p-4 ${themeClasses.pageBg} ${themeClasses.text}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-gray-600">Gestiona los miembros de tu equipo e invitaciones</p>
        </div>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Miembro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invitar Nuevo Miembro</DialogTitle>
              <DialogDescription>
                Envía una invitación por email para que se una a tu equipo.
              </DialogDescription>
            </DialogHeader>
            <InviteTeamMemberForm
              venueId={venueId}
              onSuccess={() => {
                setShowInviteDialog(false)
                queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
                queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">
            Miembros del Equipo ({teamData?.meta.totalCount || 0})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitaciones Pendientes ({invitationsData?.data.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Buscar miembros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <DataTable
                data={teamData?.data || []}
                columns={teamColumns}
                isLoading={isLoadingTeam}
                pagination={pagination}
                setPagination={setPagination}
                rowCount={teamData?.meta.totalCount || 0}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Invitaciones Pendientes
              </CardTitle>
              <CardDescription>
                Estas invitaciones están esperando respuesta. Expiran automáticamente después de 7 días.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={invitationsData?.data || []}
                columns={invitationColumns}
                isLoading={isLoadingInvitations}
                pagination={{ pageIndex: 0, pageSize: 50 }}
                setPagination={() => {}}
                rowCount={invitationsData?.data.length || 0}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Team Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Miembro</DialogTitle>
              <DialogDescription>
                Actualiza el rol y configuración de {editingMember.firstName} {editingMember.lastName}.
              </DialogDescription>
            </DialogHeader>
            <EditTeamMemberForm
              venueId={venueId}
              teamMember={editingMember}
              onSuccess={() => {
                setEditingMember(null)
                queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Team Member Alert */}
      {removingMember && (
        <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar miembro del equipo?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar a {removingMember.firstName} {removingMember.lastName} del equipo?
                Esta acción no se puede deshacer y el miembro perderá acceso al dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeTeamMemberMutation.mutate(removingMember.id)}
                disabled={removeTeamMemberMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {removeTeamMemberMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}