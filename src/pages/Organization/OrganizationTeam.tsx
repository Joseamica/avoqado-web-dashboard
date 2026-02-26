/**
 * OrganizationTeam - Organization-level team management with CRUD
 *
 * Layout:
 * - Header: Page title + member count + invite button
 * - Filters: Stripe-style FilterPill bar (Sucursal, Rol)
 * - Body: Full-width DataTable with pagination + search
 * - Detail: FullScreenModal for editing per-venue role/status
 *
 * Access: OWNER+ only (guarded by OwnerProtectedRoute in router)
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { getOrganizationTeam, type OrganizationTeamMember } from '@/services/organization.service'
import { getTeam, adminResetPassword, getStaffActivityLog, type TeamMember as StoresTeamMember } from '@/services/storesAnalysis.service'
import { teamService } from '@/services/team.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Skeleton } from '@/components/ui/skeleton'
import DataTable from '@/components/data-table'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import InviteTeamMemberForm, { type InviteTeamMemberFormRef } from '@/pages/Team/components/InviteTeamMemberForm'
import { AuditLogTerminal, type AuditLogEntry } from '@/pages/playtelecom/Users/components/AuditLogTerminal'
import {
  Users, Store, X, UserPlus, Mail, Phone, KeyRound, UserCheck, Ban, ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useVenueDateTime } from '@/utils/datetime'
import { useRoleConfig } from '@/hooks/use-role-config'
import { getRoleBadgeColor } from '@/utils/role-permissions'
import { useToast } from '@/hooks/use-toast'
import { StaffRole } from '@/types'
import { canModifyRole, getModifiableRoles } from '@/lib/permissions/roleHierarchy'
import { cn } from '@/lib/utils'

/** Max venue badges visible in the table before showing "+N" */
const MAX_VISIBLE_VENUES = 2

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

const ACTION_MESSAGE_BUILDERS: Record<string, (data: Record<string, unknown> | null, by: string) => string> = {
  ROLE_CHANGED: (data, by) => `Rol cambiado de ${data?.oldRole || '?'} a ${data?.newRole || '?'} por ${by}`,
  USER_ACTIVATED: (_data, by) => `Usuario activado por ${by}`,
  USER_DEACTIVATED: (_data, by) => `Usuario desactivado por ${by}`,
  PASSWORD_RESET: (_data, by) => `Contraseña restablecida por ${by}`,
  VENUE_ASSIGNED: (data, by) => `Asignado a ${data?.venueName || 'sucursal'} por ${by}`,
  VENUE_REMOVED: (data, by) => `Removido de ${data?.venueName || 'sucursal'} por ${by}`,
  MASTER_LOGIN_SUCCESS: (_data, by) => `Inicio de sesión master por ${by}`,
  MASTER_LOGIN_FAILED: (_data, by) => `Intento de login master fallido por ${by}`,
}

/** Row type for the DataTable */
interface TeamRow {
  id: string
  name: string
  email: string
  phone: string | null
  venues: OrganizationTeamMember['venues']
  createdAt: string
}

