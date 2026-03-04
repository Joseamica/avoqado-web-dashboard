import { useMemo } from 'react'
import {
  Check,
  ShieldCheck,
  Crown,
  Briefcase,
  Wallet,
  UtensilsCrossed,
  ChefHat,
  UserCircle,
  Eye,
  Settings,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { StaffRole } from '@/types'
import { detectMatchingTemplate, getRelevantTemplates } from '@/lib/permissions/permissionGroups'
import { useRoleConfig } from '@/hooks/use-role-config'

// Icon mapping for role templates (compact size)
const ROLE_ICON_MAP: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="w-3.5 h-3.5" />,
  Crown: <Crown className="w-3.5 h-3.5" />,
  Briefcase: <Briefcase className="w-3.5 h-3.5" />,
  Wallet: <Wallet className="w-3.5 h-3.5" />,
  UtensilsCrossed: <UtensilsCrossed className="w-3.5 h-3.5" />,
  ChefHat: <ChefHat className="w-3.5 h-3.5" />,
  UserCircle: <UserCircle className="w-3.5 h-3.5" />,
  Eye: <Eye className="w-3.5 h-3.5" />,
  Settings: <Settings className="w-3.5 h-3.5" />,
}

interface PermissionTemplateSelectorProps {
  selectedRole: StaffRole
  currentPermissions: string[]
  onTemplateSelect: (role: StaffRole) => void
  disabled?: boolean
}

/**
 * PermissionTemplateSelector - Compact pill-based role template selector
 *
 * Redesigned from horizontal scroll cards to inline pills for
 * minimal vertical footprint. Tooltip shows description + permission count.
 */
export function PermissionTemplateSelector({
  selectedRole,
  currentPermissions,
  onTemplateSelect,
  disabled = false,
}: PermissionTemplateSelectorProps) {
  const { t } = useTranslation('settings')
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()

  const relevantTemplates = useMemo(() => getRelevantTemplates(selectedRole), [selectedRole])
  const matchingTemplate = useMemo(
    () => detectMatchingTemplate(currentPermissions, selectedRole),
    [currentPermissions, selectedRole]
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium shrink-0">
        {t('rolePermissions.templates.title', 'Quick Presets')}:
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {relevantTemplates.map(template => {
          const icon = ROLE_ICON_MAP[template.icon] || <Settings className="w-3.5 h-3.5" />
          const isActive = matchingTemplate === template.role

          return (
            <TooltipProvider key={template.role} delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onTemplateSelect(template.role)}
                    disabled={disabled}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      isActive
                        ? 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-700 dark:text-green-400'
                        : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border',
                      disabled && 'opacity-60 cursor-not-allowed',
                      !disabled && 'cursor-pointer'
                    )}
                  >
                    {icon}
                    <span className="truncate">{getRoleDisplayName(template.role)}</span>
                    {isActive && <Check className="w-3 h-3" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{t(template.descriptionKey, '')}</p>
                  {template.permissionCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.permissionCount} {t('rolePermissions.permissions', 'permissions')}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}

        {/* Custom indicator - shown when permissions don't match any template */}
        {matchingTemplate === 'custom' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border/60 bg-muted/50 text-muted-foreground">
            <Settings className="w-3.5 h-3.5" />
            {t('rolePermissions.templates.custom', 'Custom')}
            <Check className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  )
}

export default PermissionTemplateSelector
