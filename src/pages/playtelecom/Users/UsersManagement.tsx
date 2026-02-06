/**
 * UsersManagement - User Administration with split-panel layout
 *
 * Layout:
 * - Left sidebar (~280px): Searchable user list with status filters + invite button
 * - Main panel (flex-1): User detail with role, scope, permissions, audit log
 *
 * Note: Page title + breadcrumbs are provided by PlayTelecomLayout.
 * This component only renders the split-panel content.
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTeam, getZones, adminResetPassword, getStaffActivityLog, syncStaffVenues } from '@/services/storesAnalysis.service'
import { teamService } from '@/services/team.service'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import InviteTeamMemberForm, { type InviteTeamMemberFormRef } from '@/pages/Team/components/InviteTeamMemberForm'
import { StaffRole } from '@/types'
import { canModifyRole, getModifiableRoles } from '@/lib/permissions/roleHierarchy'
import { UserSidebar, UserDetailPanel, type UserListItem, type UserDetail, type Zone, type StoreOption, type AuditLogEntry } from './components'

/** Query key helpers */
const teamQueryKey = (venueId: string | null) => ['stores-analysis', venueId, 'team']

/** Map backend action codes → AuditLogTerminal action types */
const ACTION_TYPE_MAP: Record<string, AuditLogEntry['action']> = {
  ROLE_CHANGED: 'role_change',
  USER_ACTIVATED: 'login',
  USER_DEACTIVATED: 'logout',
  PASSWORD_RESET: 'password_reset',
  VENUE_ASSIGNED: 'store_assignment',
  VENUE_REMOVED: 'store_assignment',
  MASTER_LOGIN_SUCCESS: 'login',
  MASTER_LOGIN_FAILED: 'warning',
}

/** Build human-readable Spanish messages for each action */
const ACTION_MESSAGE_BUILDERS: Record<string, (data: Record<string, unknown> | null, by: string) => string> = {
  ROLE_CHANGED: (data, by) => `Rol cambiado de ${data?.oldRole || '?'} a ${data?.newRole || '?'} por ${by}`,
  USER_ACTIVATED: (_data, by) => `Usuario activado por ${by}`,
  USER_DEACTIVATED: (_data, by) => `Usuario desactivado por ${by}`,
  PASSWORD_RESET: (_data, by) => `Contraseña restablecida por ${by}`,
  VENUE_ASSIGNED: (data, by) => `Asignado a ${data?.venueName || 'tienda'} por ${by}`,
  VENUE_REMOVED: (data, by) => `Removido de ${data?.venueName || 'tienda'} por ${by}`,
  MASTER_LOGIN_SUCCESS: (_data, by) => `Inicio de sesión master por ${by}`,
  MASTER_LOGIN_FAILED: (_data, by) => `Intento de login master fallido por ${by}`,
}

