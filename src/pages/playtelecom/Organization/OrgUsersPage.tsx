/**
 * OrgUsersPage - Organization-level user management
 *
 * Shows ALL staff across the organization with their venue assignments.
 * Uses org-level endpoints via useCurrentOrganization().
 *
 * Layout:
 * - Header: PageTitleWithInfo + filter bar
 * - Body: DataTable with user list
 * - Detail: FullScreenModal with user info, role, venue assignment, PIN, activity
 */

import DataTable from '@/components/data-table'
import { CheckboxFilterContent, FilterPill } from '@/components/filters'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useToast } from '@/hooks/use-toast'
import { useOrgTeam, useOrgZones } from '@/hooks/useOrganizationConfig'
import { canModifyRole, getModifiableRoles } from '@/lib/permissions/roleHierarchy'
import { cn } from '@/lib/utils'
import {
  getOrgTeamMemberActivity,
  resetOrgTeamMemberPassword,
  syncOrgTeamMemberVenues,
  updateOrgTeamMemberPin,
  updateOrgTeamMemberRole,
  updateOrgTeamMemberStatus,
  type OrgTeamMember,
} from '@/services/organizationConfig.service'
import { StaffRole } from '@/types'
import { getRoleBadgeColor } from '@/utils/role-permissions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Ban, Calendar, Eye, EyeOff, KeyRound, Mail, Phone, RotateCcw, Save, Store, UserCheck, UserX, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditLogTerminal, type AuditLogEntry } from '../Users/components/AuditLogTerminal'
import { RoleSelectionCards } from '../Users/components/RoleSelectionCards'

// ---------- Types ----------

interface OrgUserRow {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  avatarUrl?: string
  venueCount: number
  venueNames: string[]
  pin?: string
}

// ---------- Constants ----------

const ACTION_TYPE_MAP: Record<string, AuditLogEntry['action']> = {
  ROLE_CHANGED: 'role_change',
  USER_ACTIVATED: 'login',
  USER_DEACTIVATED: 'logout',
  PASSWORD_RESET: 'password_reset',
  VENUE_ASSIGNED: 'store_assignment',
  VENUE_REMOVED: 'store_assignment',
}

const ACTION_MESSAGE_BUILDERS: Record<string, (data: Record<string, unknown> | null, by: string) => string> = {
  ROLE_CHANGED: (data, by) => `Rol cambiado de ${data?.oldRole || '?'} a ${data?.newRole || '?'} por ${by}`,
  USER_ACTIVATED: (_data, by) => `Usuario activado por ${by}`,
  USER_DEACTIVATED: (_data, by) => `Usuario desactivado por ${by}`,
  PASSWORD_RESET: (_data, by) => `Contrasena restablecida por ${by}`,
  VENUE_ASSIGNED: (data, by) => `Asignado a ${data?.venueName || 'tienda'} por ${by}`,
  VENUE_REMOVED: (data, by) => `Removido de ${data?.venueName || 'tienda'} por ${by}`,
}

// ---------- PIN Cell (own state to avoid memoization issues) ----------

function PinCell({ pin }: { pin?: string | null }) {
  const [visible, setVisible] = useState(false)
  if (!pin) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs tracking-widest">{visible ? pin : '••••'}</span>
      <span
        role="button"
        className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted cursor-pointer"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setVisible(v => !v) }}
      >
        {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </span>
    </div>
  )
}

// ---------- Component ----------

