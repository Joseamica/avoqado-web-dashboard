import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PERMISSION_CATEGORIES, CRITICAL_PERMISSIONS } from '@/lib/permissions/roleHierarchy'
import { StaffRole } from '@/types'

interface PermissionGridProps {
  selectedPermissions: string[]
  onChange: (permissions: string[]) => void
  userRole: StaffRole
  targetRole: StaffRole
  defaultPermissions: string[]
  disabled?: boolean
}

export function PermissionGrid({
  selectedPermissions,
  onChange,
  userRole,
  targetRole,
  defaultPermissions,
  disabled = false,
}: PermissionGridProps) {
  const { t } = useTranslation('settings')
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(new Set(selectedPermissions))

  useEffect(() => {
    setLocalPermissions(new Set(selectedPermissions))
  }, [selectedPermissions])

  // Check if user is modifying their own role
  const isOwnRole = userRole === targetRole

  // Check if permission is a wildcard
  const hasWildcard = selectedPermissions.includes('*:*')

  // Get all available permissions from categories
  const allPermissions = Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions)

  // If wildcard is active, create a set with all permissions for display
  const displayPermissions = hasWildcard
    ? new Set([...localPermissions, ...allPermissions])
    : localPermissions

  const togglePermission = (permission: string) => {
    if (disabled) return

    const newPermissions = new Set(localPermissions)

    // If wildcard is active and user is unchecking something,
    // we need to expand wildcard to individual permissions
    if (hasWildcard && newPermissions.has('*:*')) {
      // Remove wildcard
      newPermissions.delete('*:*')
      // Add all individual permissions
      allPermissions.forEach(p => newPermissions.add(p))
      // Now remove the one the user unchecked
      if (permission !== '*:*') {
        // Check if removing a critical permission from own role
        if (isOwnRole && CRITICAL_PERMISSIONS.includes(permission)) {
          return
        }
        newPermissions.delete(permission)
      }
    } else {
      // Normal logic when no wildcard
      if (newPermissions.has(permission)) {
        // Check if removing a critical permission from own role
        if (isOwnRole && CRITICAL_PERMISSIONS.includes(permission)) {
          return
        }
        newPermissions.delete(permission)
      } else {
        newPermissions.add(permission)
      }
    }

    const permissionsArray = Array.from(newPermissions)
    setLocalPermissions(newPermissions)
    onChange(permissionsArray)
  }

  const toggleCategory = (category: typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES]) => {
    if (disabled) return

    const categoryPermissions = category.permissions
    const newPermissions = new Set(localPermissions)

    // If wildcard is active, expand it first
    if (hasWildcard && newPermissions.has('*:*')) {
      newPermissions.delete('*:*')
      allPermissions.forEach(p => newPermissions.add(p))
    }

    // Check if all permissions in category are selected
    const allSelected = categoryPermissions.every(p => newPermissions.has(p))

    if (allSelected) {
      // Deselect all (except critical permissions if own role)
      categoryPermissions.forEach(p => {
        if (!isOwnRole || !CRITICAL_PERMISSIONS.includes(p)) {
          newPermissions.delete(p)
        }
      })
    } else {
      // Select all
      categoryPermissions.forEach(p => newPermissions.add(p))
    }

    const permissionsArray = Array.from(newPermissions)
    setLocalPermissions(newPermissions)
    onChange(permissionsArray)
  }

  const isCategoryFullySelected = (category: typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES]) => {
    return category.permissions.every(p => displayPermissions.has(p))
  }

  const isCategoryPartiallySelected = (category: typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES]) => {
    const selected = category.permissions.filter(p => displayPermissions.has(p))
    return selected.length > 0 && selected.length < category.permissions.length
  }

  const formatPermission = (permission: string) => {
    const [resource, action] = permission.split(':')
    return {
      resource: resource ? t(`rolePermissions.resources.${resource}`, resource.charAt(0).toUpperCase() + resource.slice(1)) : '',
      action: action ? t(`rolePermissions.actions.${action}`, action.charAt(0).toUpperCase() + action.slice(1)) : '',
    }
  }

  const isPermissionCritical = (permission: string) => {
    return isOwnRole && CRITICAL_PERMISSIONS.includes(permission)
  }

  const isPermissionModified = (permission: string) => {
    const isInDefault = defaultPermissions.includes(permission) || defaultPermissions.includes('*:*')
    const isInCurrent = localPermissions.has(permission) || hasWildcard
    return isInDefault !== isInCurrent
  }

  return (
    <div className="space-y-6">
      {/* Self-modification warning */}
      {isOwnRole && (
        <Alert className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            {t('rolePermissions.modifyingOwnRole', 'You are modifying permissions for your own role. Critical permissions cannot be removed to prevent self-lockout.')}
          </AlertDescription>
        </Alert>
      )}

      {/* Permission Categories */}
      <div className="grid gap-4">
        {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => {
          const isFullySelected = isCategoryFullySelected(category)
          const isPartiallySelected = isCategoryPartiallySelected(category)
          const categoryKey = key.toLowerCase()

          return (
            <Card key={key} className="overflow-hidden">
              <CardHeader className="bg-muted/50 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isFullySelected}
                      onCheckedChange={() => toggleCategory(category)}
                      disabled={disabled}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 dark:data-[state=checked]:bg-green-600 dark:data-[state=checked]:border-green-600 data-[state=indeterminate]:bg-green-500 dark:data-[state=indeterminate]:bg-green-600"
                      {...(isPartiallySelected && !isFullySelected ? { 'data-state': 'indeterminate' } : {})}
                    />
                    <div>
                      <CardTitle className="text-base">{t(`rolePermissions.categories.${categoryKey}`, category.label)}</CardTitle>
                      <CardDescription className="text-sm">
                        {category.permissions.length} {t('rolePermissions.permissions', 'permissions')}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={isFullySelected ? 'default' : 'outline'}
                    className={`text-xs ${isFullySelected ? 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700' : ''}`}
                  >
                    {category.permissions.filter(p => displayPermissions.has(p)).length}/{category.permissions.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {category.permissions.map(permission => {
                    const { resource, action } = formatPermission(permission)
                    const isCritical = isPermissionCritical(permission)
                    const isModified = isPermissionModified(permission)
                    const isChecked = displayPermissions.has(permission)

                    return (
                      <div
                        key={permission}
                        className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
                          isChecked ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted/50'
                        } ${isCritical ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => togglePermission(permission)}
                          disabled={disabled || isCritical}
                          id={permission}
                          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 dark:data-[state=checked]:bg-green-600 dark:data-[state=checked]:border-green-600"
                        />
                        <Label
                          htmlFor={permission}
                          className={`flex-1 text-sm flex items-center justify-between ${
                            isCritical ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          }`}
                        >
                          <span>
                            <span className="font-medium text-foreground">{resource}</span>
                            <span className="text-muted-foreground">: {action}</span>
                          </span>
                          <div className="flex items-center space-x-1">
                            {isCritical && (
                              <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            )}
                            {isModified && !isCritical && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {isChecked ? '+' : '-'}
                              </Badge>
                            )}
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default PermissionGrid
