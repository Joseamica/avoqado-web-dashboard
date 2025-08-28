import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Clock, Mail, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import teamService, { type Invitation } from '@/services/team.service'
import { TeamMember } from '@/types'
import { filterSuperadminFromTeam, getRoleBadgeColor, getRoleDisplayName } from '@/utils/role-permissions'

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from 'react-i18next'

import EditTeamMemberForm from './components/EditTeamMemberForm'
import InviteTeamMemberForm from './components/InviteTeamMemberForm'

export default function Teams() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

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

  // Filter team members to hide superadmins from non-superadmin users
  const filteredTeamMembers = filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role)
  const filteredInvitations = filterSuperadminFromTeam(invitationsData?.data || [], staffInfo?.role)

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
            <div className="text-sm text-muted-foreground">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant="soft" className={getRoleBadgeColor(row.original.role, staffInfo?.role)}>
          {getRoleDisplayName(row.original.role, staffInfo?.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'active',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'secondary'}>{row.original.active ? 'Activo' : 'Inactivo'}</Badge>
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
      cell: ({ row }) => <div className="text-right font-medium">${row.original.totalSales.toLocaleString()}</div>,
    },
    {
      accessorKey: 'totalOrders',
      header: 'Órdenes',
      cell: ({ row }) => <div className="text-right">{row.original.totalOrders}</div>,
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
            <DropdownMenuItem onClick={() => setRemovingMember(row.original)} className="text-red-600">
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
          <div className="text-sm text-muted-foreground">Invitado por {row.original.invitedBy.name}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant="soft" className={getRoleBadgeColor(row.original.role, staffInfo?.role)}>
          {getRoleDisplayName(row.original.role, staffInfo?.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Enviado',
      cell: ({ row }) => <div className="text-sm">{new Date(row.original.createdAt).toLocaleDateString('es-ES')}</div>,
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
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">Gestiona los miembros de tu equipo e invitaciones</p>
        </div>

        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button id="invite-member-button">
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Miembro
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={e => {
              // Restore focus to the invite button for seamless keyboard flow
              e.preventDefault()
              const el = document.getElementById('invite-member-button') as HTMLButtonElement | null
              el?.focus()
            }}
          >
            <DialogHeader>
              <DialogTitle>Invitar Nuevo Miembro</DialogTitle>
              <DialogDescription>Envía una invitación por email para que se una a tu equipo.</DialogDescription>
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
        <TabsList className="inline-flex h-9 items-center justify-start rounded-full bg-muted px-1 py-1 text-muted-foreground">
          <TabsTrigger
            value="members"
            className="rounded-full px-3 py-1.5 text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-accent hover:text-accent-foreground"
          >
            <span>{t('teams.tabs.members')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground/10 px-1 text-xs text-foreground">
              {teamData?.meta.totalCount || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="invitations"
            className="rounded-full px-3 py-1.5 text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-accent hover:text-accent-foreground"
          >
            <span>{t('teams.tabs.invitations')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground/10 px-1 text-xs text-foreground">
              {invitationsData?.data.length || 0}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              id="team-search-input"
              placeholder="Buscar miembros..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <DataTable
            data={filteredTeamMembers}
            columns={teamColumns}
            isLoading={isLoadingTeam}
            pagination={pagination}
            setPagination={setPagination}
            tableId="team:members"
            rowCount={teamData?.meta.totalCount || 0}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Invitaciones Pendientes
              </CardTitle>
              <CardDescription>Estas invitaciones están esperando respuesta. Expiran automáticamente después de 7 días.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                data={filteredInvitations}
                columns={invitationColumns}
                isLoading={isLoadingInvitations}
                pagination={{ pageIndex: 0, pageSize: 50 }}
                setPagination={() => {}}
                tableId="team:invitations"
                rowCount={invitationsData?.data.length || 0}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Team Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={e => {
              // Restore focus to the team search input for quick keyboard navigation
              e.preventDefault()
              const el = document.getElementById('team-search-input') as HTMLInputElement | null
              el?.focus()
            }}
          >
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
                ¿Estás seguro de que deseas eliminar a {removingMember.firstName} {removingMember.lastName} del equipo? Esta acción no se
                puede deshacer y el miembro perderá acceso al dashboard.
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
