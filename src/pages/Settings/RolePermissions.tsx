import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Info, Search, X, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useRoleConfig } from '@/hooks/use-role-config'

import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StaffRole } from '@/types'
import { PermissionGate } from '@/components/PermissionGate'
import { getModifiableRoles, PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'
import rolePermissionService from '@/services/rolePermission.service'
import permissionSetService, { type PermissionSet } from '@/services/permissionSet.service'
import { DASHBOARD_SUPER_CATEGORIES, TPV_SUPER_CATEGORIES } from '@/lib/permissions/permissionGroups'

import PermissionEditorModal from './components/PermissionEditorModal'
import PermissionSetEditorModal from './components/PermissionSetEditorModal'

/** Compute a short access summary from permissions list */
function getAccessSummary(permissions: string[], t: any): string {
  if (!permissions || permissions.length === 0) return t('rolePermissions.noAccess', 'No Access')
  if (permissions.includes('*:*')) return t('rolePermissions.allPermissions', 'All access')

  // Find which super-categories have active permissions
  const allSuperCats = [...DASHBOARD_SUPER_CATEGORIES, ...TPV_SUPER_CATEGORIES]
  const permSet = new Set(permissions)
  const activeSuperCats: string[] = []

  for (const superCat of allSuperCats) {
    const superPerms = superCat.categoryKeys.flatMap(key => PERMISSION_CATEGORIES[key]?.permissions || [])
    const hasAny = superPerms.some(p => permSet.has(p))
    if (hasAny) {
      activeSuperCats.push(t(superCat.titleKey, superCat.id))
    }
  }

  if (activeSuperCats.length === 0) return `${permissions.length} ${t('rolePermissions.permissions', 'permissions')}`
  return activeSuperCats.join(', ')
}

export default function RolePermissions() {
  const { slug } = useParams<{ slug: string }>()
  const { activeVenue, staffInfo, user } = useAuth()
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()

  const [editingRole, setEditingRole] = useState<StaffRole | null>(null)
  const [editingPermissionSet, setEditingPermissionSet] = useState<PermissionSet | null>(null)
  const [creatingPermissionSet, setCreatingPermissionSet] = useState(false)
  const [filterTerm, setFilterTerm] = useState('')

  const venueId = activeVenue?.id || user?.venues.find(v => v.slug === slug)?.id

  // Modifiable roles for current user
  const modifiableRoles = useMemo(() => (staffInfo?.role ? getModifiableRoles(staffInfo.role) : []), [staffInfo?.role])

  // Fetch all role permissions
  const { data: rolePermissionsData, isLoading } = useQuery({
    queryKey: ['rolePermissions', venueId],
    queryFn: () => rolePermissionService.getAllRolePermissions(venueId!),
    enabled: !!venueId,
  })

  // Fetch permission sets
  const { data: permissionSetsData, isLoading: isLoadingPermSets } = useQuery({
    queryKey: ['permission-sets', venueId],
    queryFn: () => permissionSetService.getAll(venueId!),
    enabled: !!venueId,
  })

  // Build role rows
  const roleRows = useMemo(() => {
    return modifiableRoles
      .filter(role => {
        if (!filterTerm) return true
        const label = getRoleDisplayName(role).toLowerCase()
        return label.includes(filterTerm.toLowerCase())
      })
      .map(role => {
        const roleData = rolePermissionsData?.data.find(rp => rp.role === role)
        const permissions = roleData?.permissions || []
        const accessSummary = getAccessSummary(permissions, t)

        return {
          role,
          label: getRoleDisplayName(role),
          permissions,
          accessSummary,
          staffCount: roleData?.staffCount || 0,
          isCustom: roleData?.isCustom || false,
        }
      })
  }, [modifiableRoles, rolePermissionsData, filterTerm, getRoleDisplayName, t])

  // Build permission set rows (filtered)
  const permissionSetRows = useMemo(() => {
    const sets = permissionSetsData?.data ?? []
    if (!filterTerm) return sets
    return sets.filter(s => s.name.toLowerCase().includes(filterTerm.toLowerCase()))
  }, [permissionSetsData, filterTerm])

  const tableIsLoading = isLoading || isLoadingPermSets
  const allRows = roleRows.length + permissionSetRows.length

  // Loading
  if (!user) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (!venueId || !staffInfo) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon('error')}</AlertTitle>
          <AlertDescription>{tCommon('noVenueSelected')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (modifiableRoles.length === 0) {
    return (
      <div className="p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('rolePermissions.noAccess')}</AlertTitle>
          <AlertDescription>{t('rolePermissions.noAccessDesc')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/80">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <PageTitleWithInfo
                title={
                  <>
                    {/* <Shield className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" /> */}
                    <span className="truncate">{t('rolePermissions.title', 'Permisos')}</span>
                  </>
                }
                className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"
                tooltip={t('info.rolePermissions', {
                  defaultValue: 'Define permisos por rol para controlar accesos y acciones.',
                })}
              />
              <p className="text-muted-foreground text-sm sm:text-base">
                {t('rolePermissions.description', 'Customize permissions for each role in your venue')}
              </p>
            </div>

            <PermissionGate permission="role-permissions:update">
              <Button onClick={() => setCreatingPermissionSet(true)} size="default" className="w-full sm:w-auto shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                {t('rolePermissions.permissionSets.create', 'Crear conjunto de permisos')}
              </Button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6 space-y-8 px-4 sm:px-6">
        {/* ========== Permissions Table ========== */}
        <div className="space-y-4">
          {/* Filter input */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value)}
              placeholder={t('rolePermissions.filterPlaceholder', 'Filtrar conjuntos de permisos')}
              className="pl-9 pr-9 h-10 bg-muted/30 border-border/50"
            />
            {filterTerm && (
              <button
                type="button"
                onClick={() => setFilterTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Unified Table */}
          {tableIsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-4 px-4 sm:px-6 py-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span className="w-[180px] sm:w-[220px] shrink-0">{t('rolePermissions.columnName', 'Nombre')}</span>
                <span className="flex-1 hidden sm:block">{t('rolePermissions.columnAccess', 'Acceso')}</span>
                <span className="w-[80px] sm:w-[100px] text-right shrink-0">{t('rolePermissions.columnEmployees', 'Empleados')}</span>
              </div>

              {allRows === 0 ? (
                <div className="px-6 py-12 text-center text-muted-foreground text-sm">{t('rolePermissions.noResultsFound')}</div>
              ) : (
                <>
                  {/* Role rows */}
                  {roleRows.map((row, idx) => (
                    <button
                      key={`role-${row.role}`}
                      onClick={() => setEditingRole(row.role)}
                      className={`w-full flex items-center gap-4 px-4 sm:px-6 py-3.5 text-left hover:bg-accent/50 transition-colors cursor-pointer ${
                        idx < roleRows.length - 1 || permissionSetRows.length > 0 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      <div className="w-[180px] sm:w-[220px] shrink-0 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-primary underline-offset-2 hover:underline truncate">{row.label}</span>
                        {row.isCustom && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] shrink-0">
                            {t('rolePermissions.custom', 'Custom')}
                          </Badge>
                        )}
                      </div>
                      <span className="flex-1 hidden sm:block text-sm text-muted-foreground line-clamp-2">{row.accessSummary}</span>
                      <span className="w-[80px] sm:w-[100px] text-sm text-muted-foreground text-right shrink-0 tabular-nums">
                        {row.staffCount}
                      </span>
                    </button>
                  ))}

                  {/* Permission set rows */}
                  {permissionSetRows.map((set, idx) => (
                    <button
                      key={`set-${set.id}`}
                      onClick={() => setEditingPermissionSet(set)}
                      className={`w-full flex items-center gap-4 px-4 sm:px-6 py-3.5 text-left hover:bg-accent/50 transition-colors cursor-pointer ${
                        idx < permissionSetRows.length - 1 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      <div className="w-[180px] sm:w-[220px] shrink-0 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-primary underline-offset-2 hover:underline truncate">{set.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[18px] shrink-0">
                          {t('rolePermissions.permissionSets.badge', 'Conjunto')}
                        </Badge>
                      </div>
                      <span className="flex-1 hidden sm:block text-sm text-muted-foreground line-clamp-2">
                        {getAccessSummary(set.permissions, t)}
                      </span>
                      <span className="w-[80px] sm:w-[100px] text-sm text-muted-foreground text-right shrink-0 tabular-nums">
                        {set._count.staffVenues}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Role Permission Editor Modal */}
      {editingRole && venueId && (
        <PermissionEditorModal open={!!editingRole} onClose={() => setEditingRole(null)} role={editingRole} venueId={venueId} />
      )}

      {/* Permission Set Editor Modal - Edit */}
      {editingPermissionSet && venueId && (
        <PermissionSetEditorModal
          open={!!editingPermissionSet}
          onClose={() => setEditingPermissionSet(null)}
          permissionSet={editingPermissionSet}
          venueId={venueId}
        />
      )}

      {/* Permission Set Editor Modal - Create */}
      <PermissionSetEditorModal
        open={creatingPermissionSet}
        onClose={() => setCreatingPermissionSet(false)}
        permissionSet={null}
        venueId={venueId}
      />
    </>
  )
}
