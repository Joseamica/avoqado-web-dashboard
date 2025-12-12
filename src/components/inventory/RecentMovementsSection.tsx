import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { InventoryMovement } from '@/services/inventory.service'

interface RecentMovementsSectionProps {
  movements: InventoryMovement[]
  isLoading: boolean
  hasRecentMovements: boolean
  unit?: string
}

export function RecentMovementsSection({ movements, isLoading, hasRecentMovements, unit = 'units' }: RecentMovementsSectionProps) {
  const { t, i18n } = useTranslation('inventory')
  const { staffInfo } = useAuth()
  const { venueTimezone } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="p-3 rounded-lg border border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>{t('rawMaterials.movements.loading')}</span>
        </div>
      </div>
    )
  }

  if (!hasRecentMovements) {
    return (
      <div className="p-3 rounded-lg border border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{t('rawMaterials.movements.noRecentMovements')}</span>
        </div>
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border bg-muted/50">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-muted">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              <span>{t('rawMaterials.movements.recentActivity')}</span>
              <Badge variant="secondary" className="ml-1">
                {movements.length}
              </Badge>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border">
          <div className="p-3 space-y-2">
            {movements.map(movement => {
              const isRecent = new Date().getTime() - new Date(movement.createdAt).getTime() < 5 * 60 * 1000 // 5 minutes
              const isCurrentUser = movement.createdBy === staffInfo?.id
              const displayName = isCurrentUser ? t('common.you') : movement.createdBy || t('common.system')
              const isIncrease = movement.quantity > 0

              return (
                <div
                  key={movement.id}
                  className={cn(
                    'p-2 rounded-md border text-sm',
                    isRecent
                      ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-background border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-500 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {t(`rawMaterials.movements.types.${movement.type}`)}
                          </span>
                          <Badge variant={isIncrease ? 'default' : 'destructive'} className="text-xs">
                            {isIncrease ? '+' : ''}
                            {movement.quantity.toFixed(2)} {unit}
                          </Badge>
                        </div>
                        {movement.reason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{movement.reason}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{displayName}</span>
                          <span>•</span>
                          <span>
                            {DateTime.fromISO(movement.createdAt, { zone: 'utc' })
                              .setZone(venueTimezone)
                              .setLocale(localeCode)
                              .toRelative()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                      <div>{movement.previousStock.toFixed(2)} →</div>
                      <div className="font-medium text-foreground">{movement.newStock.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
