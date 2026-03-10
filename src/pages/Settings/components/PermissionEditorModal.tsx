import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw, Save, ChevronDown, Palette, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SimpleConfirmDialog } from '@/pages/Inventory/components/SimpleConfirmDialog'
import { RoleConfigInput, StaffRole, DEFAULT_ROLE_DISPLAY_NAMES } from '@/types'
import rolePermissionService from '@/services/rolePermission.service'
import { PERMISSION_CATEGORIES, CRITICAL_PERMISSIONS } from '@/lib/permissions/roleHierarchy'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import {
  DASHBOARD_SUPER_CATEGORIES,
  TPV_SUPER_CATEGORIES,
  filterPermissionsBySearch,
  type SuperCategory,
} from '@/lib/permissions/permissionGroups'

import PermissionSearch from './PermissionSearch'
import PermissionCategoryNav from './PermissionCategoryNav'
import PermissionDetailPanel from './PermissionDetailPanel'
import PermissionSuperCategory from './PermissionSuperCategory'

// Predefined colors for role badges
const ROLE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#6B7280',
]

interface PermissionEditorModalProps {
  open: boolean
  onClose: () => void
  role: StaffRole
  venueId: string
}

export function PermissionEditorModal({ open, onClose, role, venueId }: PermissionEditorModalProps) {
  const { staffInfo, checkFeatureAccess } = useAuth()
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { getDisplayName: getRoleDisplayName, configs: roleConfigs, updateConfigsAsync, isUpdating: isUpdatingConfig } = useRoleConfig()
  const queryClient = useQueryClient()

  // Permission state
  const [modifiedPermissions, setModifiedPermissions] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Role config state (display name, description, color)
  const [roleDisplayName, setRoleDisplayName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [roleColor, setRoleColor] = useState<string | null>(null)
  const [hasConfigChanges, setHasConfigChanges] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)

  // UI state
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Dialogs
  const [showRevertDialog, setShowRevertDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const roleLabel = getRoleDisplayName(role)

  // All permissions flat list
  const allPermissions = useMemo(
    () => Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions),
    []
  )

  const selectedPermissionsSet = useMemo(() => new Set(modifiedPermissions), [modifiedPermissions])

  // Fetch role permissions
  const { data: rolePermissionsData } = useQuery({
    queryKey: ['rolePermissions', venueId],
    queryFn: () => rolePermissionService.getAllRolePermissions(venueId),
    enabled: !!venueId && open,
  })

  const currentRolePermission = rolePermissionsData?.data.find(rp => rp.role === role)

  // Initialize permissions when modal opens or data loads
  useEffect(() => {
    if (open && currentRolePermission && !hasChanges) {
      if (currentRolePermission.permissions.includes('*:*')) {
        setModifiedPermissions(allPermissions)
      } else {
        setModifiedPermissions(currentRolePermission.permissions)
      }
    }
  }, [open, currentRolePermission, hasChanges, allPermissions])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setHasChanges(false)
      setHasConfigChanges(false)
      setSearchTerm('')
      setExpandedCategories(new Set())
      setAppearanceOpen(false)

      // Initialize role config fields
      const config = roleConfigs.find(c => c.role === role)
      setRoleDisplayName(config?.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role])
      setRoleDescription(config?.description || '')
      setRoleColor(config?.color || null)
    }
  }, [open, role, roleConfigs])

  // Auto-select first category
  useEffect(() => {
    if (open && !selectedCategoryKey) {
      const allSuperCats = [...filteredAllCategories]
      if (allSuperCats.length > 0 && allSuperCats[0].categoryKeys.length > 0) {
        setSelectedCategoryKey(allSuperCats[0].categoryKeys[0])
      }
    }
  }, [open])

  // Feature filtering
  const filterCategoriesByFeatures = useCallback((superCategories: SuperCategory[]) => {
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
          if (!requiredFeature) return true
          return checkFeatureAccess(requiredFeature)
        })
      }))
      .filter(superCat => superCat.categoryKeys.length > 0)
  }, [checkFeatureAccess])

  // Combined categories (no Dashboard/TPV split — flat list like Square)
  const allSuperCategories = useMemo(() => {
    const dashboard = filterCategoriesByFeatures(DASHBOARD_SUPER_CATEGORIES)
    const tpv = filterCategoriesByFeatures(TPV_SUPER_CATEGORIES)
    return [...dashboard, ...tpv]
  }, [filterCategoriesByFeatures])

  const filteredAllCategories = useMemo(
    () => filterPermissionsBySearch(allSuperCategories, debouncedSearchTerm),
    [allSuperCategories, debouncedSearchTerm]
  )

  // Default permissions for this role
  const defaultPermissions = useMemo(() => DEFAULT_PERMISSIONS[role] || [], [role])

  // Own role check
  const isOwnRole = staffInfo?.role === role

  // Full access toggle
  const isFullAccess = modifiedPermissions.length === allPermissions.length &&
    allPermissions.every(p => modifiedPermissions.includes(p))

  const toggleFullAccess = useCallback(() => {
    if (isFullAccess) {
      // Remove all (except critical if own role)
      if (isOwnRole) {
        setModifiedPermissions(CRITICAL_PERMISSIONS.filter(p => (allPermissions as string[]).includes(p)))
      } else {
        setModifiedPermissions([])
      }
    } else {
      setModifiedPermissions([...allPermissions])
    }
    setHasChanges(true)
  }, [isFullAccess, allPermissions, isOwnRole])

  // Permission toggle
  const handlePermissionChange = useCallback((permission: string, enabled: boolean) => {
    setModifiedPermissions(prev => {
      const newPermissions = enabled ? [...prev, permission] : prev.filter(p => p !== permission)
      if (newPermissions.length === allPermissions.length && allPermissions.every(p => newPermissions.includes(p))) {
        return ['*:*']
      }
      return newPermissions
    })
    setHasChanges(true)
  }, [allPermissions])

  // Category status for nav
  const getCategoryStatus = useCallback((categoryKey: keyof typeof PERMISSION_CATEGORIES) => {
    const category = PERMISSION_CATEGORIES[categoryKey]
    if (!category) return { enabled: 0, total: 0, status: 'off' as const }

    const enabled = category.permissions.filter(p => selectedPermissionsSet.has(p)).length
    const total = category.permissions.length

    let status: 'active' | 'partial' | 'off'
    if (enabled === total) status = 'active'
    else if (enabled > 0) status = 'partial'
    else status = 'off'

    return { enabled, total, status }
  }, [selectedPermissionsSet])

  // Category expansion toggle
  const toggleCategoryExpansion = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  // Save mutation
  const updateMutation = useMutation({
    mutationFn: (permissions: string[]) =>
      rolePermissionService.updateRolePermissions(venueId, role, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', venueId] })
      toast({
        title: t('rolePermissions.updateSuccess'),
        description: t('rolePermissions.updateSuccessDesc', { role: roleLabel }),
      })
      setHasChanges(false)
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.error || t('rolePermissions.updateError'),
        variant: 'destructive',
      })
    },
  })

  // Revert mutation
  const revertMutation = useMutation({
    mutationFn: () => rolePermissionService.deleteRolePermissions(venueId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', venueId] })
      toast({
        title: t('rolePermissions.revertSuccess'),
        description: t('rolePermissions.revertSuccessDesc', { role: roleLabel }),
      })
      setHasChanges(false)
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.error || t('rolePermissions.revertError'),
        variant: 'destructive',
      })
    },
  })

  // Reactively detect config changes
  useEffect(() => {
    if (!open) return
    const config = roleConfigs.find(c => c.role === role)
    const origName = config?.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role]
    const origDesc = config?.description || ''
    const origColor = config?.color || null
    setHasConfigChanges(roleDisplayName !== origName || roleDescription !== origDesc || roleColor !== origColor)
  }, [open, roleDisplayName, roleDescription, roleColor, roleConfigs, role])

  const handleSave = useCallback(async () => {
    // Save role config changes if any
    if (hasConfigChanges) {
      try {
        const configUpdate: RoleConfigInput = {
          role,
          displayName: roleDisplayName || DEFAULT_ROLE_DISPLAY_NAMES[role],
          isActive: true,
        }
        if (roleDescription) configUpdate.description = roleDescription
        if (roleColor) configUpdate.color = roleColor
        await updateConfigsAsync([configUpdate])
      } catch (error: any) {
        toast({
          title: tCommon('error'),
          description: error.response?.data?.message || t('roleDisplayNames.saveError', 'Failed to save role config.'),
          variant: 'destructive',
        })
        return
      }
    }

    // Save permissions
    let permissionsToSave = modifiedPermissions
    if (
      modifiedPermissions.length === allPermissions.length &&
      allPermissions.every(p => modifiedPermissions.includes(p))
    ) {
      permissionsToSave = ['*:*']
    }
    updateMutation.mutate(permissionsToSave)
  }, [modifiedPermissions, allPermissions, updateMutation, hasConfigChanges, role, roleDisplayName, roleDescription, roleColor, updateConfigsAsync, toast, tCommon, t])

  const handleClose = useCallback(() => {
    if (hasChanges || hasConfigChanges) {
      setShowUnsavedDialog(true)
      return
    }
    onClose()
  }, [hasChanges, hasConfigChanges, onClose])

  const confirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false)
    setHasChanges(false)
    onClose()
  }, [onClose])

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-2">
      {currentRolePermission?.isCustom && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRevertDialog(true)}
          disabled={revertMutation.isPending}
          className="text-destructive hover:text-destructive"
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          {t('rolePermissions.revertToDefaults')}
        </Button>
      )}
      <Button
        onClick={handleSave}
        disabled={(!hasChanges && !hasConfigChanges) || updateMutation.isPending || isUpdatingConfig}
        size="sm"
        className="min-w-[100px]"
      >
        {updateMutation.isPending ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1.5" />
            {t('rolePermissions.saving')}
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-1.5" />
            {t('rolePermissions.saveChanges')}
          </>
        )}
      </Button>
    </div>
  )

  return (
    <>
      <FullScreenModal
        open={open}
        onClose={handleClose}
        title={roleLabel}
        actions={headerActions}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Self-modification warning */}
          {isOwnRole && (
            <Alert className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                {t('rolePermissions.modifyingOwnRole')}
              </AlertDescription>
            </Alert>
          )}

          {/* Role Appearance (display name, description, color) */}
          <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full rounded-xl border border-border p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Palette className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-left">{t('roleDisplayNames.appearance', 'Apariencia')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 text-left">
                      {t('roleDisplayNames.appearanceDesc', 'Nombre, descripción y color del badge')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    variant="soft"
                    className="border"
                    style={
                      roleColor
                        ? {
                            backgroundColor: `${roleColor}20`,
                            color: roleColor,
                            borderColor: `${roleColor}40`,
                          }
                        : undefined
                    }
                  >
                    {roleDisplayName || DEFAULT_ROLE_DISPLAY_NAMES[role]}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-xl border border-border border-t-0 rounded-t-none px-4 sm:px-5 pb-4 sm:pb-5 pt-3 space-y-4">
                {/* Display Name */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="role-display-name" className="text-sm">
                      {t('roleDisplayNames.displayName', 'Nombre para mostrar')}
                    </Label>
                    <Input
                      id="role-display-name"
                      value={roleDisplayName}
                      onChange={(e) => setRoleDisplayName(e.target.value)}
                      placeholder={DEFAULT_ROLE_DISPLAY_NAMES[role]}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-description" className="text-sm">
                      {t('roleDisplayNames.description', 'Descripción')}
                      <span className="text-muted-foreground ml-1">({tCommon('optional', 'opcional')})</span>
                    </Label>
                    <Input
                      id="role-description"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      placeholder={t('roleDisplayNames.descriptionPlaceholder', 'Breve descripción de este rol...')}
                      maxLength={200}
                    />
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {t('roleDisplayNames.badgeColor', 'Color del badge')}
                    <span className="text-muted-foreground ml-1">({tCommon('optional', 'opcional')})</span>
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRoleColor(null)}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                        roleColor === null
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                      title={t('roleDisplayNames.defaultColor', 'Color por defecto')}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {ROLE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setRoleColor(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          roleColor === color
                            ? 'border-primary ring-2 ring-primary/20 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Full Access toggle card */}
          <div className="rounded-xl border border-border p-4 sm:p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">{t('rolePermissions.allPermissions', 'Full Access')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('rolePermissions.wildcardActive', 'This role has wildcard permissions (*:*) granting full access to all features.')}
              </p>
            </div>
            <Switch
              checked={isFullAccess}
              onCheckedChange={toggleFullAccess}
              disabled={updateMutation.isPending || revertMutation.isPending}
              className="data-[state=checked]:bg-foreground dark:data-[state=checked]:bg-foreground flex-shrink-0"
            />
          </div>

          {/* Search */}
          <PermissionSearch value={searchTerm} onChange={setSearchTerm} className="max-w-lg" />

          {/* Two-column layout: Category Nav | Detail Panel */}
          <div className="grid gap-5 md:grid-cols-[260px_1fr] min-h-[400px]">
            {/* Left: Category navigation (desktop) */}
            <div className="hidden md:block rounded-xl border border-border overflow-hidden sticky top-0 self-start h-[calc(100vh-320px)]">
              <PermissionCategoryNav
                superCategories={filteredAllCategories}
                selectedCategoryKey={selectedCategoryKey}
                onSelectCategory={setSelectedCategoryKey}
                getCategoryStatus={getCategoryStatus}
                className="h-full"
              />
            </div>

            {/* Right: Detail panel */}
            <div className="min-w-0">
              {/* Mobile: collapsible list */}
              <div className="md:hidden space-y-3">
                {filteredAllCategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('rolePermissions.noResultsFound')}
                  </div>
                ) : (
                  filteredAllCategories.map(superCategory => (
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
              </div>

              {/* Desktop: selected category detail */}
              <div className="hidden md:block">
                {selectedCategoryKey ? (
                  <PermissionDetailPanel
                    categoryKey={selectedCategoryKey}
                    selectedPermissions={selectedPermissionsSet}
                    defaultPermissions={defaultPermissions}
                    onChange={handlePermissionChange}
                    disabled={updateMutation.isPending || revertMutation.isPending}
                    isOwnRole={isOwnRole}
                    searchTerm={debouncedSearchTerm}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    {t('rolePermissions.selectRoleDesc', 'Choose a category to customize permissions')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FullScreenModal>

      {/* Unsaved changes dialog */}
      <SimpleConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title={t('rolePermissions.unsavedChanges')}
        message={t('rolePermissions.unsavedChangesMessage')}
        confirmLabel={t('rolePermissions.discard')}
        cancelLabel={t('rolePermissions.cancel')}
        onConfirm={confirmDiscard}
        variant="destructive"
      />

      {/* Revert dialog */}
      <SimpleConfirmDialog
        open={showRevertDialog}
        onOpenChange={setShowRevertDialog}
        title={t('rolePermissions.confirmRevert', { role: roleLabel })}
        message={t('rolePermissions.confirmRevertMessage')}
        confirmLabel={t('rolePermissions.revertToDefaults')}
        cancelLabel={t('rolePermissions.cancel')}
        onConfirm={() => {
          revertMutation.mutate()
          setShowRevertDialog(false)
        }}
        isLoading={revertMutation.isPending}
        variant="destructive"
      />
    </>
  )
}

export default PermissionEditorModal
