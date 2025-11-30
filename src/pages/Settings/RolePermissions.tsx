import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Shield, Save, RotateCcw, AlertCircle, Info, Check, X, AlertTriangle, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
import PermissionGrid from './components/PermissionGrid'
import RoleDisplayNames from './components/RoleDisplayNames'
import { getModifiableRoles, getRoleDisplayName, PERMISSION_CATEGORIES } from '@/lib/permissions/roleHierarchy'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'

export default function RolePermissions() {
  const { slug } = useParams<{ slug: string }>()
  const { activeVenue, staffInfo, user } = useAuth()
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Get venueId from activeVenue or find it from user's venues using slug
  const venueId = activeVenue?.id || user?.venues.find(v => v.slug === slug)?.id

  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [modifiedPermissions, setModifiedPermissions] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Dialog states
  const [pendingRoleChange, setPendingRoleChange] = useState<StaffRole | null>(null)
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [showRevertDialog, setShowRevertDialog] = useState(false)

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
  const allPermissions = Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions)

  // Get display count for permissions (show total if wildcard, otherwise show actual count)
  const getPermissionCount = (permissions: string[] | undefined) => {
    if (!permissions || permissions.length === 0) return 0
    if (permissions.includes('*:*')) return allPermissions.length
    return permissions.length
  }

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
    // Permissions will be set by useEffect
    setHasChanges(false)
  }

  const confirmRoleChange = () => {
    if (pendingRoleChange) {
      setSelectedRole(pendingRoleChange)
      // Permissions will be set by useEffect
      setHasChanges(false)
      setPendingRoleChange(null)
    }
    setShowUnsavedChangesDialog(false)
  }

  // Initialize modifiedPermissions when selectedRole changes or API data loads
  useEffect(() => {
    if (selectedRole && rolePermissionsData?.data && !hasChanges) {
      const roleData = rolePermissionsData.data.find(rp => rp.role === selectedRole)
      if (roleData) {
        setModifiedPermissions(roleData.permissions)
      }
    }
  }, [selectedRole, rolePermissionsData?.data, hasChanges])

  const handlePermissionsChange = (permissions: string[]) => {
    setModifiedPermissions(permissions)
    // Check if permissions have changed from current
    const currentPermissions = currentRolePermission?.permissions || []
    const hasChanged = permissions.length !== currentPermissions.length || !permissions.every(p => currentPermissions.includes(p))
    setHasChanges(hasChanged)
  }

  const handleSave = () => {
    if (!selectedRole) return
    updateMutation.mutate({ role: selectedRole, permissions: modifiedPermissions })
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
    <div className="container mx-auto py-6 space-y-6 p-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          {t('rolePermissions.title', 'Role Permissions')}
        </h1>
        <p className="text-muted-foreground">{t('rolePermissions.description', 'Customize permissions for each role in your venue')}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="permissions" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="permissions"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Shield className="h-4 w-4 mr-2" />
            <span>{t('rolePermissions.tabs.permissions', 'Permissions')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="display-names"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Tags className="h-4 w-4 mr-2" />
            <span>{t('rolePermissions.tabs.displayNames', 'Display Names')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          {/* Save button and Legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
              {selectedRole && (
                <>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span>{t('rolePermissions.legendEnabled', 'Permission enabled')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    <span>{t('rolePermissions.legendDisabled', 'Permission disabled')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span>{t('rolePermissions.legendCritical', 'Critical permission')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      +
                    </Badge>
                    <span>{t('rolePermissions.legendAdded', 'Added to defaults')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      -
                    </Badge>
                    <span>{t('rolePermissions.legendRemoved', 'Removed from defaults')}</span>
                  </div>
                </>
              )}
            </div>
            {/* Save button */}
            {selectedRole && (
              <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending} size="default">
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
          </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          {t(
            'rolePermissions.infoAlert',
            'Changes to role permissions will affect all users with that role. Individual staff members can have custom permissions in Team Management.',
          )}
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Role Selector Sidebar */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{t('rolePermissions.selectRole', 'Select Role')}</CardTitle>
            <CardDescription>{t('rolePermissions.selectRoleDesc', 'Choose a role to customize permissions')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {modifiableRoles.map(role => {
                  const roleData = rolePermissionsData?.data.find(rp => rp.role === role)
                  const isSelected = selectedRole === role

                  return (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getRoleDisplayName(role)}</span>
                        {roleData?.isCustom && (
                          <Badge variant={isSelected ? 'secondary' : 'outline'} className="text-xs">
                            {t('rolePermissions.custom', 'Custom')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm opacity-80 mt-1">
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

        {/* Permission Grid */}
        {selectedRole && currentRolePermission && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {getRoleDisplayName(selectedRole)}
                    {currentRolePermission.isCustom && <Badge variant="secondary">{t('rolePermissions.customized', 'Customized')}</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {currentRolePermission.isCustom
                      ? t('rolePermissions.customPermissionsDesc', 'Custom permissions are active for this role')
                      : t('rolePermissions.defaultPermissionsDesc', 'Using default permissions for this role')}
                  </CardDescription>
                </div>
                {currentRolePermission.isCustom && (
                  <Button variant="outline" size="sm" onClick={handleRevert} disabled={revertMutation.isPending}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('rolePermissions.revertToDefaults', 'Revert to Defaults')}
                  </Button>
                )}
              </div>
              {currentRolePermission.modifiedBy && (
                <div className="text-sm text-muted-foreground mt-2">
                  {t('rolePermissions.lastModified', 'Last modified by')}{' '}
                  <span className="font-medium">
                    {currentRolePermission.modifiedBy.firstName} {currentRolePermission.modifiedBy.lastName}
                  </span>{' '}
                  {currentRolePermission.modifiedAt && (
                    <span>
                      {t('common.on')} {new Date(currentRolePermission.modifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <PermissionGrid
                selectedPermissions={modifiedPermissions}
                onChange={handlePermissionsChange}
                userRole={staffInfo.role}
                targetRole={selectedRole}
                defaultPermissions={DEFAULT_PERMISSIONS[selectedRole] || []}
                disabled={updateMutation.isPending || revertMutation.isPending}
              />
            </CardContent>
          </Card>
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
        </TabsContent>

        {/* Display Names Tab */}
        <TabsContent value="display-names" className="space-y-6">
          <RoleDisplayNames />
        </TabsContent>
      </Tabs>
    </div>
  )
}
