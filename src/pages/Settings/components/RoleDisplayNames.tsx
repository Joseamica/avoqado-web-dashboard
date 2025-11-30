import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Save, Info, EyeOff, Eye, Palette, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { RoleConfigInput, StaffRole, DEFAULT_ROLE_DISPLAY_NAMES } from '@/types'
import { SimpleConfirmDialog } from '@/pages/Inventory/components/SimpleConfirmDialog'
import { PermissionGate } from '@/components/PermissionGate'

// Predefined colors for roles
const ROLE_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#6B7280', // Gray
]

interface RoleEditState {
  displayName: string
  description: string
  color: string | null
  isActive: boolean
}

export default function RoleDisplayNames() {
  const { t } = useTranslation('settings')
  const { toast } = useToast()

  const {
    configs,
    isLoading,
    updateConfigsAsync,
    isUpdating,
    resetConfigsAsync,
    isResetting,
  } = useRoleConfig()

  // Local edit state
  const [editedConfigs, setEditedConfigs] = useState<Record<StaffRole, RoleEditState>>({} as Record<StaffRole, RoleEditState>)
  const [hasChanges, setHasChanges] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  // Roles that can be customized (exclude SUPERADMIN)
  const editableRoles = useMemo(() => {
    return Object.values(StaffRole).filter(role => role !== StaffRole.SUPERADMIN)
  }, [])

  // Initialize edit state from configs
  useEffect(() => {
    if (configs.length > 0) {
      const initialState: Record<StaffRole, RoleEditState> = {} as Record<StaffRole, RoleEditState>

      editableRoles.forEach(role => {
        const config = configs.find(c => c.role === role)
        initialState[role] = {
          displayName: config?.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role],
          description: config?.description || '',
          color: config?.color || null,
          isActive: config?.isActive ?? true,
        }
      })

      setEditedConfigs(initialState)
      setHasChanges(false)
    }
  }, [configs, editableRoles])

  // Check if there are unsaved changes
  const checkForChanges = (newState: Record<StaffRole, RoleEditState>) => {
    let changed = false

    editableRoles.forEach(role => {
      const config = configs.find(c => c.role === role)
      const edited = newState[role]

      if (!edited) return

      const originalDisplayName = config?.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role]
      const originalDescription = config?.description || ''
      const originalColor = config?.color || null
      const originalIsActive = config?.isActive ?? true

      if (
        edited.displayName !== originalDisplayName ||
        edited.description !== originalDescription ||
        edited.color !== originalColor ||
        edited.isActive !== originalIsActive
      ) {
        changed = true
      }
    })

    setHasChanges(changed)
  }

  const handleInputChange = (role: StaffRole, field: keyof RoleEditState, value: string | boolean | null) => {
    setEditedConfigs(prev => {
      const newState = {
        ...prev,
        [role]: {
          ...prev[role],
          [field]: value,
        },
      }
      checkForChanges(newState)
      return newState
    })
  }

  const handleSave = async () => {
    try {
      const updates: RoleConfigInput[] = editableRoles
        .filter(role => {
          const edited = editedConfigs[role]
          const config = configs.find(c => c.role === role)
          const originalDisplayName = config?.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role]
          const originalDescription = config?.description || ''
          const originalColor = config?.color || null
          const originalIsActive = config?.isActive ?? true

          return (
            edited.displayName !== originalDisplayName ||
            edited.description !== originalDescription ||
            edited.color !== originalColor ||
            edited.isActive !== originalIsActive
          )
        })
        .map(role => {
          const config: RoleConfigInput = {
            role,
            displayName: editedConfigs[role].displayName || DEFAULT_ROLE_DISPLAY_NAMES[role],
            isActive: editedConfigs[role].isActive,
          }
          // Only include optional fields if they have values (avoid sending null)
          if (editedConfigs[role].description) {
            config.description = editedConfigs[role].description
          }
          if (editedConfigs[role].color) {
            config.color = editedConfigs[role].color
          }
          return config
        })

      if (updates.length === 0) {
        toast({
          title: t('roleDisplayNames.noChanges', 'No changes'),
          description: t('roleDisplayNames.noChangesDesc', 'There are no changes to save.'),
        })
        return
      }

      await updateConfigsAsync(updates)

      toast({
        title: t('roleDisplayNames.saveSuccess', 'Changes saved'),
        description: t('roleDisplayNames.saveSuccessDesc', 'Role display names have been updated.'),
      })

      setHasChanges(false)
    } catch (error: any) {
      toast({
        title: t('common.error', 'Error'),
        description: error.response?.data?.message || t('roleDisplayNames.saveError', 'Failed to save changes.'),
        variant: 'destructive',
      })
    }
  }

  const handleReset = async () => {
    try {
      await resetConfigsAsync()

      toast({
        title: t('roleDisplayNames.resetSuccess', 'Reset complete'),
        description: t('roleDisplayNames.resetSuccessDesc', 'All role names have been reset to defaults.'),
      })

      setShowResetDialog(false)
      setHasChanges(false)
    } catch (error: any) {
      toast({
        title: t('common.error', 'Error'),
        description: error.response?.data?.message || t('roleDisplayNames.resetError', 'Failed to reset.'),
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          {t(
            'roleDisplayNames.infoAlert',
            'Customize how role names appear in your venue. This only affects the display name, not the actual permissions.'
          )}
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {hasChanges && t('roleDisplayNames.unsavedChanges', 'You have unsaved changes')}
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="role-config:update">
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('roleDisplayNames.resetAll', 'Reset All')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isUpdating}
            >
              {isUpdating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  {t('roleDisplayNames.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('roleDisplayNames.saveChanges', 'Save Changes')}
                </>
              )}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {editableRoles.map(role => {
          const edited = editedConfigs[role]
          if (!edited) return null

          const config = configs.find(c => c.role === role)
          const isCustomized = config?.displayName !== DEFAULT_ROLE_DISPLAY_NAMES[role]

          return (
            <Card key={role} className={!edited.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{role}</CardTitle>
                    {isCustomized && (
                      <Badge variant="secondary" className="text-xs">
                        {t('roleDisplayNames.customized', 'Customized')}
                      </Badge>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          {edited.isActive ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Switch
                            checked={edited.isActive}
                            onCheckedChange={(checked) => handleInputChange(role, 'isActive', checked)}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {edited.isActive
                          ? t('roleDisplayNames.hideRole', 'Hide this role from selectors')
                          : t('roleDisplayNames.showRole', 'Show this role in selectors')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription className="text-xs">
                  {t('roleDisplayNames.defaultName', 'Default')}: {DEFAULT_ROLE_DISPLAY_NAMES[role]}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor={`${role}-name`} className="text-sm">
                    {t('roleDisplayNames.displayName', 'Display Name')}
                  </Label>
                  <Input
                    id={`${role}-name`}
                    value={edited.displayName}
                    onChange={(e) => handleInputChange(role, 'displayName', e.target.value)}
                    placeholder={DEFAULT_ROLE_DISPLAY_NAMES[role]}
                    maxLength={50}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor={`${role}-desc`} className="text-sm">
                    {t('roleDisplayNames.description', 'Description')}
                    <span className="text-muted-foreground ml-1">({t('common.optional', 'optional')})</span>
                  </Label>
                  <Input
                    id={`${role}-desc`}
                    value={edited.description}
                    onChange={(e) => handleInputChange(role, 'description', e.target.value)}
                    placeholder={t('roleDisplayNames.descriptionPlaceholder', 'Brief description of this role...')}
                    maxLength={200}
                  />
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    {t('roleDisplayNames.badgeColor', 'Badge Color')}
                    <span className="text-muted-foreground">({t('common.optional', 'optional')})</span>
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* No color option */}
                    <button
                      type="button"
                      onClick={() => handleInputChange(role, 'color', null)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        edited.color === null
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                      title={t('roleDisplayNames.defaultColor', 'Default color')}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {/* Color options */}
                    {ROLE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleInputChange(role, 'color', color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          edited.color === color
                            ? 'border-primary ring-2 ring-primary/20 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="pt-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    {t('roleDisplayNames.preview', 'Preview')}
                  </Label>
                  <Badge
                    variant="soft"
                    className="border"
                    style={
                      edited.color
                        ? {
                            backgroundColor: `${edited.color}20`,
                            color: edited.color,
                            borderColor: `${edited.color}40`,
                          }
                        : undefined
                    }
                  >
                    {edited.displayName || DEFAULT_ROLE_DISPLAY_NAMES[role]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Reset Confirmation Dialog */}
      <SimpleConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title={t('roleDisplayNames.resetConfirmTitle', 'Reset All Role Names?')}
        message={t(
          'roleDisplayNames.resetConfirmMessage',
          'This will reset all role display names, descriptions, and colors to their defaults. This action cannot be undone.'
        )}
        confirmLabel={t('roleDisplayNames.resetConfirm', 'Reset All')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleReset}
        isLoading={isResetting}
        variant="destructive"
      />
    </div>
  )
}
