import { useMemo } from 'react'
import {
  Sparkles,
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { StaffRole } from '@/types'
import { getRoleDisplayName } from '@/lib/permissions/roleHierarchy'
import { ROLE_TEMPLATES, detectMatchingTemplate, getRelevantTemplates } from '@/lib/permissions/permissionGroups'

// Icon mapping for role templates
const ROLE_ICON_MAP: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  Crown: <Crown className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
  Wallet: <Wallet className="w-4 h-4" />,
  UtensilsCrossed: <UtensilsCrossed className="w-4 h-4" />,
  ChefHat: <ChefHat className="w-4 h-4" />,
  UserCircle: <UserCircle className="w-4 h-4" />,
  Eye: <Eye className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
}

/**
 * StatusPulse - Animated status indicator
 * Matches VenuePaymentConfig.tsx design
 */
const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  }

  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors[status])} />
    </span>
  )
}

/**
 * GlassCard wrapper
 */
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300 overflow-hidden',
      className
    )}
  >
    {children}
  </div>
)

interface PermissionTemplateSelectorProps {
  selectedRole: StaffRole
  currentPermissions: string[]
  onTemplateSelect: (role: StaffRole) => void
  disabled?: boolean
}

/**
 * TemplateCard - Individual role template card
 */
interface TemplateCardProps {
  role: StaffRole | 'custom'
  icon: React.ReactNode
  description: string
  permissionCount?: number
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}

function TemplateCard({ role, icon, description, permissionCount, isActive, onClick, disabled }: TemplateCardProps) {
  const { t } = useTranslation('settings')
  const isCustom = role === 'custom'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isCustom}
      className={cn(
        'flex-shrink-0 w-28 sm:w-36 p-2 sm:p-3 rounded-xl border transition-all text-left',
        isActive
          ? 'border-green-500 bg-green-50 dark:bg-green-950/30 ring-2 ring-green-500/20'
          : 'border-border/50 bg-card/50 hover:bg-card/80 hover:border-border',
        (disabled || isCustom) && 'opacity-60 cursor-not-allowed',
        !disabled && !isCustom && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <div className={cn('p-1 sm:p-1.5 rounded-lg', isActive ? 'bg-green-500/20' : 'bg-muted')}>{icon}</div>
        {isActive && <StatusPulse status="success" />}
      </div>
      <p className="font-medium text-xs sm:text-sm truncate">{isCustom ? t('rolePermissions.templates.custom', 'Custom') : getRoleDisplayName(role)}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 h-6 sm:h-8">{description}</p>
      {permissionCount !== undefined && !isCustom && (
        <Badge variant="outline" className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs">
          {permissionCount}
        </Badge>
      )}
      {isCustom && isActive && (
        <Badge variant="outline" className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs border-green-500 text-green-600 dark:text-green-400">
          {t('rolePermissions.templates.currentlyActive', 'Active')}
        </Badge>
      )}
    </button>
  )
}

/**
 * PermissionTemplateSelector - Role template horizontal card selector
 *
 * Features:
 * - Shows available role templates based on target role
 * - Detects which template is currently active
 * - Horizontal scrollable layout
 * - Visual indicator for active template (pulse)
 * - Custom indicator when permissions don't match any template
 *
 * Design: Inspired by Stripe's role presets
 */
export function PermissionTemplateSelector({
  selectedRole,
  currentPermissions,
  onTemplateSelect,
  disabled = false,
}: PermissionTemplateSelectorProps) {
  const { t } = useTranslation('settings')

  // Get relevant templates for the selected role
  const relevantTemplates = useMemo(() => getRelevantTemplates(selectedRole), [selectedRole])

  // Detect which template matches current permissions
  const matchingTemplate = useMemo(
    () => detectMatchingTemplate(currentPermissions, selectedRole),
    [currentPermissions, selectedRole]
  )

  return (
    <GlassCard className="p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{t('rolePermissions.templates.title', 'Quick Presets')}</h3>
          <p className="text-xs text-muted-foreground truncate sm:whitespace-normal">
            {t('rolePermissions.templates.description', 'Select a role template to quickly apply a permission set')}
          </p>
        </div>
      </div>

      {/* Horizontal scrollable template cards */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {relevantTemplates.map(template => {
          const icon = ROLE_ICON_MAP[template.icon] || <Settings className="w-4 h-4" />
          const isActive = matchingTemplate === template.role

          return (
            <TemplateCard
              key={template.role}
              role={template.role}
              icon={icon}
              description={t(template.descriptionKey, '')}
              permissionCount={template.permissionCount}
              isActive={isActive}
              onClick={() => onTemplateSelect(template.role)}
              disabled={disabled}
            />
          )
        })}

        {/* Custom indicator - always show if current permissions are custom */}
        <TemplateCard
          role="custom"
          icon={<Settings className="w-4 h-4" />}
          description={t('rolePermissions.templates.customDesc', 'Custom permissions configured')}
          isActive={matchingTemplate === 'custom'}
          onClick={() => {}}
          disabled
        />
      </div>
    </GlassCard>
  )
}

export default PermissionTemplateSelector
