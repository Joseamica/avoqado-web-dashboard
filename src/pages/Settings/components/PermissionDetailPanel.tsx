import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, includesNormalized } from '@/lib/utils'
import { PERMISSION_CATEGORIES, CRITICAL_PERMISSIONS } from '@/lib/permissions/roleHierarchy'

interface PermissionDetailPanelProps {
  categoryKey: string
  selectedPermissions: Set<string>
  defaultPermissions: string[]
  onChange: (permission: string, enabled: boolean) => void
  disabled?: boolean
  isOwnRole?: boolean
  searchTerm?: string
}

interface PermissionGroup {
  id: string
  parentPermission?: string
  children: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Descriptive label for a permission.
 * Looks up `permissionLabels.<key>` first, falls back to generic action label.
 */
function formatPermissionLabel(permission: string, t: (key: string, options?: { defaultValue?: string }) => string) {
  const labelKey = `rolePermissions.permissionLabels.${permission.replace(/:/g, '_')}`
  const explicitLabel = t(labelKey, { defaultValue: '' })
  if (explicitLabel) return explicitLabel

  const parts = permission.split(':')
  const action = parts.slice(1).join(':')
  const actionKey = `rolePermissions.actions.${action}`
  const actionLabel = t(actionKey, { defaultValue: '' })
  return actionLabel || parts.slice(1).map(part =>
    t(`rolePermissions.actions.${part}`, { defaultValue: part.charAt(0).toUpperCase() + part.slice(1) })
  ).join(': ')
}

/**
 * Optional description for a permission (empty string if none exists).
 */
function getPermissionDescription(permission: string, t: (key: string, options?: { defaultValue?: string }) => string) {
  return t(`rolePermissions.permissionDescriptions.${permission.replace(/:/g, '_')}`, { defaultValue: '' })
}

/**
 * Build hierarchical groups from a flat permission list.
 * 3-part permissions (e.g. tpv:command:lock) are grouped under their 2-part
 * prefix (tpv:command). Groups with only 1 child are flattened back.
 */
function buildPermissionHierarchy(permissions: readonly string[]): {
  flatPermissions: string[]
  groups: PermissionGroup[]
} {
  const groupMap = new Map<string, string[]>()
  const flat: string[] = []

  for (const p of permissions) {
    const parts = p.split(':')
    if (parts.length >= 3) {
      const groupKey = parts.slice(0, 2).join(':')
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, [])
      groupMap.get(groupKey)!.push(p)
    } else {
      flat.push(p)
    }
  }

  const groups: PermissionGroup[] = []
  const parentKeys = new Set<string>()

  for (const [groupKey, children] of groupMap) {
    // Single-child groups without an explicit parent → flatten
    if (children.length === 1 && !flat.includes(groupKey)) {
      flat.push(children[0])
      continue
    }

    const hasParent = flat.includes(groupKey)
    if (hasParent) parentKeys.add(groupKey)

    groups.push({
      id: groupKey,
      parentPermission: hasParent ? groupKey : undefined,
      children,
    })
  }

