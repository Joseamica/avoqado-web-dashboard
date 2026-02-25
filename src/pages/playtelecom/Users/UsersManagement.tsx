/**
 * UsersManagement - User Administration with DataTable list
 *
 * Layout:
 * - Header: Stripe-style FilterPill bar (Rol, Estado, Tiendas) + invite button
 * - Body: Full-width DataTable with searchable user list
 * - Detail: FullScreenModal with embedded UserDetailPanel
 *
 * Note: Page title + breadcrumbs are provided by PlayTelecomLayout.
 * This component only renders the filter bar + table + modals.
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTeam, getZones, adminResetPassword, getStaffActivityLog, syncStaffVenues } from '@/services/storesAnalysis.service'
import { teamService } from '@/services/team.service'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { getRoleBadgeColor } from '@/utils/role-permissions'
import DataTable from '@/components/data-table'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import InviteTeamMemberForm, { type InviteTeamMemberFormRef } from '@/pages/Team/components/InviteTeamMemberForm'
import { StaffRole } from '@/types'
import { canModifyRole, getModifiableRoles } from '@/lib/permissions/roleHierarchy'
import { UserDetailPanel, type UserDetailPanelRef, type UserListItem, type UserDetail, type Zone, type StoreOption, type AuditLogEntry } from './components'
import { UserCheck, UserX, UserPlus, Store, X, Save, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Query key helpers */
const teamQueryKey = (venueId: string | null) => ['stores-analysis', venueId, 'team']

/** Map backend action codes -> AuditLogTerminal action types */
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

/** Extended list item with venue count + venueIds for the table */
interface UserRow extends UserListItem {
  activeVenueCount: number
  activeVenueIds: string[]
}