const OrganizationTeam: React.FC = () => {
  const { t } = useTranslation(['organization', 'common', 'team'])
  const { orgId } = useParams<{ orgId: string }>()
  const { allVenues, activeVenue, staffInfo } = useAuth()
  const { formatDate } = useVenueDateTime()
  const { getDisplayName } = useRoleConfig()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Context venue for venue-scoped API calls (any venue the user has access to)
  const contextVenueId = activeVenue?.id || allVenues[0]?.id

  // Stripe-style filter state
  const [venueFilter, setVenueFilter] = useState<string[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])

  // Detail modal state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Invite modal state
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [isInviteFormValid, setIsInviteFormValid] = useState(false)
  const inviteFormRef = useRef<InviteTeamMemberFormRef>(null)

  // Reset password dialog
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // ---------- Queries ----------

  const { data: orgTeam, isLoading } = useQuery({
    queryKey: ['organization', 'team', orgId],
    queryFn: () => getOrganizationTeam(orgId!),
    enabled: !!orgId,
  })

  // Richer team data with staffVenueId for mutations
  const { data: storesTeam } = useQuery({
    queryKey: ['stores-analysis', contextVenueId, 'team'],
    queryFn: () => getTeam(contextVenueId!),
    enabled: !!contextVenueId,
  })

  // Activity log for selected member
  const { data: rawActivityLog = [] } = useQuery({
    queryKey: ['stores-analysis', contextVenueId, 'activity', selectedMemberId],
    queryFn: () => getStaffActivityLog(contextVenueId!, selectedMemberId!),
    enabled: !!contextVenueId && !!selectedMemberId,
  })

  // ---------- Mutations ----------

  const updateRoleMutation = useMutation({
    mutationFn: ({ venueId, staffVenueId, role }: { venueId: string; staffVenueId: string; role: StaffRole }) =>
      teamService.updateTeamMember(venueId, staffVenueId, { role }),
    onSuccess: () => {
      toast({ title: t('organization:team.roleUpdated', { defaultValue: 'Rol actualizado' }) })
      queryClient.invalidateQueries({ queryKey: ['organization', 'team', orgId] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', contextVenueId, 'team'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', contextVenueId, 'activity'] })
    },
    onError: (error: any) => {
      toast({
        title: error?.response?.data?.message || t('organization:team.roleUpdateError', { defaultValue: 'Error al actualizar rol' }),
        variant: 'destructive',
      })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ venueId, staffVenueId, active }: { venueId: string; staffVenueId: string; active: boolean }) =>
      teamService.updateTeamMember(venueId, staffVenueId, { active }),
    onSuccess: (_data, variables) => {
      toast({
        title: variables.active
          ? t('organization:team.userActivated', { defaultValue: 'Usuario activado' })
          : t('organization:team.userDeactivated', { defaultValue: 'Usuario desactivado' }),
      })
      queryClient.invalidateQueries({ queryKey: ['organization', 'team', orgId] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', contextVenueId, 'team'] })
    },
    onError: (error: any) => {
      toast({
        title: error?.response?.data?.message || t('organization:team.statusUpdateError', { defaultValue: 'Error al cambiar estado' }),
        variant: 'destructive',
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => adminResetPassword(contextVenueId!, userId),
    onSuccess: data => {
      setTempPassword(data.temporaryPassword)
      setCopied(false)
    },
    onError: () => {
      toast({
        title: t('organization:team.resetPasswordError', { defaultValue: 'Error al restablecer contraseña' }),
        variant: 'destructive',
      })
    },
  })

  // ---------- Data Mapping ----------

  const rows: TeamRow[] = useMemo(
    () =>
      (orgTeam || []).map(member => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        phone: member.phone,
        venues: member.venues,
        createdAt: member.createdAt,
      })),
    [orgTeam],
  )

  // Lookup: staffId → storesAnalysis member (has staffVenueId)
  const storesTeamMap = useMemo(() => {
    if (!storesTeam) return new Map<string, StoresTeamMember>()
    return new Map(storesTeam.map(m => [m.id, m]))
  }, [storesTeam])

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

  // ---------- Selected member data ----------

  const selectedOrgMember = useMemo(
    () => orgTeam?.find(m => m.id === selectedMemberId) || null,
    [orgTeam, selectedMemberId],
  )

  const selectedStoresMember = useMemo(
    () => (selectedMemberId ? storesTeamMap.get(selectedMemberId) || null : null),
    [selectedMemberId, storesTeamMap],
  )

  const selectedMemberName = selectedOrgMember
    ? `${selectedOrgMember.firstName} ${selectedOrgMember.lastName}`.trim()
    : ''

  // Merge venue data: org data (venueName, venueSlug, role) + stores data (staffVenueId, active)
  const selectedMemberVenues = useMemo(() => {
    if (!selectedOrgMember) return []
    return selectedOrgMember.venues.map(orgVenue => {
      const storesVenue = selectedStoresMember?.venues.find(sv => sv.id === orgVenue.venueId)
      return {
        venueId: orgVenue.venueId,
        venueName: orgVenue.venueName,
        role: storesVenue?.role || orgVenue.role,
        active: storesVenue?.active ?? true,
        staffVenueId: storesVenue?.staffVenueId || null,
      }
    })
  }, [selectedOrgMember, selectedStoresMember])

  // ---------- Role Hierarchy ----------

  const currentUserRole = staffInfo?.role as StaffRole | undefined

  const assignableRoles = useMemo(() => {
    if (!currentUserRole) return []
    return getModifiableRoles(currentUserRole).filter(
      r => r !== StaffRole.SUPERADMIN,
    )
  }, [currentUserRole])

  const canEditMember = useCallback(
    (memberRole: string) => {
      if (!currentUserRole) return false
      return canModifyRole(currentUserRole, memberRole as StaffRole)
    },
    [currentUserRole],
  )

  // ---------- Filter Options ----------

  const venueOptions = useMemo(
    () => allVenues.map(v => ({ value: v.id, label: v.name })),
    [allVenues],
  )

  const roleOptions = useMemo(() => {
    if (!orgTeam) return []
    const roles = new Set<string>()
    for (const m of orgTeam) {
      for (const v of m.venues) {
        roles.add(v.role)
      }
    }
    return Array.from(roles)
      .sort()
      .map(r => ({ value: r, label: getDisplayName(r) }))
  }, [orgTeam, getDisplayName])

  const getFilterLabel = useCallback(
    (values: string[], options: { value: string; label: string }[]) => {
      if (values.length === 0) return null
      if (values.length === 1) return options.find(o => o.value === values[0])?.label || values[0]
      return `${values.length} seleccionados`
    },
    [],
  )

  const activeFiltersCount = [venueFilter.length > 0, roleFilter.length > 0].filter(Boolean).length

  const resetFilters = useCallback(() => {
    setVenueFilter([])
    setRoleFilter([])
  }, [])

  const filteredRows = useMemo(() => {
    let result = rows
    if (venueFilter.length > 0) {
      result = result.filter(r => r.venues.some(v => venueFilter.includes(v.venueId)))
    }
    if (roleFilter.length > 0) {
      result = result.filter(r => r.venues.some(v => roleFilter.includes(v.role)))
    }
    return result
  }, [rows, venueFilter, roleFilter])

  const handleSearch = useCallback((search: string, data: TeamRow[]) => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.venues.some(v => v.venueName.toLowerCase().includes(q)),
    )
  }, [])

  // ---------- Handlers ----------

  const handleRoleChange = useCallback(
    (venueId: string, staffVenueId: string | null, newRole: string) => {
      if (!staffVenueId) return
      updateRoleMutation.mutate({ venueId, staffVenueId, role: newRole as StaffRole })
    },
    [updateRoleMutation],
  )

  const handleStatusToggle = useCallback(
    (venueId: string, staffVenueId: string | null, currentActive: boolean) => {
      if (!staffVenueId) return
      updateStatusMutation.mutate({ venueId, staffVenueId, active: !currentActive })
    },
    [updateStatusMutation],
  )

  const handleResetPassword = useCallback(() => {
    if (selectedMemberId) {
      resetPasswordMutation.mutate(selectedMemberId)
    }
  }, [selectedMemberId, resetPasswordMutation])

  const handleInviteSuccess = useCallback(() => {
    setShowInviteDialog(false)
    queryClient.invalidateQueries({ queryKey: ['organization', 'team', orgId] })
    queryClient.invalidateQueries({ queryKey: ['stores-analysis', contextVenueId, 'team'] })
    queryClient.invalidateQueries({ queryKey: ['team-members'] })
    queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
  }, [orgId, contextVenueId, queryClient])

  const isMutating = updateRoleMutation.isPending || updateStatusMutation.isPending

  // ---------- Column Definitions ----------

  const columns: ColumnDef<TeamRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('organization:team.member', { defaultValue: 'Miembro' }),
        cell: ({ row }) => {
          const initials = row.original.name
            .split(' ')
            .map(w => w.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{row.original.name}</p>
                <p className="text-xs text-muted-foreground truncate">{row.original.email}</p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'phone',
        header: t('organization:team.phone', { defaultValue: 'Teléfono' }),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.phone || '—'}
          </span>
        ),
      },
      {
        id: 'venues',
        header: t('organization:team.venues', { defaultValue: 'Sucursales' }),
        cell: ({ row }) => {
          const venues = row.original.venues
          if (venues.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }

          const visible = venues.slice(0, MAX_VISIBLE_VENUES)
          const remaining = venues.length - MAX_VISIBLE_VENUES

          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map(v => (
                <span
                  key={v.venueId}
                  className={cn(
                    'inline-flex items-center h-5 px-2 text-[10px] font-medium rounded-full leading-none gap-1',
                    getRoleBadgeColor(v.role as StaffRole),
                  )}
                >
                  <span className="truncate max-w-[100px]">{v.venueName}</span>
                  <span className="opacity-60">{getDisplayName(v.role)}</span>
                </span>
              ))}
              {remaining > 0 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 cursor-default">
                        +{remaining}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-1">
                        {venues.slice(MAX_VISIBLE_VENUES).map(v => (
                          <div key={v.venueId} className="text-xs">
                            <span className="font-medium">{v.venueName}</span>
                            <span className="text-muted-foreground ml-1">({getDisplayName(v.role)})</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('organization:team.joined', { defaultValue: 'Se unió' }),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [t, formatDate, getDisplayName],
  )

  // ---------- Render ----------

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageTitleWithInfo
          title={
            <>
              <Users className="h-8 w-8 text-primary" />
              <span>{t('organization:team.title')}</span>
            </>
          }
          className="text-3xl font-bold text-foreground flex items-center gap-2"
          tooltip={t('organization:info.team', {
            defaultValue: 'Gestiona miembros y roles a nivel organizacion.',
          })}
        />
        <p className="text-muted-foreground mt-1">
          {t('organization:team.subtitle', { count: orgTeam?.length || 0 })}
        </p>
      </div>

      {/* Stripe-style filter bar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <FilterPill
          label={t('organization:team.venues', { defaultValue: 'Sucursales' })}
          activeValue={getFilterLabel(venueFilter, venueOptions)}
          isActive={venueFilter.length > 0}
          onClear={() => setVenueFilter([])}
        >
          <CheckboxFilterContent
            title={t('organization:team.filterByVenue', { defaultValue: 'Filtrar por Sucursal' })}
            options={venueOptions}
            selectedValues={venueFilter}
            searchable={venueOptions.length > 5}
            onApply={setVenueFilter}
          />
        </FilterPill>

        <FilterPill
          label="Rol"
          activeValue={getFilterLabel(roleFilter, roleOptions)}
          isActive={roleFilter.length > 0}
          onClear={() => setRoleFilter([])}
        >
          <CheckboxFilterContent
            title={t('organization:team.filterByRole', { defaultValue: 'Filtrar por Rol' })}
            options={roleOptions}
            selectedValues={roleFilter}
            onApply={setRoleFilter}
          />
        </FilterPill>

        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1.5 rounded-full cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            {t('organization:team.clearFilters', { defaultValue: 'Borrar filtros' })}
          </Button>
        )}

        {/* Invite button — right aligned */}
        {contextVenueId && (
          <div className="ml-auto">
            <Button
              onClick={() => setShowInviteDialog(true)}
              className="h-10 gap-1.5 rounded-xl cursor-pointer px-4"
            >
              <UserPlus className="w-4 h-4" />
              {t('organization:team.invite', { defaultValue: 'Invitar' })}
            </Button>
          </div>
        )}
      </div>

      {/* Team Table */}
      <DataTable
        data={filteredRows}
        columns={columns}
        rowCount={filteredRows.length}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedMemberId(row.id)}
        tableId="org:team"
        enableSearch
        searchPlaceholder={t('organization:team.searchPlaceholder', { defaultValue: 'Buscar miembros del equipo...' })}
        onSearch={handleSearch}
      />

      {/* Member Detail Modal */}
      <FullScreenModal
        open={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        title={selectedMemberName}
        contentClassName="bg-muted/30"
      >
        {selectedOrgMember && (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {/* Member Header */}
            <GlassCard className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
                    {selectedOrgMember.firstName.charAt(0).toUpperCase()}
                    {selectedOrgMember.lastName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{selectedMemberName}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{selectedOrgMember.email}</span>
                      </span>
                      {selectedOrgMember.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          {selectedOrgMember.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resetPasswordMutation.isPending}
                  className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 mr-1" />
                  {t('organization:team.resetPassword', { defaultValue: 'Restablecer Contraseña' })}
                </Button>
              </div>
            </GlassCard>

            {/* Venue Assignments */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">
                  {t('organization:team.venueAssignments', { defaultValue: 'Sucursales Asignadas' })}
                </h4>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedMemberVenues.length} {selectedMemberVenues.length === 1 ? 'sucursal' : 'sucursales'}
                </Badge>
              </div>

              <GlassCard className="p-0 overflow-hidden divide-y divide-border/50">
                {selectedMemberVenues.map(venue => {
                  const editable = canEditMember(venue.role)
                  return (
                    <div
                      key={venue.venueId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      {/* Venue name + status dot */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            venue.active ? 'bg-green-500' : 'bg-muted-foreground/40',
                          )}
                        />
                        <p className="text-sm font-medium truncate">{venue.venueName}</p>
                      </div>

                      {/* Role + status actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {editable && venue.staffVenueId ? (
                          <Select
                            value={venue.role}
                            onValueChange={(newRole) =>
                              handleRoleChange(venue.venueId, venue.staffVenueId, newRole)
                            }
                            disabled={isMutating}
                          >
                            <SelectTrigger className="w-36 h-7 text-xs">
                              <SelectValue>
                                {getDisplayName(venue.role)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map(r => (
                                <SelectItem key={r} value={r}>
                                  {getDisplayName(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center h-5 px-2 text-[10px] font-medium rounded-full leading-none',
                              getRoleBadgeColor(venue.role as StaffRole),
                            )}
                          >
                            {getDisplayName(venue.role)}
                          </span>
                        )}

                        {editable && venue.staffVenueId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleStatusToggle(venue.venueId, venue.staffVenueId, venue.active)
                            }
                            disabled={isMutating}
                            className={cn(
                              'h-7 text-xs cursor-pointer',
                              venue.active
                                ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400 dark:hover:text-yellow-300'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400 dark:hover:text-green-300',
                            )}
                          >
                            {venue.active ? (
                              <><Ban className="w-3 h-3 mr-1" />{t('organization:team.deactivate', { defaultValue: 'Desactivar' })}</>
                            ) : (
                              <><UserCheck className="w-3 h-3 mr-1" />{t('organization:team.activate', { defaultValue: 'Activar' })}</>
                            )}
                          </Button>
                        )}

                        {!editable && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ShieldAlert className="w-4 h-4 text-yellow-500/60" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {t('organization:team.cannotEditHigherRole', {
                                    defaultValue: 'No puedes modificar este rol',
                                  })}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  )
                })}
              </GlassCard>
            </div>

            {/* Activity Log */}
            <AuditLogTerminal entries={auditLogEntries} maxHeight={240} />
          </div>
        )}
      </FullScreenModal>

      {/* Invite Modal */}
      {contextVenueId && (
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
                t('team:invite.sendButton', { defaultValue: 'Enviar Invitación' })
              )}
            </Button>
          }
        >
          <div className="max-w-2xl mx-auto px-6 py-8">
            <InviteTeamMemberForm
              ref={inviteFormRef}
              venueId={contextVenueId}
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
              {t('organization:team.resetPasswordSuccess', { defaultValue: 'Contraseña restablecida' })}
            </DialogTitle>
            <DialogDescription>
              {t('organization:team.resetPasswordHint', {
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
    </div>
  )
}

export default OrganizationTeam