  return {
    flatPermissions: flat.filter(p => !parentKeys.has(p)),
    groups,
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single permission checkbox row */
function PermissionRow({
  permission,
  isEnabled,
  isCritical,
  disabled,
  label,
  description,
  onChange,
  indented = false,
  t,
}: {
  permission: string
  isEnabled: boolean
  isCritical: boolean
  disabled: boolean
  label: string
  description: string
  onChange: (permission: string, enabled: boolean) => void
  indented?: boolean
  t: (key: string) => string
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 py-2.5 px-1 rounded-lg cursor-pointer transition-colors',
        'hover:bg-accent/40',
        indented && 'pl-9',
        isCritical && 'cursor-not-allowed',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <Checkbox
        checked={isEnabled}
        onCheckedChange={(checked) => {
          if (isCritical || disabled) return
          onChange(permission, !!checked)
        }}
        disabled={disabled || isCritical}
        className={cn(
          'h-5 w-5 rounded mt-0.5 flex-shrink-0',
          isEnabled && 'data-[state=checked]:bg-foreground data-[state=checked]:border-foreground dark:data-[state=checked]:bg-foreground dark:data-[state=checked]:border-foreground',
        )}
      />
      <div className="flex-1 min-w-0">
        <span className={cn(
          'text-sm select-none',
          isEnabled ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {label}
        </span>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {isCritical && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help flex-shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">
                {t('rolePermissions.criticalPermissionTooltip')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </label>
  )
}

/** Collapsible permission group (parent + children) */
function PermissionGroupSection({
  group,
  selectedPermissions,
  disabled,
  isOwnRole,
  onChange,
  isExpanded,
  onToggleExpand,
  t,
}: {
  group: PermissionGroup
  selectedPermissions: Set<string>
  disabled: boolean
  isOwnRole: boolean
  onChange: (permission: string, enabled: boolean) => void
  isExpanded: boolean
  onToggleExpand: () => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) {
  const allGroupPermissions = group.parentPermission
    ? [group.parentPermission, ...group.children]
    : group.children

  const enabledCount = allGroupPermissions.filter(p => selectedPermissions.has(p)).length
  const totalCount = allGroupPermissions.length
  const allEnabled = enabledCount === totalCount
  const someEnabled = enabledCount > 0 && !allEnabled

  const groupLabel = formatPermissionLabel(group.id, t)
  const groupDescription = getPermissionDescription(group.id, t)

  const checkedState: boolean | 'indeterminate' = allEnabled
    ? true
    : someEnabled
      ? 'indeterminate'
      : false

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return

    const shouldEnable = !allEnabled
    allGroupPermissions.forEach(p => {
      if (isOwnRole && CRITICAL_PERMISSIONS.includes(p)) return
      if (shouldEnable && !selectedPermissions.has(p)) {
        onChange(p, true)
      } else if (!shouldEnable && selectedPermissions.has(p)) {
        onChange(p, false)
      }
    })
  }

  return (
    <div>
      {/* Group header */}
      <div
        className={cn(
          'flex items-start gap-2 py-2.5 px-1 rounded-lg transition-colors cursor-pointer',
          'hover:bg-accent/40',
        )}
        onClick={onToggleExpand}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground transition-transform duration-200',
            !isExpanded && '-rotate-90',
          )}
        />
        <div onClick={handleToggleAll} className="flex-shrink-0 mt-0.5">
          <Checkbox
            checked={checkedState}
            disabled={disabled}
            className={cn(
              'h-5 w-5 rounded',
              (allEnabled || someEnabled) &&
                'data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=indeterminate]:bg-foreground data-[state=indeterminate]:border-foreground dark:data-[state=checked]:bg-foreground dark:data-[state=checked]:border-foreground dark:data-[state=indeterminate]:bg-foreground dark:data-[state=indeterminate]:border-foreground',
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn(
            'text-sm select-none font-medium',
            enabledCount > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {groupLabel}
          </span>
          {groupDescription && !isExpanded && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
              {groupDescription}
            </p>
          )}
        </div>
      </div>

      {/* Expanded children */}
      {isExpanded && (
        <div className="ml-6 border-l border-border/50 pl-1">
          {groupDescription && (
            <p className="text-xs text-muted-foreground/70 py-1.5 px-1 leading-relaxed">
              {groupDescription}
            </p>
          )}
          {group.children.map(permission => {
            const isEnabled = selectedPermissions.has(permission)
            const isCritical = isOwnRole && CRITICAL_PERMISSIONS.includes(permission)
            return (
              <PermissionRow
                key={permission}
                permission={permission}
                isEnabled={isEnabled}
                isCritical={isCritical}
                disabled={disabled}
                label={formatPermissionLabel(permission, t)}
                description={getPermissionDescription(permission, t)}
                onChange={onChange}
                t={t}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PermissionDetailPanel({
  categoryKey,
  selectedPermissions,
  defaultPermissions,
  onChange,
  disabled = false,
  isOwnRole = false,
  searchTerm = '',
}: PermissionDetailPanelProps) {
  const { t } = useTranslation('settings')

  const category = PERMISSION_CATEGORIES[categoryKey as keyof typeof PERMISSION_CATEGORIES]
  const categoryPermissions = useMemo(() => category?.permissions ?? [], [category])

  const filteredPermissions = useMemo(() => {
    if (!searchTerm) return categoryPermissions
    return categoryPermissions.filter(p => includesNormalized(p ?? '', searchTerm))
  }, [categoryPermissions, searchTerm])

  // Build hierarchy
  const { flatPermissions, groups } = useMemo(
    () => buildPermissionHierarchy(filteredPermissions),
    [filteredPermissions],
  )

  // Expand / collapse — manual overrides keyed by group id
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({})

  const isGroupExpanded = useCallback(
    (group: PermissionGroup) => {
      if (group.id in expandOverrides) return expandOverrides[group.id]
      // Auto-expand when any permission in the group is enabled
      const all = group.parentPermission
        ? [group.parentPermission, ...group.children]
        : group.children
      return all.some(p => selectedPermissions.has(p))
    },
    [expandOverrides, selectedPermissions],
  )

  const toggleGroupExpand = useCallback(
    (group: PermissionGroup) => {
      const current = isGroupExpanded(group)
      setExpandOverrides(prev => ({ ...prev, [group.id]: !current }))
    },
    [isGroupExpanded],
  )

  // Category-level stats
  const enabledCount = categoryPermissions.filter(p => selectedPermissions.has(p)).length
  const hasAnyEnabled = enabledCount > 0

  const toggleAll = useCallback(() => {
    if (disabled) return
    categoryPermissions.forEach(permission => {
      if (!hasAnyEnabled) {
        if (!selectedPermissions.has(permission)) onChange(permission, true)
      } else {
        if (isOwnRole && CRITICAL_PERMISSIONS.includes(permission)) return
        if (selectedPermissions.has(permission)) onChange(permission, false)
      }
    })
  }, [disabled, categoryPermissions, hasAnyEnabled, selectedPermissions, onChange, isOwnRole])

  if (!category) return null

  if (filteredPermissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        {t('rolePermissions.noResultsFound')}
      </div>
    )
  }

  const categoryLabel = t(`rolePermissions.categories.${categoryKey.toLowerCase()}`, category.label)
  const categoryDescription = t(`rolePermissions.categoryDescriptions.${categoryKey.toLowerCase()}`, { defaultValue: '' })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header card: Title + Description + Master toggle */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{categoryLabel}</h3>
            {categoryDescription && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {categoryDescription}
              </p>
            )}
          </div>
          <Switch
            checked={hasAnyEnabled}
            onCheckedChange={toggleAll}
            disabled={disabled}
            className={cn(
              'flex-shrink-0 mt-0.5 scale-110',
              hasAnyEnabled && 'data-[state=checked]:bg-foreground dark:data-[state=checked]:bg-foreground',
            )}
            aria-label={hasAnyEnabled ? t('rolePermissions.deselectAll') : t('rolePermissions.selectAll')}
          />
        </div>
      </div>

      {/* Expandable permissions list */}
      {hasAnyEnabled && (
        <>
          <div className="border-t border-border mx-5 sm:mx-6" />

          <div className="p-5 sm:p-6 pt-4 sm:pt-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('rolePermissions.tabs.permissions', 'Permissions')}
            </span>

            <div className="mt-3 space-y-0.5">
              {/* Flat (non-grouped) permissions */}
              {flatPermissions.map(permission => {
                const isEnabled = selectedPermissions.has(permission)
                const isCritical = isOwnRole && CRITICAL_PERMISSIONS.includes(permission)
                return (
                  <PermissionRow
                    key={permission}
                    permission={permission}
                    isEnabled={isEnabled}
                    isCritical={isCritical}
                    disabled={disabled}
                    label={formatPermissionLabel(permission, t)}
                    description={getPermissionDescription(permission, t)}
                    onChange={onChange}
                    t={t}
                  />
                )
              })}

              {/* Collapsible groups (3-part permissions) */}
              {groups.map(group => (
                <PermissionGroupSection
                  key={group.id}
                  group={group}
                  selectedPermissions={selectedPermissions}
                  disabled={disabled}
                  isOwnRole={isOwnRole}
                  onChange={onChange}
                  isExpanded={isGroupExpanded(group)}
                  onToggleExpand={() => toggleGroupExpand(group)}
                  t={t}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PermissionDetailPanel
