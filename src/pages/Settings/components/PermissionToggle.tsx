import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PermissionToggleProps {
  permission: string
  isEnabled: boolean
  isDefault: boolean
  isCritical: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
  highlighted?: boolean
  /**
   * Nombre legible del permiso que IMPLICA a éste, si lo hay. Cuando viene, la casilla se
   * bloquea y se explica por qué.
   *
   * No es cosmético: el backend repone automáticamente los permisos implicados (sin
   * `orders:create` no funciona `tpv-payments:pay-later`). Sin este aviso, el admin
   * desmarcaba la casilla, guardaba, y el permiso seguía ahí sin ninguna explicación — la
   * pantalla mentía. Decisión del founder (2026-08-18): lo incluido no se quita por
   * separado, pero se VE.
   */
  impliedBy?: string | null
}

/**
 * Format a permission string into resource and action parts
 * e.g., "orders:create" -> { resource: "Orders", action: "Create" }
 */
function formatPermission(permission: string, t: (key: string, options?: { defaultValue?: string }) => string) {
  const parts = permission.split(':')
  const resource = parts[0]
  const action = parts.slice(1).join(':')

  // Try compound action key first (e.g., "command:lock"), fallback to joining individual parts
  const actionKey = `rolePermissions.actions.${action}`
  const actionLabel = t(actionKey, { defaultValue: '' })
  const resolvedAction = actionLabel || parts.slice(1).map(part =>
    t(`rolePermissions.actions.${part}`, { defaultValue: part.charAt(0).toUpperCase() + part.slice(1) })
  ).join(': ')

  return {
    resource: resource ? t(`rolePermissions.resources.${resource}`, { defaultValue: resource.charAt(0).toUpperCase() + resource.slice(1) }) : '',
    action: resolvedAction,
  }
}

/**
 * PermissionToggle - Individual permission toggle with Switch component
 *
 * Features:
 * - Switch-based toggle (more modern than checkboxes)
 * - Visual indicator for enabled state (green background)
 * - Critical permission warning (yellow, locked)
 * - Modified indicator (+/- badge)
 * - Search highlight support
 *
 * Design: Inspired by Stripe's permission toggles
 */
export function PermissionToggle({
  permission,
  isEnabled,
  isDefault,
  isCritical,
  onChange,
  disabled = false,
  impliedBy = null,
  highlighted = false,
}: PermissionToggleProps) {
  const { t } = useTranslation('settings')
  const { resource, action } = formatPermission(permission, t)

  // Visual indicator for modified state
  const isModified = isEnabled !== isDefault
  const modifiedType = isEnabled && !isDefault ? 'added' : !isEnabled && isDefault ? 'removed' : null

  const handleChange = (checked: boolean) => {
    // Don't allow changes to critical permissions
    if (isCritical || impliedBy) return
    onChange(checked)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all gap-2',
        isEnabled ? 'bg-green-50 dark:bg-green-950/20' : 'bg-muted/30 hover:bg-muted/50',
        isCritical && 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800',
        !isCritical && impliedBy && 'bg-muted/40 border border-border',
        highlighted && 'ring-2 ring-primary/30 ring-offset-1 ring-offset-background'
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Switch
          checked={isEnabled}
          onCheckedChange={handleChange}
          disabled={disabled || isCritical || !!impliedBy}
          className={cn(
            'data-[state=checked]:bg-green-500 dark:data-[state=checked]:bg-green-600 flex-shrink-0 scale-90 sm:scale-100',
            isCritical && 'opacity-50 cursor-not-allowed',
            !isCritical && impliedBy && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={`${resource}: ${action}`}
        />
        <Label
          className={cn(
            'text-xs sm:text-sm cursor-pointer select-none min-w-0',
            isCritical && 'cursor-not-allowed opacity-70',
            !isCritical && impliedBy && 'cursor-not-allowed opacity-70',
            disabled && 'cursor-not-allowed'
          )}
        >
          <span className="font-medium text-foreground">{resource}</span>
          <span className="text-muted-foreground">: {action}</span>
        </Label>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {isCritical && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  {t(
                    'rolePermissions.criticalPermissionTooltip',
                    'This is a critical permission that cannot be removed from your own role to prevent self-lockout'
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!isCritical && impliedBy && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-4 sm:h-5 whitespace-nowrap shrink-0 text-muted-foreground">
                  {t('rolePermissions.includedInBadge', 'Incluido')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  {t('rolePermissions.impliedByTooltip', 'This permission comes bundled with "{{permission}}". To remove it, remove that one too.', {
                    permission: impliedBy,
                  })}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isModified && !isCritical && !impliedBy && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-4 sm:h-5',
              modifiedType === 'added' && 'border-green-500 text-green-600 dark:text-green-400',
              modifiedType === 'removed' && 'border-red-500 text-red-600 dark:text-red-400'
            )}
          >
            {modifiedType === 'added' ? '+' : '-'}
          </Badge>
        )}
      </div>
    </div>
  )
}

export default PermissionToggle
