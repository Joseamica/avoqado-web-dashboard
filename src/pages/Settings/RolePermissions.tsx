import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Shield, Save, RotateCcw, AlertCircle, Info, Check, X, AlertTriangle, Tags, Monitor, LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import { useDebounce } from '@/hooks/useDebounce'

import { Button } from '@/components/ui/button'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { SimpleConfirmDialog } from '@/pages/Inventory/components/SimpleConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import rolePermissionService from '@/services/rolePermission.service'
import RoleDisplayNames, { type RoleDisplayNamesActions } from './components/RoleDisplayNames'
import PermissionSearch from './components/PermissionSearch'
import PermissionTemplateSelector from './components/PermissionTemplateSelector'
import PermissionSuperCategory from './components/PermissionSuperCategory'
import { getModifiableRoles, getRoleDisplayName, PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import {
  DASHBOARD_SUPER_CATEGORIES,
  TPV_SUPER_CATEGORIES,
  filterPermissionsBySearch,
} from '@/lib/permissions/permissionGroups'
import { PermissionGate } from '@/components/PermissionGate'

type PermissionTab = 'dashboard' | 'tpv'
type RolePermissionsTab = 'permissions' | 'display-names'

export default function RolePermissions() {
  const { slug } = useParams<{ slug: string }>()
  const { activeVenue, staffInfo, user, checkFeatureAccess } = useAuth()
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const { formatDate } = useVenueDateTime()
  const [activeRoleTab, setActiveRoleTab] = useState<RolePermissionsTab>('permissions')
  const [roleDisplayActions, setRoleDisplayActions] = useState<RoleDisplayNamesActions | null>(null)
  const queryClient = useQueryClient()

  // Get venueId from activeVenue or find it from user's venues using slug
  const venueId = activeVenue?.id || user?.venues.find(v => v.slug === slug)?.id

  // Role selection state
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [modifiedPermissions, setModifiedPermissions] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // UI state
  const [activePermissionTab, setActivePermissionTab] = useState<PermissionTab>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Dialog states
  const [pendingRoleChange, setPendingRoleChange] = useState<StaffRole | null>(null)
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [showRevertDialog, setShowRevertDialog] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<StaffRole | null>(null)
  const [showTemplateConfirmDialog, setShowTemplateConfirmDialog] = useState(false)

  // Get all role permissions for the venue
  const { data: rolePermissionsData, isLoading } = useQuery({
    queryKey: ['rolePermissions', venueId],
    queryFn: () => rolePermissionService.getAllRolePermissions(venueId!),
    enabled: !!venueId,
  })

  // Get modifiable roles for current user
  const modifiableRoles = useMemo(
    () => (staffInfo?.role ? getModifiableRoles(staffInfo.role) : []),
    [staffInfo?.role]
  )

  // Find the currently selected role's permissions
  const currentRolePermission = rolePermissionsData?.data.find(rp => rp.role === selectedRole)

  // Calculate total available permissions
  const allPermissions = useMemo(
    () => Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions),
    []
  )

  // Convert modifiedPermissions array to Set for efficient lookup
  const selectedPermissionsSet = useMemo(() => new Set(modifiedPermissions), [modifiedPermissions])

  // Helper to filter categories based on active features
  const filterCategoriesByFeatures = useCallback((superCategories: typeof DASHBOARD_SUPER_CATEGORIES) => {
    // Map permission category keys to their required features (using Feature.code from database)
    const categoryFeatureMap: Record<string, string> = {
      'INVENTORY': 'INVENTORY_TRACKING',
      'LOYALTY': 'LOYALTY_PROGRAM',
      'TABLES': 'RESERVATIONS',
      'RESERVATIONS': 'RESERVATIONS',
      'ORDERS': 'ONLINE_ORDERING',
    }

    return superCategories
      .map(superCat => ({
        ...superCat,
        categoryKeys: superCat.categoryKeys.filter(catKey => {
          const requiredFeature = categoryFeatureMap[catKey]
          // If no feature required, always include
          if (!requiredFeature) return true
          // Only include if feature is active
          return checkFeatureAccess(requiredFeature)
        })
      }))
      .filter(superCat => superCat.categoryKeys.length > 0) // Remove empty super-categories
  }, [checkFeatureAccess])

  // Get filtered super-categories based on search AND active features
  const filteredDashboardCategories = useMemo(
    () => filterPermissionsBySearch(filterCategoriesByFeatures(DASHBOARD_SUPER_CATEGORIES), debouncedSearchTerm),
    [debouncedSearchTerm, filterCategoriesByFeatures]
  )

  const filteredTpvCategories = useMemo(
    () => filterPermissionsBySearch(filterCategoriesByFeatures(TPV_SUPER_CATEGORIES), debouncedSearchTerm),
    [debouncedSearchTerm, filterCategoriesByFeatures]
  )

  // Get display count for permissions (show total if wildcard, otherwise show actual count)
  const getPermissionCount = useCallback((permissions: string[] | undefined) => {
    if (!permissions || permissions.length === 0) return 0
    if (permissions.includes('*:*')) return allPermissions.length
    return permissions.length
  }, [allPermissions.length])

  // Initialize selected role to first modifiable role
  useEffect(() => {
    if (!selectedRole && modifiableRoles.length > 0) {
      setSelectedRole(modifiableRoles[0])
    }
  }, [selectedRole, modifiableRoles])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { role: StaffRole; permissions: string[] }) =>
      rolePermissionService.updateRolePermissions(venueId!, data.role, data.permissions),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', venueId] })
      toast({
        title: t('rolePermissions.updateSuccess'),
        description: t('rolePermissions.updateSuccessDesc', { role: getRoleDisplayName(variables.role) }),
      })
      setHasChanges(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || t('rolePermissions.updateError')
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  // Revert to defaults mutation
  const revertMutation = useMutation({
    mutationFn: (role: StaffRole) => rolePermissionService.deleteRolePermissions(venueId!, role),
    onSuccess: (_, role) => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', venueId] })
      toast({
        title: t('rolePermissions.revertSuccess'),
        description: t('rolePermissions.revertSuccessDesc', { role: getRoleDisplayName(role) }),
      })
      setHasChanges(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || t('rolePermissions.revertError')
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const handleRoleChange = (role: string) => {
    if (hasChanges) {
      setPendingRoleChange(role as StaffRole)
      setShowUnsavedChangesDialog(true)
      return
    }
    setSelectedRole(role as StaffRole)
    setHasChanges(false)
    // Reset expanded categories when switching roles
    setExpandedCategories(new Set())
  }

  const confirmRoleChange = () => {
    if (pendingRoleChange) {
      setSelectedRole(pendingRoleChange)
      setHasChanges(false)
      setPendingRoleChange(null)
      setExpandedCategories(new Set())
    }
    setShowUnsavedChangesDialog(false)
  }

  // Initialize modifiedPermissions when selectedRole changes or API data loads
  useEffect(() => {
    if (selectedRole && rolePermissionsData?.data && !hasChanges) {
      const roleData = rolePermissionsData.data.find(rp => rp.role === selectedRole)
      if (roleData) {
        // If wildcard, expand to all permissions for display
        if (roleData.permissions.includes('*:*')) {
          setModifiedPermissions(allPermissions)
        } else {
          setModifiedPermissions(roleData.permissions)
        }
      }
    }
  }, [selectedRole, rolePermissionsData?.data, hasChanges, allPermissions])

  // Handle individual permission toggle
  const handlePermissionChange = useCallback((permission: string, enabled: boolean) => {
    setModifiedPermissions(prev => {
      const newPermissions = enabled ? [...prev, permission] : prev.filter(p => p !== permission)

      // Check if all permissions are selected - if so, use wildcard
      if (newPermissions.length === allPermissions.length && allPermissions.every(p => newPermissions.includes(p))) {
        return ['*:*']
      }

      return newPermissions
    })
    setHasChanges(true)
  }, [allPermissions])

  // Handle template selection
  const handleTemplateSelect = (role: StaffRole) => {
    if (hasChanges) {
      setPendingTemplate(role)
      setShowTemplateConfirmDialog(true)
      return
    }
    applyTemplate(role)
  }

  const applyTemplate = (role: StaffRole) => {
    const templatePermissions = DEFAULT_PERMISSIONS[role]
    if (templatePermissions.includes('*:*')) {
      setModifiedPermissions(allPermissions)
    } else {
      setModifiedPermissions([...templatePermissions])
    }
    setHasChanges(true)
    setShowTemplateConfirmDialog(false)
    setPendingTemplate(null)
  }

  const confirmTemplateApply = () => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate)
    }
  }

  const handleSave = () => {
    if (!selectedRole) return

    // Convert back to wildcard if all permissions are selected
    let permissionsToSave = modifiedPermissions
    if (
      modifiedPermissions.length === allPermissions.length &&
      allPermissions.every(p => modifiedPermissions.includes(p))
    ) {
      permissionsToSave = ['*:*']
    }

    updateMutation.mutate({ role: selectedRole, permissions: permissionsToSave })
  }

  const handleRevert = () => {
    if (!selectedRole) return
    setShowRevertDialog(true)
  }

  const confirmRevert = () => {
    if (!selectedRole) return
    revertMutation.mutate(selectedRole)
    setShowRevertDialog(false)
  }

  // Toggle category expansion
  const toggleCategoryExpansion = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  // Get default permissions for comparison
  const defaultPermissions = useMemo(() => {
    if (!selectedRole) return []
    return DEFAULT_PERMISSIONS[selectedRole] || []
  }, [selectedRole])

  // Check if user is modifying their own role
  const isOwnRole = staffInfo?.role === selectedRole

  // Show loading state while auth is initializing
  if (!user) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-px w-full" />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    )
  }

  if (!venueId || !staffInfo) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('common.noVenueSelected')}</AlertDescription>
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
      {/* Sticky Header - sticks to viewport top when scrolling */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <PageTitleWithInfo
                title={
                  <>
                    <Shield className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
                    <span className="truncate">{t('rolePermissions.title', 'Role Permissions')}</span>
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

            {/* Header actions (contextual by tab) */}
            {activeRoleTab === 'permissions' && selectedRole && (
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                size="default"
                className="w-full sm:w-auto flex-shrink-0"
              >
                {updateMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    {t('rolePermissions.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('rolePermissions.saveChanges')}
                  </>
                )}
              </Button>
            )}
            {activeRoleTab === 'display-names' && (
              <PermissionGate permission="role-config:update">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => roleDisplayActions?.onReset()}
                    disabled={!roleDisplayActions || roleDisplayActions.isResetting}
                    size="default"
                    className="w-full sm:w-auto flex-shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('roleDisplayNames.resetAll')}
                  </Button>
                  <Button
                    onClick={() => roleDisplayActions?.onSave()}
                    disabled={!roleDisplayActions || !roleDisplayActions.hasChanges || roleDisplayActions.isUpdating}
                    size="default"
                    className="w-full sm:w-auto flex-shrink-0"
                  >
                    {roleDisplayActions?.isUpdating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                        {t('roleDisplayNames.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {t('roleDisplayNames.saveChanges')}
                      </>
                    )}
                  </Button>
                </div>
              </PermissionGate>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6 space-y-6 px-4 sm:px-6">
      {/* Main Tabs */}
      <Tabs value={activeRoleTab} onValueChange={value => setActiveRoleTab(value as RolePermissionsTab)} className="space-y-4 sm:space-y-6">
        <TabsList className="inline-flex h-9 sm:h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border w-fit">
          <TabsTrigger
            value="permissions"
            className="group rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            <span>{t('rolePermissions.tabs.permissions', 'Permissions')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="display-names"
            className="group rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Tags className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            <span>{t('rolePermissions.tabs.displayNames', 'Display Names')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4 sm:space-y-6">
          {/* Info Alert */}
          <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
              {t(
                'rolePermissions.infoAlert',
                'Changes to role permissions will affect all users with that role. Individual staff members can have custom permissions in Team Management.'
              )}
            </AlertDescription>
          </Alert>

          {/* Main Content Grid */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[260px_1fr]">
            {/* Role Selector Sidebar */}
            <Card className="h-fit">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">{t('rolePermissions.selectRole', 'Select Role')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t('rolePermissions.selectRoleDesc', 'Choose a role to customize permissions')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                    {modifiableRoles.map(role => {
                      const roleData = rolePermissionsData?.data.find(rp => rp.role === role)
                      const isSelected = selectedRole === role

                      return (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(role)}
                          className={`w-full text-left p-2 sm:p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card hover:bg-accent border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-xs sm:text-sm truncate">{getRoleDisplayName(role)}</span>
                            {roleData?.isCustom && (
                              <Badge variant={isSelected ? 'secondary' : 'outline'} className="text-[10px] sm:text-xs px-1 sm:px-1.5 flex-shrink-0">
                                {t('rolePermissions.custom', 'Custom')}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] sm:text-sm opacity-80 mt-0.5 sm:mt-1 truncate">
                            {roleData?.permissions?.includes('*:*')
                              ? t('rolePermissions.allPermissions', 'All permissions')
                              : `${getPermissionCount(roleData?.permissions)} ${t('rolePermissions.permissions', 'permissions')}`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Permission Editor */}
            {selectedRole && currentRolePermission && (
              <div className="space-y-4 sm:space-y-6 min-w-0">
                {/* Role Header */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
                          <span className="truncate">{getRoleDisplayName(selectedRole)}</span>
                          {currentRolePermission.isCustom && (
                            <Badge variant="secondary" className="text-xs">{t('rolePermissions.customized', 'Customized')}</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          {currentRolePermission.isCustom
                            ? t('rolePermissions.customPermissionsDesc', 'Custom permissions are active for this role')
                            : t('rolePermissions.defaultPermissionsDesc', 'Using default permissions for this role')}
                        </CardDescription>
                      </div>
                      {currentRolePermission.isCustom && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevert}
                          disabled={revertMutation.isPending}
                          className="w-full sm:w-auto flex-shrink-0"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          <span className="truncate">{t('rolePermissions.revertToDefaults', 'Revert to Defaults')}</span>
                        </Button>
                      )}
                    </div>
                    {currentRolePermission.modifiedBy && (
                      <div className="text-xs sm:text-sm text-muted-foreground mt-2">
                        {t('rolePermissions.lastModified', 'Last modified by')}{' '}
                        <span className="font-medium">
                          {currentRolePermission.modifiedBy.firstName} {currentRolePermission.modifiedBy.lastName}
                        </span>{' '}
                        {currentRolePermission.modifiedAt && (
                          <span>
                            {t('common.on')} {formatDate(currentRolePermission.modifiedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                </Card>

                {/* Self-modification warning */}
                {isOwnRole && (
                  <Alert className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <AlertDescription className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                      {t(
                        'rolePermissions.modifyingOwnRole',
                        'You are modifying permissions for your own role. Critical permissions cannot be removed to prevent self-lockout.'
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Template Selector */}
                <PermissionTemplateSelector
                  selectedRole={selectedRole}
                  currentPermissions={modifiedPermissions}
                  onTemplateSelect={handleTemplateSelect}
                  disabled={updateMutation.isPending || revertMutation.isPending}
                />

                {/* Inner Tabs: Dashboard / TPV */}
                <Tabs value={activePermissionTab} onValueChange={v => setActivePermissionTab(v as PermissionTab)}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <TabsList className="inline-flex h-9 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border w-fit">
                      <TabsTrigger
                        value="dashboard"
                        className="group rounded-full px-3 py-1.5 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                      >
                        <LayoutDashboard className="h-4 w-4 mr-1.5" />
                        <span>{t('rolePermissions.tabs.dashboard', 'Dashboard')}</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="tpv"
                        className="group rounded-full px-3 py-1.5 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                      >
                        <Monitor className="h-4 w-4 mr-1.5" />
                        <span>{t('rolePermissions.tabs.tpv', 'TPV')}</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Search */}
                    <PermissionSearch value={searchTerm} onChange={setSearchTerm} className="w-full sm:w-64" />
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap mb-4">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 dark:text-green-400" />
                      <span>{t('rolePermissions.legendEnabled', 'Permission enabled')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>{t('rolePermissions.legendDisabled', 'Permission disabled')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                      <span>{t('rolePermissions.legendCritical', 'Critical permission')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        +
                      </Badge>
                      <span>{t('rolePermissions.legendAdded', 'Added to defaults')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        -
                      </Badge>
                      <span>{t('rolePermissions.legendRemoved', 'Removed from defaults')}</span>
                    </div>
                  </div>

                  {/* Dashboard Permissions */}
                  <TabsContent value="dashboard" className="space-y-4 mt-0">
                    {filteredDashboardCategories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('rolePermissions.noResultsFound', 'No permissions found matching your search')}
                      </div>
                    ) : (
                      filteredDashboardCategories.map(superCategory => (
                        <PermissionSuperCategory
                          key={superCategory.id}
                          superCategory={superCategory}
                          selectedPermissions={selectedPermissionsSet}
                          defaultPermissions={defaultPermissions}
                          onChange={handlePermissionChange}
                          searchTerm={debouncedSearchTerm}
                          isExpanded={expandedCategories.has(superCategory.id)}
                          onToggleExpand={() => toggleCategoryExpansion(superCategory.id)}
                          disabled={updateMutation.isPending || revertMutation.isPending}
                          isOwnRole={isOwnRole}
                        />
                      ))
                    )}
                  </TabsContent>

                  {/* TPV Permissions */}
                  <TabsContent value="tpv" className="space-y-4 mt-0">
                    {filteredTpvCategories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('rolePermissions.noResultsFound', 'No permissions found matching your search')}
                      </div>
                    ) : (
                      filteredTpvCategories.map(superCategory => (
                        <PermissionSuperCategory
                          key={superCategory.id}
                          superCategory={superCategory}
                          selectedPermissions={selectedPermissionsSet}
                          defaultPermissions={defaultPermissions}
                          onChange={handlePermissionChange}
                          searchTerm={debouncedSearchTerm}
                          isExpanded={expandedCategories.has(superCategory.id)}
                          onToggleExpand={() => toggleCategoryExpansion(superCategory.id)}
                          disabled={updateMutation.isPending || revertMutation.isPending}
                          isOwnRole={isOwnRole}
                        />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          {/* Unsaved Changes Dialog */}
          <SimpleConfirmDialog
            open={showUnsavedChangesDialog}
            onOpenChange={setShowUnsavedChangesDialog}
            title={t('rolePermissions.unsavedChanges')}
            message={t('rolePermissions.unsavedChangesMessage')}
            confirmLabel={t('rolePermissions.discard')}
            cancelLabel={t('rolePermissions.cancel')}
            onConfirm={confirmRoleChange}
            variant="destructive"
          />

          {/* Revert to Defaults Dialog */}
          {selectedRole && (
            <SimpleConfirmDialog
              open={showRevertDialog}
              onOpenChange={setShowRevertDialog}
              title={t('rolePermissions.confirmRevert', { role: getRoleDisplayName(selectedRole) })}
              message={t('rolePermissions.confirmRevertMessage')}
              confirmLabel={t('rolePermissions.revertToDefaults')}
              cancelLabel={t('rolePermissions.cancel')}
              onConfirm={confirmRevert}
              isLoading={revertMutation.isPending}
              variant="destructive"
            />
          )}

          {/* Template Confirm Dialog */}
          {pendingTemplate && (
            <SimpleConfirmDialog
              open={showTemplateConfirmDialog}
              onOpenChange={setShowTemplateConfirmDialog}
              title={t('rolePermissions.templates.confirmApply', { role: getRoleDisplayName(pendingTemplate) })}
              message={t('rolePermissions.templates.confirmApplyMessage', { role: getRoleDisplayName(pendingTemplate) })}
              confirmLabel={t('rolePermissions.templates.applyTemplate')}
              cancelLabel={t('rolePermissions.cancel')}
              onConfirm={confirmTemplateApply}
              variant="default"
            />
          )}
        </TabsContent>

        {/* Display Names Tab */}
        <TabsContent value="display-names" className="space-y-6">
          <RoleDisplayNames onActionsChange={setRoleDisplayActions} />
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}