export function UsersManagement() {
  const { t } = useTranslation(['playtelecom', 'common', 'team'])
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const { getDisplayName, getColor, activeRoles } = useRoleConfig()

  // State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Stripe-style filter state (arrays for multi-select)
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [storesFilter, setStoresFilter] = useState<string[]>([])

  // Invite dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [isInviteFormValid, setIsInviteFormValid] = useState(false)
  const inviteFormRef = useRef<InviteTeamMemberFormRef>(null)

  // Detail panel ref + dirty state (for modal header save/reset buttons)
  const detailPanelRef = useRef<UserDetailPanelRef>(null)
  const [detailHasChanges, setDetailHasChanges] = useState(false)

  // Reset password dialog state
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch team members via organization-level endpoint
  const { data: teamMembers = [], isLoading } = useQuery({
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

  const updateRoleMutation = useMutation({
    mutationFn: ({ staffVenueId, role }: { staffVenueId: string; role: StaffRole }) =>
      teamService.updateTeamMember(venueId!, staffVenueId, { role }),
    onSuccess: () => {
      toast({ title: t('playtelecom:users.roleUpdated', { defaultValue: 'Rol actualizado' }) })
      queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'activity'] })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:users.roleUpdateError', { defaultValue: 'Error al actualizar rol' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

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
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:users.statusUpdateError', { defaultValue: 'Error al cambiar estado' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

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

  const syncVenuesMutation = useMutation({
    mutationFn: ({ staffId, venueIds }: { staffId: string; venueIds: string[] }) =>
      syncStaffVenues(venueId!, staffId, venueIds),
    onSuccess: (data) => {
      if (data.added > 0 || data.removed > 0) {
        toast({ title: t('playtelecom:users.venuesUpdated', { defaultValue: 'Tiendas actualizadas' }) })
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

  const zones: Zone[] = useMemo(() => orgZones.map(z => ({ id: z.id, name: z.name })), [orgZones])

  const allStores: StoreOption[] = useMemo(() => {
    const fromZones = orgZones.flatMap(z =>
      z.venues.map(v => ({ id: v.id, name: v.name, zoneId: z.id })),
    )
    if (fromZones.length > 0) return fromZones
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

  const getStaffVenueId = useCallback(
    (memberId: string): string | null => {
      const member = teamMembers.find(m => m.id === memberId)
      if (!member) return null
      const venueEntry = member.venues.find(v => v.id === venueId)
      return venueEntry?.staffVenueId || null
    },
    [teamMembers, venueId],
  )

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

  // Table rows
  const userRows: UserRow[] = useMemo(
    () =>
      teamMembers.map(member => {
        const currentVenue = member.venues.find(v => v.id === venueId)
        const currentVenueRole = currentVenue?.role || member.venues[0]?.role || 'VIEWER'
        const isActive = currentVenue?.active ?? true
        const activeVenues = member.venues.filter(v => v.active)
        return {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`.trim(),
          email: member.email,
          role: currentVenueRole,
          status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
          avatarUrl: member.photoUrl || undefined,
          activeVenueCount: activeVenues.length,
          activeVenueIds: activeVenues.map(v => v.id),
        }
      }),
    [teamMembers, venueId],
  )

  // ---------- Filter Options ----------

  const roleOptions = useMemo(() =>
    activeRoles.map(rc => ({ value: rc.role, label: getDisplayName(rc.role) })),
    [activeRoles, getDisplayName],
  )

  const statusOptions = useMemo(() => [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ], [])

  const storesOptions = useMemo(() =>
    allStores.map(s => ({ value: s.id, label: s.name })),
    [allStores],
  )

  // Filter display label helper
  const getFilterLabel = useCallback((values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) return options.find(o => o.value === values[0])?.label || values[0]
    return `${values.length} seleccionados`
  }, [])

  // Count active filters
  const activeFiltersCount = [roleFilter.length > 0, statusFilter.length > 0, storesFilter.length > 0].filter(Boolean).length

  const resetFilters = useCallback(() => {
    setRoleFilter([])
    setStatusFilter([])
    setStoresFilter([])
  }, [])

  // Apply all filters
  const filteredRows = useMemo(() => {
    let rows = userRows
    if (roleFilter.length > 0) {
      rows = rows.filter(u => roleFilter.includes(u.role))
    }
    if (statusFilter.length > 0) {
      rows = rows.filter(u => statusFilter.includes(u.status))
    }
    if (storesFilter.length > 0) {
      rows = rows.filter(u => u.activeVenueIds.some(id => storesFilter.includes(id)))
    }
    return rows
  }, [userRows, roleFilter, statusFilter, storesFilter])

  const selectedUser = useMemo(() => usersFullData.find(u => u.id === selectedUserId) || null, [selectedUserId, usersFullData])

  // ---------- Role Hierarchy ----------

  const currentUserRole = staffInfo?.role as StaffRole | undefined

  const canEditSelectedUser = useMemo(() => {
    if (!currentUserRole || !selectedUser) return false
    return canModifyRole(currentUserRole, selectedUser.role as StaffRole)
  }, [currentUserRole, selectedUser])

  const assignableRoles = useMemo(() => {
    if (!currentUserRole) return []
    return getModifiableRoles(currentUserRole).filter(
      r => r !== StaffRole.SUPERADMIN && r !== StaffRole.OWNER,
    )
  }, [currentUserRole])

  // ---------- Handlers ----------

  const handleSave = useCallback(
    (updates: Partial<UserDetail>) => {
      if (!selectedUserId || !canEditSelectedUser) return
      if (updates.role) {
        const staffVenueId = getStaffVenueId(selectedUserId)
        if (staffVenueId) {
          const currentUser = usersFullData.find(u => u.id === selectedUserId)
          if (updates.role !== currentUser?.role) {
            updateRoleMutation.mutate({ staffVenueId, role: updates.role as StaffRole })
          }
        }
      }
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

  const handleStatusChange = useCallback(
    (status: 'active' | 'inactive') => {
      if (!selectedUserId || !canEditSelectedUser) return
      const staffVenueId = getStaffVenueId(selectedUserId)
      if (!staffVenueId) return
      updateStatusMutation.mutate({ staffVenueId, active: status === 'active' })
    },
    [selectedUserId, canEditSelectedUser, getStaffVenueId, updateStatusMutation],
  )

  const handleResetPassword = useCallback(() => {
    if (selectedUserId) {
      resetPasswordMutation.mutate(selectedUserId)
    }
  }, [selectedUserId, resetPasswordMutation])

  const handleInviteSuccess = useCallback(() => {
    setShowInviteDialog(false)
    queryClient.invalidateQueries({ queryKey: teamQueryKey(venueId) })
    queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
    queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
  }, [venueId, queryClient])

  // Client-side search for DataTable
  const handleSearch = useCallback((search: string, rows: UserRow[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [])

  const isSaving = updateRoleMutation.isPending || updateStatusMutation.isPending || syncVenuesMutation.isPending

  // ---------- Column Definitions ----------

  const columns: ColumnDef<UserRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('playtelecom:users.columns.user', { defaultValue: 'Usuario' }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
                {row.original.avatarUrl ? (
                  <img src={row.original.avatarUrl} alt={row.original.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>{row.original.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-background',
                  row.original.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{row.original.name}</p>
              <p className="text-xs text-muted-foreground truncate">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: t('playtelecom:users.columns.role', { defaultValue: 'Rol' }),
        cell: ({ row }) => {
          const role = row.original.role
          const customColor = getColor(role)
          const fallbackClasses = getRoleBadgeColor(role as StaffRole)
          return (
            <span
              className={cn(
                'inline-flex items-center h-5 px-2 text-[10px] font-medium rounded-full leading-none',
                customColor ? 'border border-current/20' : fallbackClasses,
              )}
              style={
                customColor
                  ? { backgroundColor: `${customColor}20`, color: customColor, borderColor: `${customColor}40` }
                  : undefined
              }
            >
              {getDisplayName(role)}
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: t('playtelecom:users.columns.status', { defaultValue: 'Estado' }),
        cell: ({ row }) => {
          const isActive = row.original.status === 'active'
          return (
            <Badge variant={isActive ? 'default' : 'secondary'} className="text-[11px] h-5 px-2">
              {isActive ? (
                <><UserCheck className="w-3 h-3 mr-1" />{t('playtelecom:users.status.active', { defaultValue: 'Activo' })}</>
              ) : (
                <><UserX className="w-3 h-3 mr-1" />{t('playtelecom:users.status.inactive', { defaultValue: 'Inactivo' })}</>
              )}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'activeVenueCount',
        header: t('playtelecom:users.columns.stores', { defaultValue: 'Tiendas' }),
        cell: ({ row }) => {
          const count = row.original.activeVenueCount
          if (count === 0) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Store className="w-3.5 h-3.5" />
              <span>{count}</span>
            </div>
          )
        },
      },
    ],
    [t, getDisplayName, getColor],
  )

  // ---------- Render ----------

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  return (
    <>
      {/* Stripe-style filter bar: filters left, actions right */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 mb-4">
        {/* Rol filter — matches column order */}
        <FilterPill
          label="Rol"
          activeValue={getFilterLabel(roleFilter, roleOptions)}
          isActive={roleFilter.length > 0}
          onClear={() => setRoleFilter([])}
        >
          <CheckboxFilterContent
            title="Filtrar por Rol"
            options={roleOptions}
            selectedValues={roleFilter}
            onApply={setRoleFilter}
          />
        </FilterPill>

        {/* Estado filter */}
        <FilterPill
          label="Estado"
          activeValue={getFilterLabel(statusFilter, statusOptions)}
          isActive={statusFilter.length > 0}
          onClear={() => setStatusFilter([])}
        >
          <CheckboxFilterContent
            title="Filtrar por Estado"
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={setStatusFilter}
          />
        </FilterPill>

        {/* Tiendas filter */}
        <FilterPill
          label="Tiendas"
          activeValue={getFilterLabel(storesFilter, storesOptions)}
          isActive={storesFilter.length > 0}
          onClear={() => setStoresFilter([])}
        >
          <CheckboxFilterContent
            title="Filtrar por Tienda"
            options={storesOptions}
            selectedValues={storesFilter}
            searchable={storesOptions.length > 5}
            onApply={setStoresFilter}
          />
        </FilterPill>

        {/* Reset filters button */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1.5 rounded-full cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            Borrar filtros
          </Button>
        )}

        {/* Push invite button right */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => setShowInviteDialog(true)}
            className="h-10 gap-1.5 rounded-xl cursor-pointer px-4"
          >
            <UserPlus className="w-4 h-4" />
            {t('playtelecom:users.invite', { defaultValue: 'Invitar' })}
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        data={filteredRows}
        columns={columns}
        rowCount={filteredRows.length}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedUserId(row.id)}
        tableId="playtelecom:users"
        enableSearch
        searchPlaceholder={t('playtelecom:users.searchPlaceholder', { defaultValue: 'Buscar usuario...' })}
        onSearch={handleSearch}
      />

      {/* User Detail Modal */}
      <FullScreenModal
        open={!!selectedUserId}
        onClose={() => { setSelectedUserId(null); setDetailHasChanges(false) }}
        title={selectedUser?.name || ''}
        contentClassName="bg-muted/30"
        actions={
          canEditSelectedUser ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => detailPanelRef.current?.reset()}
                disabled={!detailHasChanges || isSaving}
                className="h-8 text-xs cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {t('common:reset', { defaultValue: 'Restablecer' })}
              </Button>
              <Button
                size="sm"
                onClick={() => detailPanelRef.current?.save()}
                disabled={!detailHasChanges || isSaving}
                className="h-8 text-xs cursor-pointer"
              >
                <Save className="w-3 h-3 mr-1" />
                {isSaving
                  ? t('common:saving', { defaultValue: 'Guardando...' })
                  : t('common:saveChanges', { defaultValue: 'Guardar Cambios' })}
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="max-w-3xl mx-auto px-6 py-6">
          <UserDetailPanel
            ref={detailPanelRef}
            user={selectedUser}
            zones={zones}
            stores={allStores}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
            onResetPassword={handleResetPassword}
            isSaving={isSaving}
            canEdit={canEditSelectedUser}
            assignableRoles={assignableRoles}
            embedded
            onHasChangesChange={setDetailHasChanges}
          />
        </div>
      </FullScreenModal>

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
