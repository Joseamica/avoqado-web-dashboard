/**
 * Variant 1: Linear-style — Simple ON/OFF per type
 * Collapsible cards per category, no channel granularity.
 * Channels are auto-assigned by criticality defaults.
 */
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { notificationCategories } from '@/lib/notifications/categories'
import { NotificationChannel, NotificationPriority, NotificationType } from '@/services/notification.service'
import * as notificationService from '@/services/notification.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Bell,
  ChevronDown,
  CreditCard,
  Shield,
  ShoppingBag,
  Star,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBag,
  CreditCard,
  Star,
  Users,
  Settings,
  Shield,
  Bell,
  BarChart3,
}

export default function NotificationPreferences1() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationService.getPreferences(),
  })

  const updatePreferenceMutation = useMutation({
    mutationFn: (pref: Parameters<typeof notificationService.updatePreferences>[0]) => notificationService.updatePreferences(pref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      toast({ title: t('saved'), description: t('preferencesSaved') })
    },
    onError: (error: any) => {
      toast({ title: t('error'), description: error.message || t('failedToUpdate'), variant: 'destructive' })
    },
  })

  const getPreferenceForType = (type: NotificationType) => {
    const preference = preferences.find(p => p.type === type)
    if (preference) return preference
    const category = notificationCategories.find(cat => cat.types.some(t => t.type === type))
    const metadata = category?.types.find(t => t.type === type)
    return {
      type,
      enabled: metadata?.defaultEnabled ?? true,
      channels: metadata?.defaultChannels ?? [NotificationChannel.IN_APP],
      priority: metadata?.defaultPriority ?? NotificationPriority.NORMAL,
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    await updatePreferenceMutation.mutateAsync({ type, enabled })
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('preferences')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('preferencesSubtitle')}</p>
      </div>

      {/* Category cards */}
      <div className="space-y-3">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon] || Bell
          const isExpanded = expandedCategories.has(category.id)
          const enabledCount = category.types.filter(td => getPreferenceForType(td.type).enabled).length
          const totalCount = category.types.length

          return (
            <div key={category.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {/* Category header — clickable to expand */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-foreground">{t(`categories.${category.id}`)}</span>
                  <p className="text-xs text-muted-foreground">{t(`categoryDescriptions.${category.id}`)}</p>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {enabledCount}/{totalCount}
                </Badge>
                <ChevronDown
                  className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
                />
              </button>

              {/* Expanded notification types */}
              {isExpanded && (
                <div className="border-t border-border/50">
                  {category.types.map((typeData, i) => {
                    const pref = getPreferenceForType(typeData.type)
                    return (
                      <div
                        key={typeData.type}
                        className={cn(
                          'flex items-center justify-between px-4 py-3 pl-16',
                          i < category.types.length - 1 && 'border-b border-border/30',
                        )}
                      >
                        <div>
                          <span className="text-sm text-foreground">{t(`types.${typeData.type}`)}</span>
                          <p className="text-xs text-muted-foreground">{t(`typeDescriptions.${typeData.type}`)}</p>
                        </div>
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={enabled => handleToggle(typeData.type, enabled)}
                          disabled={!typeData.canDisable}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
