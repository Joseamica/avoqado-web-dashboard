/**
 * RoleSelectionCards - Dynamic role picker using venue's role config
 * Shows only active roles with custom display names and colors
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Shield,
  UserCog,
  Users,
  Check,
  Crown,
  Utensils,
  Eye,
  DoorOpen,
  ChefHat,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'

/** Icon mapping for each StaffRole */
const ROLE_ICONS: Record<string, LucideIcon> = {
  [StaffRole.SUPERADMIN]: Shield,
  [StaffRole.OWNER]: Crown,
  [StaffRole.ADMIN]: Shield,
  [StaffRole.MANAGER]: UserCog,
  [StaffRole.WAITER]: Utensils,
  [StaffRole.CASHIER]: Users,
  [StaffRole.KITCHEN]: ChefHat,
  [StaffRole.HOST]: DoorOpen,
  [StaffRole.VIEWER]: Eye,
}

/** Color palette for each StaffRole (gradient bg + text) */
const ROLE_COLORS: Record<string, { bgColor: string; borderColor: string; ringColor: string; textColor: string }> = {
  [StaffRole.SUPERADMIN]: {
    bgColor: 'from-amber-500/20 to-pink-500/10',
    borderColor: 'border-amber-500/30',
    ringColor: 'ring-amber-500/30',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  [StaffRole.OWNER]: {
    bgColor: 'from-purple-500/20 to-purple-500/5',
    borderColor: 'border-purple-500/30',
    ringColor: 'ring-purple-500/30',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  [StaffRole.ADMIN]: {
    bgColor: 'from-red-500/20 to-red-500/5',
    borderColor: 'border-red-500/30',
    ringColor: 'ring-red-500/30',
    textColor: 'text-red-600 dark:text-red-400',
  },
  [StaffRole.MANAGER]: {
    bgColor: 'from-blue-500/20 to-blue-500/5',
    borderColor: 'border-blue-500/30',
    ringColor: 'ring-blue-500/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  [StaffRole.WAITER]: {
    bgColor: 'from-orange-500/20 to-orange-500/5',
    borderColor: 'border-orange-500/30',
    ringColor: 'ring-orange-500/30',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  [StaffRole.CASHIER]: {
    bgColor: 'from-green-500/20 to-green-500/5',
    borderColor: 'border-green-500/30',
    ringColor: 'ring-green-500/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  [StaffRole.KITCHEN]: {
    bgColor: 'from-yellow-500/20 to-yellow-500/5',
    borderColor: 'border-yellow-500/30',
    ringColor: 'ring-yellow-500/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  [StaffRole.HOST]: {
    bgColor: 'from-teal-500/20 to-teal-500/5',
    borderColor: 'border-teal-500/30',
    ringColor: 'ring-teal-500/30',
    textColor: 'text-teal-600 dark:text-teal-400',
  },
  [StaffRole.VIEWER]: {
    bgColor: 'from-gray-500/20 to-gray-500/5',
    borderColor: 'border-gray-500/30',
    ringColor: 'ring-gray-500/30',
    textColor: 'text-muted-foreground',
  },
}

const DEFAULT_COLORS = ROLE_COLORS[StaffRole.VIEWER]

interface RoleSelectionCardsProps {
  selectedRole: string
  onSelectRole: (role: string) => void
  disabled?: boolean
  /** Restrict which roles are shown/selectable (from role hierarchy). If undefined, shows all active roles except SUPERADMIN/OWNER. */
  allowedRoles?: StaffRole[]
  className?: string
}

export const RoleSelectionCards: React.FC<RoleSelectionCardsProps> = ({
  selectedRole,
  onSelectRole,
  disabled = false,
  allowedRoles,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeRoles, getDisplayName, getColor } = useRoleConfig()

  // Filter out SUPERADMIN and OWNER, then apply allowedRoles from hierarchy
  const assignableRoles = activeRoles.filter(rc => {
    if (rc.role === StaffRole.SUPERADMIN || rc.role === StaffRole.OWNER) return false
    if (allowedRoles && allowedRoles.length > 0) return allowedRoles.includes(rc.role as StaffRole)
    return true
  })

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.roleSelection', { defaultValue: 'Rol del Usuario' })}
        </h4>
      </div>

      <div className={cn(
        'grid gap-3',
        assignableRoles.length <= 3 ? 'grid-cols-3' :
        assignableRoles.length <= 4 ? 'grid-cols-4' :
        'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5',
      )}>
        {assignableRoles.map(roleConfig => {
          const role = roleConfig.role
          const Icon = ROLE_ICONS[role] || Users
          const colors = ROLE_COLORS[role] || DEFAULT_COLORS
          const customColor = getColor(role)
          const isSelected = selectedRole === role
          const displayName = getDisplayName(role)

          return (
            <button
              key={role}
              onClick={() => !disabled && onSelectRole(role)}
              disabled={disabled}
              className={cn(
                'relative group transition-all duration-200 cursor-pointer',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <GlassCard
                className={cn(
                  'p-4 text-center transition-all duration-200',
                  isSelected && colors.borderColor,
                  isSelected && 'ring-2 ring-offset-2 ring-offset-background',
                  isSelected && colors.ringColor,
                  !isSelected && !disabled && 'hover:border-border hover:bg-muted/30',
                )}
              >
                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3',
                    'bg-gradient-to-br',
                    customColor ? '' : colors.bgColor,
                  )}
                  style={customColor ? {
                    background: `linear-gradient(to bottom right, ${customColor}33, ${customColor}0D)`,
                  } : undefined}
                >
                  <Icon
                    className="w-6 h-6"
                    style={customColor ? { color: customColor } : undefined}
                    {...(!customColor && { className: cn('w-6 h-6', colors.textColor) })}
                  />
                </div>

                {/* Label */}
                <p
                  className={cn(
                    'font-medium text-sm',
                    !customColor && (isSelected ? colors.textColor : 'text-foreground'),
                  )}
                  style={customColor && isSelected ? { color: customColor } : undefined}
                >
                  {displayName}
                </p>

                {/* Description */}
                <p className="text-xs text-muted-foreground mt-1">
                  {roleConfig.description || ''}
                </p>
              </GlassCard>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default RoleSelectionCards
