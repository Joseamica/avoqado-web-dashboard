/**
 * PromoterProfileCard - Profile info with avatar and status
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { User, MapPin, Phone, Mail, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromoterProfileCardProps {
  promoter: {
    id: string
    name: string
    store: string
    manager: string
    status: 'active' | 'break' | 'inactive'
    email?: string
    phone?: string
    level?: 'junior' | 'senior' | 'expert'
    rating?: number
    avatar?: string
  }
  className?: string
}

const STATUS_CONFIG = {
  active: { label: 'Activo', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
  break: { label: 'En Descanso', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
  inactive: { label: 'Inactivo', color: 'bg-gray-400', textColor: 'text-gray-600 dark:text-gray-400' },
}

const LEVEL_CONFIG = {
  junior: { label: 'Junior', variant: 'outline' as const },
  senior: { label: 'Senior', variant: 'secondary' as const },
  expert: { label: 'Experto', variant: 'default' as const },
}

export const PromoterProfileCard: React.FC<PromoterProfileCardProps> = ({
  promoter,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const statusConfig = STATUS_CONFIG[promoter.status]
  const levelConfig = promoter.level ? LEVEL_CONFIG[promoter.level] : null

  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
            {promoter.avatar ? (
              <img
                src={promoter.avatar}
                alt={promoter.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          {/* Status indicator */}
          <span className={cn(
            'absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background',
            statusConfig.color
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg truncate">{promoter.name}</h3>
            {levelConfig && (
              <Badge variant={levelConfig.variant} className="text-xs">
                {levelConfig.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{promoter.store}</span>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">
            {t('playtelecom:promoters.supervisor', { defaultValue: 'Supervisor' })}: {promoter.manager}
          </p>

          {/* Status */}
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-sm font-medium', statusConfig.textColor)}>
              {statusConfig.label}
            </span>
            {promoter.rating && (
              <div className="flex items-center gap-1 text-sm text-amber-500">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{promoter.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {promoter.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>{promoter.phone}</span>
              </div>
            )}
            {promoter.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span className="truncate">{promoter.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export default PromoterProfileCard
