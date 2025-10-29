import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Clock, Mail, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'

import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
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
import { getIntlLocale } from '@/utils/i18n-locale'

import EditTeamMemberForm from './components/EditTeamMemberForm'
import InviteTeamMemberForm from './components/InviteTeamMemberForm'
import { PermissionGate } from '@/components/PermissionGate'

export default function Teams() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)

  // Fetch team members
  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['team-members', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () => teamService.getTeamMembers(venueId, pagination.pageIndex + 1, pagination.pageSize),
    refetchOnWindowFocus: true,
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
        title: t('teams.toasts.memberRemovedTitle'),
        description: t('teams.toasts.memberRemovedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      setRemovingMember(null)
    },
    onError: (error: any) => {
      toast({
        title: t('teams.toasts.memberRemoveErrorTitle'),
        description: error.response?.data?.message || t('teams.toasts.memberRemoveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.cancelInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: t('teams.toasts.invitationCanceledTitle'),
        description: t('teams.toasts.invitationCanceledDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('teams.toasts.invitationCancelErrorTitle'),
        description: error.response?.data?.message || t('teams.toasts.invitationCancelErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.resendInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: t('teams.toasts.invitationResentTitle'),
        description: t('teams.toasts.invitationResentDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: t('teams.toasts.invitationResendErrorTitle'),
        description: error.response?.data?.message || t('teams.toasts.invitationResendErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Filter team members to hide superadmins from non-superadmin users
  // CRITICAL: Must be memoized to prevent infinite re-render loop
  // filterSuperadminFromTeam() returns new array for non-SUPERADMIN roles
  const filteredTeamMembers = useMemo(
    () => filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role),
    [teamData?.data, staffInfo?.role]
  )

  const filteredInvitations = useMemo(
    () => filterSuperadminFromTeam(invitationsData?.data || [], staffInfo?.role),
    [invitationsData?.data, staffInfo?.role]
  )

  // Client-side search like Payments page - wrapped in useCallback to prevent recreation
  const handleMemberSearch = useCallback((search: string, rows: TeamMember[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(m => {
      const name = `${m.firstName} ${m.lastName}`.toLowerCase()
      const email = (m.email || '').toLowerCase()
      const role = (m.role || '').toString().toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q)
    })
  }, [])

  const handleInvitationSearch = useCallback((search: string, rows: Invitation[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(inv => {
      const email = (inv.email || '').toLowerCase()
      const inviter = (inv.invitedBy?.name || '').toLowerCase()
      const role = (inv.role || '').toString().toLowerCase()
      return email.includes(q) || inviter.includes(q) || role.includes(q)
    })
  }, [])

  // Memoize column definitions to prevent recreation on every render
  const teamColumns: ColumnDef<TeamMember>[] = useMemo(() => [
    {
      accessorKey: 'firstName',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('teams.columns.name')}
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
      header: t('teams.columns.role'),
      cell: ({ row }) => (
        <Badge variant="soft" className={getRoleBadgeColor(row.original.role, staffInfo?.role)}>
          {getRoleDisplayName(row.original.role, staffInfo?.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'active',
      header: t('teams.columns.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'secondary'}>
          {row.original.active ? t('teams.status.active') : t('teams.status.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalSales',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          {t('teams.columns.totalSales')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {Number(row.original.totalSales).toLocaleString(getIntlLocale(i18n.language))}
        </div>
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: t('teams.columns.totalOrders'),
      cell: ({ row }) => <div className="text-right">{row.original.totalOrders}</div>,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PermissionGate permission="teams:update">
              <DropdownMenuItem onClick={() => setEditingMember(row.original)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('teams.actions.edit')}
              </DropdownMenuItem>
            </PermissionGate>
            <DropdownMenuSeparator />
            <PermissionGate permission="teams:delete">
              <DropdownMenuItem onClick={() => setRemovingMember(row.original)} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('teams.actions.delete')}
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [t, i18n.language, staffInfo?.role])

  const invitationColumns: ColumnDef<Invitation>[] = useMemo(() => [
    {
      accessorKey: 'email',
      header: t('teams.columns.email'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.email}</div>
          <div className="text-sm text-muted-foreground">{t('teams.columns.invitedBy', { name: row.original.invitedBy.name })}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: t('teams.columns.role'),
      cell: ({ row }) => (
        <Badge variant="soft" className={getRoleBadgeColor(row.original.role, staffInfo?.role)}>
          {getRoleDisplayName(row.original.role, staffInfo?.role)}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('teams.columns.sent'),
      cell: ({ row }) => (
        <div className="text-sm">{new Date(row.original.createdAt).toLocaleDateString(getIntlLocale(i18n.language))}</div>
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: t('teams.columns.expires'),
      cell: ({ row }) => {
        const isExpired = row.original.isExpired || row.original.status === 'EXPIRED'
        return (
          <div className={`text-sm ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
            <Clock className="h-4 w-4 inline mr-1" />
            {new Date(row.original.expiresAt).toLocaleDateString(getIntlLocale(i18n.language))}
            {isExpired && <span className="ml-1 text-xs">{t('teams.labels.expiredTag')}</span>}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
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
              {t('teams.actions.resend')}
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
            {t('teams.actions.cancel')}
          </Button>
        )
      },
    },
  ], [t, i18n.language, staffInfo?.role])

  return (
    <div className={`p-4 bg-background text-foreground`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('teams.header.title')}</h1>
          <p className="text-muted-foreground">{t('teams.header.subtitle')}</p>
        </div>

        <PermissionGate permission="teams:invite">
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button id="invite-member-button">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('teams.header.inviteButton')}
              </Button>
            </DialogTrigger>
            {showInviteDialog && (
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
                  <DialogTitle>{t('teams.header.inviteDialog.title')}</DialogTitle>
                  <DialogDescription>{t('teams.header.inviteDialog.desc')}</DialogDescription>
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
            )}
          </Dialog>
        </PermissionGate>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="members"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <span>{t('teams.tabs.members')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {teamData?.meta.totalCount || 0}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="invitations"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <span>{t('teams.tabs.invitations')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {invitationsData?.data.length || 0}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <DataTable
            data={filteredTeamMembers}
            columns={teamColumns}
            isLoading={isLoadingTeam}
            pagination={pagination}
            setPagination={setPagination}
            tableId="team:members"
            rowCount={teamData?.meta.totalCount || 0}
            enableSearch={true}
            searchPlaceholder={t('common.search')}
            onSearch={handleMemberSearch}
            clickableRow={row => ({ to: row.id })}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                {t('teams.cards.pendingInvitationsTitle')}
              </CardTitle>
              <CardDescription>{t('teams.cards.pendingInvitationsDesc')}</CardDescription>
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
                enableSearch={true}
                searchPlaceholder={t('common.search')}
                onSearch={handleInvitationSearch}
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
              // Focus back to tab list
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('teams.dialogs.editMemberTitle')}</DialogTitle>
              <DialogDescription>
                {t('teams.dialogs.editMemberDesc', { firstName: editingMember.firstName, lastName: editingMember.lastName })}
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
              <AlertDialogTitle>{t('teams.dialogs.removeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('teams.dialogs.removeDesc', { firstName: removingMember.firstName, lastName: removingMember.lastName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('teams.dialogs.removeCancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeTeamMemberMutation.mutate(removingMember.id)}
                disabled={removeTeamMemberMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {removeTeamMemberMutation.isPending ? t('teams.dialogs.removing') : t('teams.dialogs.removeConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
