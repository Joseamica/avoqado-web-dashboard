/**
 * RoleSelectionCards - Icon-based role picker with visual cards
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Shield,
  UserCog,
  Users,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type UserRole = 'ADMIN' | 'MANAGER' | 'PROMOTOR'

interface RoleConfig {
  id: UserRole
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
}

const ROLES: RoleConfig[] = [
  {
    id: 'ADMIN',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'from-red-500/20 to-red-500/5',
    borderColor: 'border-red-500/30',
  },
  {
    id: 'MANAGER',
    icon: UserCog,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'from-blue-500/20 to-blue-500/5',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'PROMOTOR',
    icon: Users,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'from-green-500/20 to-green-500/5',
    borderColor: 'border-green-500/30',
  },
]

interface RoleSelectionCardsProps {
  selectedRole: UserRole
  onSelectRole: (role: UserRole) => void
  disabled?: boolean
  className?: string
}

export const RoleSelectionCards: React.FC<RoleSelectionCardsProps> = ({
  selectedRole,
  onSelectRole,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">
          {t('playtelecom:users.roleSelection', { defaultValue: 'Rol del Usuario' })}
        </h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(role => {
          const Icon = role.icon
          const isSelected = selectedRole === role.id

          return (
            <button
              key={role.id}
              onClick={() => !disabled && onSelectRole(role.id)}
              disabled={disabled}
              className={cn(
                'relative group transition-all duration-200',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <GlassCard
                className={cn(
                  'p-4 text-center transition-all duration-200',
                  isSelected && role.borderColor,
                  isSelected && 'ring-2 ring-offset-2 ring-offset-background',
                  isSelected && role.borderColor.replace('border-', 'ring-'),
                  !isSelected && !disabled && 'hover:border-border hover:bg-muted/30'
                )}
              >
                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}

                {/* Icon */}
                <div className={cn(
                  'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3',
                  'bg-gradient-to-br',
                  role.bgColor
                )}>
                  <Icon className={cn('w-6 h-6', role.color)} />
                </div>

                {/* Label */}
                <p className={cn(
                  'font-medium text-sm',
                  isSelected ? role.color : 'text-foreground'
                )}>
                  {t(`playtelecom:users.roles.${role.id.toLowerCase()}`, { defaultValue: role.id })}
                </p>

                {/* Description */}
                <p className="text-xs text-muted-foreground mt-1">
                  {t(`playtelecom:users.roles.${role.id.toLowerCase()}Desc`, {
                    defaultValue: getRoleDescription(role.id),
                  })}
                </p>
              </GlassCard>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'Acceso total al sistema'
    case 'MANAGER':
      return 'Gestiona tiendas y equipos'
    case 'PROMOTOR':
      return 'Operaciones de venta'
    default:
      return ''
  }
}

export default RoleSelectionCards