export default function OrgUsersPage() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { orgId, venues: orgVenues } = useCurrentOrganization()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const { getDisplayName, getColor } = useRoleConfig()

  // State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [storesFilter, setStoresFilter] = useState<string[]>([])

  // Detail panel local state
  const [editRole, setEditRole] = useState<string>('')
  const [editVenueIds, setEditVenueIds] = useState<string[]>([])
  const [editPin, setEditPin] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // PIN visibility toggle (detail modal)
  const [showPin, setShowPin] = useState(false)

  // Temp password dialog
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch team
  const { data: teamData, isLoading } = useOrgTeam()
  const teamMembers = useMemo(() => teamData?.team ?? [], [teamData?.team])

  // Fetch zones
  const { data: orgZonesData = [] } = useOrgZones()

  // Fetch activity log for selected user
  const selectedMember = teamMembers.find(m => m.id === selectedUserId)
  const { data: rawActivityLog = [] } = useQuery({
    queryKey: ['org-config', orgId, 'activity', selectedUserId],
    queryFn: () => getOrgTeamMemberActivity(orgId!, selectedUserId!),
    enabled: !!orgId && !!selectedUserId,
  })

  // ---------- Mutations ----------

  const updateRoleMutation = useMutation({
    mutationFn: ({ staffId, role }: { staffId: string; role: string }) => updateOrgTeamMemberRole(orgId!, staffId, role),
    onSuccess: () => {
      toast({ title: t('playtelecom:users.roleUpdated', { defaultValue: 'Rol actualizado' }) })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'activity'] })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:users.roleUpdateError', { defaultValue: 'Error al actualizar rol' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ staffId, active }: { staffId: string; active: boolean }) => updateOrgTeamMemberStatus(orgId!, staffId, active),
    onSuccess: (_data, variables) => {
      toast({
        title: variables.active
          ? t('playtelecom:users.userActivated', { defaultValue: 'Usuario activado' })
          : t('playtelecom:users.userDeactivated', { defaultValue: 'Usuario desactivado' }),
      })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'activity'] })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:users.statusUpdateError', { defaultValue: 'Error al cambiar estado' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const syncVenuesMutation = useMutation({
    mutationFn: ({ staffId, venueIds }: { staffId: string; venueIds: string[] }) => syncOrgTeamMemberVenues(orgId!, staffId, venueIds),
    onSuccess: data => {
      if (data.added > 0 || data.removed > 0) {
        toast({ title: t('playtelecom:users.venuesUpdated', { defaultValue: 'Tiendas actualizadas' }) })
      }
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.venuesUpdateError', { defaultValue: 'Error al actualizar tiendas' }),
        variant: 'destructive',
      })
    },
  })

  const updatePinMutation = useMutation({
    mutationFn: ({ staffId, pin }: { staffId: string; pin: string }) => updateOrgTeamMemberPin(orgId!, staffId, pin),
    onSuccess: () => {
      toast({ title: t('playtelecom:users.pinUpdated', { defaultValue: 'PIN actualizado' }) })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('playtelecom:users.pinUpdateError', { defaultValue: 'Error al actualizar PIN' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (staffId: string) => resetOrgTeamMemberPassword(orgId!, staffId),
    onSuccess: data => {
      setTempPassword(data.temporaryPassword)
      setCopied(false)
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'activity'] })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.resetPasswordError', { defaultValue: 'Error al restablecer contrasena' }),
        variant: 'destructive',
      })
    },
  })

  // ---------- Data Mapping ----------

  const auditLogEntries: AuditLogEntry[] = useMemo(
    () =>
      rawActivityLog.map((log: any) => ({
        id: log.id,
        timestamp: log.createdAt,
        action: ACTION_TYPE_MAP[log.action] || 'warning',
        message: (ACTION_MESSAGE_BUILDERS[log.action] || ((_d: unknown, by: string) => `${log.action} por ${by}`))(
          log.data,
          log.performedBy,
        ),
      })),
    [rawActivityLog],
  )

  // All venues from the org context
  const allVenueOptions = useMemo(() => {
    // First try from zones
    const zonesArray = Array.isArray(orgZonesData) ? orgZonesData : []
    const fromZones = zonesArray.flatMap((z: any) => z.venues?.map((v: any) => ({ id: v.id, name: v.name })) ?? [])
    if (fromZones.length > 0) return fromZones

    // Fallback to orgVenues
    return orgVenues.map(v => ({ id: v.id, name: v.name }))
  }, [orgZonesData, orgVenues])

  // Table rows
  const userRows: OrgUserRow[] = useMemo(
    () =>
      teamMembers.map(member => {
        const activeVenues = member.venues.filter(v => v.active)
        // Use the first venue's role as the primary display role
        const primaryRole = member.venues[0]?.role || 'VIEWER'
        const isActive = activeVenues.length > 0 && activeVenues.some(v => v.active)
        // Get first venue's pin if available
        const pin = member.venues[0]?.pin

        return {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`.trim(),
          email: member.email,
          role: primaryRole,
          status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
          avatarUrl: member.photoUrl || undefined,
          venueCount: activeVenues.length,
          venueNames: activeVenues.map(v => v.venueName),
          pin,
        }
      }),
    [teamMembers],
  )

  // ---------- Filter Options ----------

  const roleOptions = useMemo(() => {
    const uniqueRoles = [...new Set(teamMembers.flatMap(m => m.venues.map(v => v.role)))]
    return uniqueRoles.map(role => ({
      value: role,
      label: getDisplayName(role as any) || role,
    }))
  }, [teamMembers, getDisplayName])

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('playtelecom:users.status.active', { defaultValue: 'Activo' }) },
      { value: 'inactive', label: t('playtelecom:users.status.inactive', { defaultValue: 'Inactivo' }) },
    ],
    [t],
  )

  const storeOptions = useMemo(() => {
    return allVenueOptions.map(v => ({ value: v.id, label: v.name }))
  }, [allVenueOptions])

  const getFilterLabel = useCallback((values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) return options.find(o => o.value === values[0])?.label || values[0]
    return `${values.length} seleccionados`
  }, [])

  const activeFiltersCount = [roleFilter.length > 0, statusFilter.length > 0, storesFilter.length > 0].filter(Boolean).length

  const resetFilters = useCallback(() => {
    setRoleFilter([])
    setStatusFilter([])
    setStoresFilter([])
  }, [])

  // Apply filters
  const filteredRows = useMemo(() => {
    let rows = userRows
    if (roleFilter.length > 0) {
      rows = rows.filter(u => roleFilter.includes(u.role))
    }
    if (statusFilter.length > 0) {
      rows = rows.filter(u => statusFilter.includes(u.status))
    }
    if (storesFilter.length > 0) {
      rows = rows.filter(u => {
        const member = teamMembers.find(m => m.id === u.id)
        return member?.venues.some(v => v.active && storesFilter.includes(v.id))
      })
    }
    return rows
  }, [userRows, roleFilter, statusFilter, storesFilter, teamMembers])

  // ---------- Role Hierarchy ----------

  const currentUserRole = staffInfo?.role as StaffRole | undefined

  const canEditSelectedUser = useMemo(() => {
    if (!currentUserRole || !selectedMember) return false
    const targetRole = selectedMember.venues[0]?.role as StaffRole | undefined
    if (!targetRole) return false
    return canModifyRole(currentUserRole, targetRole)
  }, [currentUserRole, selectedMember])

  const assignableRoles = useMemo(() => {
    if (!currentUserRole) return []
    return getModifiableRoles(currentUserRole).filter(r => r !== StaffRole.SUPERADMIN && r !== StaffRole.OWNER)
  }, [currentUserRole])

  // ---------- Detail Init ----------

  const initDetailState = useCallback((member: OrgTeamMember) => {
    const primaryRole = member.venues[0]?.role || 'VIEWER'
    const activeVenueIds = member.venues.filter(v => v.active).map(v => v.id)
    const pin = member.venues[0]?.pin || ''
    setEditRole(primaryRole)
    setEditVenueIds(activeVenueIds)
    setEditPin(pin)
    setHasChanges(false)
    setShowPin(false)
  }, [])

  // ---------- Handlers ----------

  const handleRowClick = useCallback(
    (row: OrgUserRow) => {
      setSelectedUserId(row.id)
      const member = teamMembers.find(m => m.id === row.id)
      if (member) initDetailState(member)
    },
    [teamMembers, initDetailState],
  )

  const handleCloseModal = useCallback(() => {
    setSelectedUserId(null)
    setHasChanges(false)
  }, [])

  const handleSave = useCallback(() => {
    if (!selectedUserId || !canEditSelectedUser) return

    const member = teamMembers.find(m => m.id === selectedUserId)
    if (!member) return

    // Role change
    const currentRole = member.venues[0]?.role
    if (editRole !== currentRole) {
      updateRoleMutation.mutate({ staffId: selectedUserId, role: editRole })
    }

    // Venue sync
    const currentVenueIds = member.venues.filter(v => v.active).map(v => v.id)
    const hasVenueChanges = currentVenueIds.length !== editVenueIds.length || currentVenueIds.some(id => !editVenueIds.includes(id))
    if (hasVenueChanges) {
      syncVenuesMutation.mutate({ staffId: selectedUserId, venueIds: editVenueIds })
    }

    // PIN change
    const currentPin = member.venues[0]?.pin || ''
    if (editPin && editPin !== currentPin) {
      updatePinMutation.mutate({ staffId: selectedUserId, pin: editPin })
    }

    setHasChanges(false)
  }, [
    selectedUserId,
    canEditSelectedUser,
    teamMembers,
    editRole,
    editVenueIds,
    editPin,
    updateRoleMutation,
    syncVenuesMutation,
    updatePinMutation,
  ])

  const handleReset = useCallback(() => {
    if (!selectedMember) return
    initDetailState(selectedMember)
  }, [selectedMember, initDetailState])

  const handleStatusChange = useCallback(
    (active: boolean) => {
      if (!selectedUserId || !canEditSelectedUser) return
      updateStatusMutation.mutate({ staffId: selectedUserId, active })
    },
    [selectedUserId, canEditSelectedUser, updateStatusMutation],
  )

  const handleResetPassword = useCallback(() => {
    if (selectedUserId) {
      resetPasswordMutation.mutate(selectedUserId)
    }
  }, [selectedUserId, resetPasswordMutation])

  const handleSearch = useCallback((search: string, rows: OrgUserRow[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [])

  const handleVenueToggle = useCallback((venueId: string) => {
    setEditVenueIds(prev => {
      const next = prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
      setHasChanges(true)
      return next
    })
  }, [])

  const isSaving =
    updateRoleMutation.isPending || updateStatusMutation.isPending || syncVenuesMutation.isPending || updatePinMutation.isPending

  // ---------- Computed for detail ----------

  const selectedUserStatus = useMemo(() => {
    if (!selectedMember) return 'inactive'
    return selectedMember.venues.some(v => v.active) ? 'active' : 'inactive'
  }, [selectedMember])

  // ---------- Column Definitions ----------

  const columns: ColumnDef<OrgUserRow>[] = useMemo(
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
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-sm truncate">{row.original.name}</p>
                {row.original.email.includes('@internal.avoqado.io') && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 border-amber-500/40 text-amber-500">Solo TPV</Badge>
                )}
              </div>
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
              style={customColor ? { backgroundColor: `${customColor}20`, color: customColor, borderColor: `${customColor}40` } : undefined}
            >
              {getDisplayName(role)}
            </span>
          )
        },
      },
      {
        accessorKey: 'venueCount',
        header: t('playtelecom:users.columns.stores', { defaultValue: 'Tiendas' }),
        cell: ({ row }) => {
          const count = row.original.venueCount
          if (count === 0) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Store className="w-3.5 h-3.5" />
              <span>{count}</span>
            </div>
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
                <>
                  <UserCheck className="w-3 h-3 mr-1" />
                  {t('playtelecom:users.status.active', { defaultValue: 'Activo' })}
                </>
              ) : (
                <>
                  <UserX className="w-3 h-3 mr-1" />
                  {t('playtelecom:users.status.inactive', { defaultValue: 'Inactivo' })}
                </>
              )}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'pin',
        header: 'PIN',
        cell: ({ row }) => <PinCell pin={row.original.pin} />,
      },
    ],
    [t, getDisplayName, getColor],
  )

  // ---------- Render ----------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-60" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <PageTitleWithInfo
          title={t('playtelecom:users.orgTitle', { defaultValue: 'Gestion de Personal' })}
          tooltip={t('playtelecom:users.orgTooltip', {
            defaultValue: 'Administra los roles, tiendas asignadas y PIN de todo el personal de tu organizacion.',
          })}
        />

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <FilterPill
            label={t('playtelecom:users.columns.role', { defaultValue: 'Rol' })}
            activeValue={getFilterLabel(roleFilter, roleOptions)}
            isActive={roleFilter.length > 0}
            onClear={() => setRoleFilter([])}
          >
            <CheckboxFilterContent
              title={t('playtelecom:users.filterByRole', { defaultValue: 'Filtrar por Rol' })}
              options={roleOptions}
              selectedValues={roleFilter}
              onApply={setRoleFilter}
            />
          </FilterPill>

          <FilterPill
            label={t('playtelecom:users.columns.status', { defaultValue: 'Estado' })}
            activeValue={getFilterLabel(statusFilter, statusOptions)}
            isActive={statusFilter.length > 0}
            onClear={() => setStatusFilter([])}
          >
            <CheckboxFilterContent
              title={t('playtelecom:users.filterByStatus', { defaultValue: 'Filtrar por Estado' })}
              options={statusOptions}
              selectedValues={statusFilter}
              onApply={setStatusFilter}
            />
          </FilterPill>

          <FilterPill
            label={t('playtelecom:users.filters.stores', { defaultValue: 'Tiendas' })}
            activeValue={getFilterLabel(storesFilter, storeOptions)}
            isActive={storesFilter.length > 0}
            onClear={() => setStoresFilter([])}
          >
            <CheckboxFilterContent
              title={t('playtelecom:users.filters.filterByStore', { defaultValue: 'Filtrar por Tienda' })}
              options={storeOptions}
              selectedValues={storesFilter}
              onApply={setStoresFilter}
              searchable
              searchPlaceholder={t('playtelecom:users.filters.searchStores', { defaultValue: 'Buscar tienda...' })}
            />
          </FilterPill>

          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 gap-1.5 rounded-full cursor-pointer">
              <X className="h-3.5 w-3.5" />
              {t('playtelecom:users.clearFilters', { defaultValue: 'Borrar filtros' })}
            </Button>
          )}
        </div>

        {/* Table */}
        <DataTable
          data={filteredRows}
          columns={columns}
          rowCount={filteredRows.length}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          tableId="org:users"
          enableSearch
          searchPlaceholder={t('playtelecom:users.searchPlaceholder', { defaultValue: 'Buscar usuario...' })}
          onSearch={handleSearch}
        />
      </div>

      {/* User Detail Modal */}
      <FullScreenModal
        open={!!selectedUserId}
        onClose={handleCloseModal}
        title={selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}`.trim() : ''}
        contentClassName="bg-muted/30"
        actions={
          canEditSelectedUser ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
                className="h-8 text-xs cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {t('common:reset', { defaultValue: 'Restablecer' })}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving} className="h-8 text-xs cursor-pointer">
                <Save className="w-3 h-3 mr-1" />
                {isSaving
                  ? t('common:saving', { defaultValue: 'Guardando...' })
                  : t('common:saveChanges', { defaultValue: 'Guardar Cambios' })}
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedMember && (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
            {/* User Info Card */}
            <GlassCard className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
                      {selectedMember.photoUrl ? (
                        <img
                          src={selectedMember.photoUrl}
                          alt={selectedMember.firstName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{selectedMember.firstName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card',
                        selectedUserStatus === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold truncate">
                        {`${selectedMember.firstName} ${selectedMember.lastName}`.trim()}
                      </h2>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {getDisplayName(selectedMember.venues[0]?.role || 'VIEWER')}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{selectedMember.email}</span>
                      </span>
                      {selectedMember.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          {selectedMember.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {new Date(selectedMember.createdAt).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant={selectedUserStatus === 'active' ? 'default' : 'secondary'} className="shrink-0 text-xs">
                  {selectedUserStatus === 'active' ? <UserCheck className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                  {selectedUserStatus === 'active'
                    ? t('playtelecom:users.status.active', { defaultValue: 'Activo' })
                    : t('playtelecom:users.status.inactive', { defaultValue: 'Inactivo' })}
                </Badge>
              </div>

              {/* Quick Actions */}
              {canEditSelectedUser && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPassword}
                    className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3 mr-1" />
                    {t('playtelecom:users.resetPassword', { defaultValue: 'Restablecer Contrasena' })}
                  </Button>
                  {selectedUserStatus === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(false)}
                      className="h-7 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400 dark:hover:text-yellow-300 cursor-pointer"
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      {t('playtelecom:users.deactivate', { defaultValue: 'Desactivar' })}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(true)}
                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400 dark:hover:text-green-300 cursor-pointer"
                    >
                      <UserCheck className="w-3 h-3 mr-1" />
                      {t('playtelecom:users.activate', { defaultValue: 'Activar' })}
                    </Button>
                  )}
                </div>
              )}
            </GlassCard>

            {/* Role Selection */}
            <RoleSelectionCards
              selectedRole={editRole}
              onSelectRole={role => {
                setEditRole(role)
                setHasChanges(true)
              }}
              disabled={!canEditSelectedUser}
              allowedRoles={assignableRoles}
            />

            {/* Venue Assignment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">{t('playtelecom:users.venueAssignment', { defaultValue: 'Tiendas Asignadas' })}</h4>
                <Badge variant="secondary" className="ml-auto">
                  {editVenueIds.length}{' '}
                  {editVenueIds.length === 1
                    ? t('playtelecom:users.venueSingular', { defaultValue: 'tienda' })
                    : t('playtelecom:users.venuePlural', { defaultValue: 'tiendas' })}
                </Badge>
              </div>
              <GlassCard className="p-4">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allVenueOptions.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Store className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('playtelecom:users.noVenuesAvailable', { defaultValue: 'No hay tiendas disponibles' })}</p>
                    </div>
                  ) : (
                    allVenueOptions.map((venue: { id: string; name: string }) => {
                      const isSelected = editVenueIds.includes(venue.id)
                      return (
                        <div
                          key={venue.id}
                          onClick={() => canEditSelectedUser && handleVenueToggle(venue.id)}
                          className={cn(
                            'flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer',
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                            !canEditSelectedUser && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onClick={e => e.stopPropagation()}
                            disabled={!canEditSelectedUser}
                            className="cursor-pointer"
                          />
                          <p className="text-sm font-medium truncate">{venue.name}</p>
                        </div>
                      )
                    })
                  )}
                </div>
              </GlassCard>
            </div>

            {/* PIN Management */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">PIN</h4>
              </div>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative max-w-[200px]">
                    <Input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder={t('playtelecom:users.pinPlaceholder', { defaultValue: 'Ingresa PIN (4-6 digitos)' })}
                      value={editPin}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setEditPin(val)
                        setHasChanges(true)
                      }}
                      disabled={!canEditSelectedUser}
                      className="h-12 text-base font-mono pr-10"
                    />
                    {editPin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 cursor-pointer"
                        onClick={() => setShowPin(!showPin)}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('playtelecom:users.pinDescription', {
                      defaultValue: 'PIN para inicio de sesion rapido en el TPV',
                    })}
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* Activity Log */}
            <AuditLogTerminal entries={auditLogEntries} maxHeight={240} />
          </div>
        )}
      </FullScreenModal>

      {/* Temp Password Dialog */}
      <Dialog
        open={!!tempPassword}
        onOpenChange={open => {
          if (!open) setTempPassword(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('playtelecom:users.resetPasswordSuccess', { defaultValue: 'Contrasena restablecida' })}</DialogTitle>
            <DialogDescription>
              {t('playtelecom:users.resetPasswordHint', {
                defaultValue: 'Comparte esta contrasena temporal de forma segura. El usuario debera cambiarla al iniciar sesion.',
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