export function UsersManagement() {
  const { t } = useTranslation(['playtelecom', 'common', 'team'])
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { staffInfo } = useAuth()

  // State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Invite dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [isInviteFormValid, setIsInviteFormValid] = useState(false)
  const inviteFormRef = useRef<InviteTeamMemberFormRef>(null)

  // Reset password dialog state
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch team members via organization-level endpoint
  const { data: teamMembers = [] } = useQuery({
    queryKey: teamQueryKey(venueId),
    queryFn: () => getTeam(venueId!),
    enabled: !!venueId,
  })

  // Fetch zones via venue-level endpoint
  const { data: orgZones = [] } = useQuery({
    queryKey: ['stores-analysis', venueId, 'zones'],
    queryFn: () => getZones(venueId!),
    enabled: !!venueId,
  })

  // Fetch activity log for selected user
  const selectedMember = teamMembers.find(m => m.id === selectedUserId)
  const selectedStaffId = selectedMember?.id
  const { data: rawActivityLog = [] } = useQuery({
    queryKey: ['stores-analysis', venueId, 'activity', selectedStaffId],
    queryFn: () => getStaffActivityLog(venueId!, selectedStaffId!),
    enabled: !!venueId && !!selectedStaffId,
  })

  // ---------- Mutations ----------

  // Update team member role
  const updateRoleMutation = useMutation({
    mutationFn: ({ staffVenueId, role }: { staffVenueId: string; role: StaffRole }) =>
      teamService.updateTeamMember(venueId!, staffVenueId, { role }),
    onSuccess: () => {
      toast({
        title: t('playtelecom:users.roleUpdated', { defaultValue: 'Rol actualizado' }),
      })
      queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'activity'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.roleUpdateError', { defaultValue: 'Error al actualizar rol' }),
        variant: 'destructive',
      })
    },
  })

  // Toggle active/inactive status
  const updateStatusMutation = useMutation({
    mutationFn: ({ staffVenueId, active }: { staffVenueId: string; active: boolean }) =>
      teamService.updateTeamMember(venueId!, staffVenueId, { active }),
    onSuccess: (_data, variables) => {
      toast({
        title: variables.active
          ? t('playtelecom:users.userActivated', { defaultValue: 'Usuario activado' })
          : t('playtelecom:users.userDeactivated', { defaultValue: 'Usuario desactivado' }),
      })
      queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'activity'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.statusUpdateError', { defaultValue: 'Error al cambiar estado' }),
        variant: 'destructive',
      })
    },
  })

  // Reset password mutation — shows result in a dialog so user can copy the password
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => adminResetPassword(venueId!, userId),
    onSuccess: data => {
      setTempPassword(data.temporaryPassword)
      setCopied(false)
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'activity'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.resetPasswordError', { defaultValue: 'Error al restablecer contraseña' }),
        variant: 'destructive',
      })
    },
  })

  // Sync venue assignments
  const syncVenuesMutation = useMutation({
    mutationFn: ({ staffId, venueIds }: { staffId: string; venueIds: string[] }) =>
      syncStaffVenues(venueId!, staffId, venueIds),
    onSuccess: (data) => {
      if (data.added > 0 || data.removed > 0) {
        toast({
          title: t('playtelecom:users.venuesUpdated', { defaultValue: 'Tiendas actualizadas' }),
        })
      }
      queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'activity'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.venuesUpdateError', { defaultValue: 'Error al actualizar tiendas' }),
        variant: 'destructive',
      })
    },
  })

  // ---------- Data Mapping ----------

  // Map zones for ScopeConfiguration
  const zones: Zone[] = useMemo(() => orgZones.map(z => ({ id: z.id, name: z.name })), [orgZones])

  // Collect all unique venues from zone data OR from team members' assigned venues
  const stores: StoreOption[] = useMemo(() => {
    // Primary source: zones endpoint (has zone grouping)
    const fromZones = orgZones.flatMap(z =>
      z.venues.map(v => ({
        id: v.id,
        name: v.name,
        zoneId: z.id,
      })),
    )
    if (fromZones.length > 0) return fromZones

    // Fallback: collect unique venues from all team members
    const venueMap = new Map<string, StoreOption>()
    for (const member of teamMembers) {
      for (const v of member.venues) {
        if (!venueMap.has(v.id)) {
          venueMap.set(v.id, { id: v.id, name: v.name, zoneId: 'all' })
        }
      }
    }
    return Array.from(venueMap.values())
  }, [orgZones, teamMembers])

  // Map API activity logs → AuditLogEntry format
  const auditLogEntries: AuditLogEntry[] = useMemo(
    () =>
      rawActivityLog.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        action: ACTION_TYPE_MAP[log.action] || 'warning',
        message: (ACTION_MESSAGE_BUILDERS[log.action] || ((_d: unknown, by: string) => `${log.action} por ${by}`))(log.data, log.performedBy),
      })),
    [rawActivityLog],
  )

  // Helper: get StaffVenue ID for a member in the current venue
  const getStaffVenueId = useCallback(
    (memberId: string): string | null => {
      const member = teamMembers.find(m => m.id === memberId)
      if (!member) return null
      const venueEntry = member.venues.find(v => v.id === venueId)
      return venueEntry?.staffVenueId || null
    },
    [teamMembers, venueId],
  )

  // Map API team members → UserDetail format using actual venue role and active status
  const usersFullData: UserDetail[] = useMemo(
    () =>
      teamMembers.map(member => {
        const currentVenue = member.venues.find(v => v.id === venueId)
        const currentVenueRole = currentVenue?.role || member.venues[0]?.role || 'VIEWER'
        const isActive = currentVenue?.active ?? true
        return {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`.trim(),
          email: member.email,
          phone: member.phone || undefined,
          role: currentVenueRole,
          status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
          selectedZone: null,
          selectedStores: member.venues.filter(v => v.active).map(v => v.id),
          permissions: [],
          auditLog: member.id === selectedUserId ? auditLogEntries : [],
        }
      }),
    [teamMembers, venueId, selectedUserId, auditLogEntries],
  )

  // Convert full users to list items for sidebar
  const userListItems: UserListItem[] = useMemo(
    () =>
      teamMembers.map(member => {
        const currentVenue = member.venues.find(v => v.id === venueId)
        const currentVenueRole = currentVenue?.role || member.venues[0]?.role || 'VIEWER'
        const isActive = currentVenue?.active ?? true
        return {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`.trim(),
          email: member.email,
          role: currentVenueRole,
          status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
          avatarUrl: member.photoUrl || undefined,
        }
      }),
    [teamMembers, venueId],
  )

  // Get selected user details
  const selectedUser = useMemo(() => usersFullData.find(u => u.id === selectedUserId) || null, [selectedUserId, usersFullData])

  // ---------- Role Hierarchy ----------

  const currentUserRole = staffInfo?.role as StaffRole | undefined

  // Can the current user edit the selected user?
  const canEditSelectedUser = useMemo(() => {
    if (!currentUserRole || !selectedUser) return false
    return canModifyRole(currentUserRole, selectedUser.role as StaffRole)
  }, [currentUserRole, selectedUser])

  // Which roles can the current user assign? (only roles they can modify, excluding SUPERADMIN/OWNER)
  const assignableRoles = useMemo(() => {
    if (!currentUserRole) return []
    return getModifiableRoles(currentUserRole).filter(
      r => r !== StaffRole.SUPERADMIN && r !== StaffRole.OWNER,
    )
  }, [currentUserRole])

  // ---------- Handlers ----------

  // Handle save (role change + venue assignments via API)
  const handleSave = useCallback(
    (updates: Partial<UserDetail>) => {
      if (!selectedUserId || !canEditSelectedUser) return

      // Sync role if changed (requires staffVenueId — skip if user has no access to this venue yet)
      if (updates.role) {
        const staffVenueId = getStaffVenueId(selectedUserId)
        if (staffVenueId) {
          const currentUser = usersFullData.find(u => u.id === selectedUserId)
          if (updates.role !== currentUser?.role) {
            updateRoleMutation.mutate({ staffVenueId, role: updates.role as StaffRole })
          }
        }
      }

      // Sync venue assignments if changed
      if (updates.selectedStores) {
        const currentUser = usersFullData.find(u => u.id === selectedUserId)
        const currentStores = currentUser?.selectedStores || []
        const newStores = updates.selectedStores
        const hasVenueChanges =
          currentStores.length !== newStores.length ||
          currentStores.some(id => !newStores.includes(id))
        if (hasVenueChanges) {
          syncVenuesMutation.mutate({ staffId: selectedUserId, venueIds: newStores })
        }
      }
    },
    [selectedUserId, canEditSelectedUser, getStaffVenueId, updateRoleMutation, syncVenuesMutation, usersFullData],
  )

  // Handle status change (activate/deactivate via API — no "blocked" state in backend)
  const handleStatusChange = useCallback(
    (status: 'active' | 'inactive') => {
      if (!selectedUserId || !canEditSelectedUser) return
      const staffVenueId = getStaffVenueId(selectedUserId)
      if (!staffVenueId) return
      updateStatusMutation.mutate({ staffVenueId, active: status === 'active' })
    },
    [selectedUserId, canEditSelectedUser, getStaffVenueId, updateStatusMutation],
  )

  // Handle reset password (uses Staff.id, not StaffVenue.id)
  const handleResetPassword = useCallback(() => {
    if (selectedUserId) {
      resetPasswordMutation.mutate(selectedUserId)
    }
  }, [selectedUserId, resetPasswordMutation])

  // Handle invite success
  const handleInviteSuccess = useCallback(() => {
    setShowInviteDialog(false)
    queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
    queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
    queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
  }, [venueId, queryClient])

  const isSaving = updateRoleMutation.isPending || updateStatusMutation.isPending || syncVenuesMutation.isPending

  return (
    <>
      <div className="flex gap-4 h-[calc(100dvh-12.5rem)] min-h-0">
        {/* Left Sidebar */}
        <div className="w-72 shrink-0 min-h-0 h-full">
          <UserSidebar
            users={userListItems}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
            onInvite={() => setShowInviteDialog(true)}
          />
        </div>

        {/* Main Panel */}
        <div className="flex-1 min-h-0 min-w-0">
          <UserDetailPanel
            user={selectedUser}
            zones={zones}
            stores={stores}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
            onResetPassword={handleResetPassword}
            isSaving={isSaving}
            canEdit={canEditSelectedUser}
            assignableRoles={assignableRoles}
          />
        </div>
      </div>

      {/* Invite Dialog */}
      {venueId && (
        <FullScreenModal
          open={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          title={t('team:header.inviteDialog.title', { defaultValue: 'Invitar Miembro' })}
          contentClassName="bg-muted/30"
          actions={
            <Button
              onClick={() => inviteFormRef.current?.submit()}
              disabled={!isInviteFormValid || isInviteSubmitting}
              className="cursor-pointer"
            >
              {isInviteSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  {t('team:invite.sending', { defaultValue: 'Enviando...' })}
                </>
              ) : (
                t('team:invite.sendButton', { defaultValue: 'Enviar Invitaci\u00f3n' })
              )}
            </Button>
          }
        >
          <div className="max-w-2xl mx-auto px-6 py-8">
            <InviteTeamMemberForm
              ref={inviteFormRef}
              venueId={venueId}
              onSuccess={handleInviteSuccess}
              onLoadingChange={setIsInviteSubmitting}
              onValidChange={setIsInviteFormValid}
            />
          </div>
        </FullScreenModal>
      )}

      {/* Temp Password Dialog */}
      <Dialog open={!!tempPassword} onOpenChange={open => { if (!open) setTempPassword(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('playtelecom:users.resetPasswordSuccess', { defaultValue: 'Contraseña restablecida' })}
            </DialogTitle>
            <DialogDescription>
              {t('playtelecom:users.resetPasswordHint', {
                defaultValue: 'Comparte esta contraseña temporal de forma segura. El usuario deberá cambiarla al iniciar sesión.',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted px-4 py-3 font-mono text-lg tracking-widest text-center select-all">
              {tempPassword}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 cursor-pointer"
              onClick={() => {
                if (tempPassword) {
                  navigator.clipboard.writeText(tempPassword)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }
              }}
            >
              {copied ? '✓' : t('common:copy', { defaultValue: 'Copiar' })}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTempPassword(null)} className="cursor-pointer">
              {t('common:close', { defaultValue: 'Cerrar' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default UsersManagement
