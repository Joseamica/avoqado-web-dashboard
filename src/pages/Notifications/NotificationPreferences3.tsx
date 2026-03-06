/**
 * Variant 3: Notion-style — Master toggles + category cards
 * Global channel switches at top, then category-level ON/OFF.
 * Individual types only shown as expandable detail.
 */
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
  Mail,
  Shield,
  ShoppingBag,
  Smartphone,
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

export default function NotificationPreferences3() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationService.getPreferences,
  })

  const updatePreferenceMutation = useMutation({
    mutationFn: notificationService.updatePreferences,
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

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    await updatePreferenceMutation.mutateAsync({ type, enabled })
  }

  // Toggle all types in a category at once
  const handleToggleCategory = async (categoryId: string, enabled: boolean) => {
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return
    for (const typeData of category.types) {
      if (typeData.canDisable) {
        await updatePreferenceMutation.mutateAsync({ type: typeData.type, enabled })
      }
    }
  }

  const isCategoryEnabled = (categoryId: string) => {
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return false
    return category.types.every(td => getPreferenceForType(td.type).enabled)
  }

  const isCategoryPartial = (categoryId: string) => {
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return false
    const enabledCount = category.types.filter(td => getPreferenceForType(td.type).enabled).length
    return enabledCount > 0 && enabledCount < category.types.length
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
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

      {/* Master channel toggles */}
      <div className="rounded-xl border border-border/50 bg-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Canales de notificacion</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Bell, label: 'En App', desc: 'Notificaciones dentro del dashboard', defaultOn: true },
            { icon: Mail, label: 'Correo', desc: 'Resúmenes y alertas críticas', defaultOn: true },
            { icon: Smartphone, label: 'Push', desc: 'Alertas en tiempo real al celular', defaultOn: false },
          ].map(ch => (
            <div
              key={ch.label}
              className="flex items-center gap-3 rounded-lg border border-border/30 p-3"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
                <ch.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{ch.label}</span>
                <p className="text-[11px] text-muted-foreground leading-tight">{ch.desc}</p>
              </div>
              <Switch defaultChecked={ch.defaultOn} />
            </div>
          ))}
        </div>
      </div>

      {/* Category cards — accordion style, one open at a time */}
      <div className="space-y-2">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon] || Bell
          const isExpanded = expandedCategory === category.id
          const allEnabled = isCategoryEnabled(category.id)
          const partial = isCategoryPartial(category.id)

          return (
            <div key={category.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {/* Category row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{t(`categories.${category.id}`)}</span>
                    <p className="text-xs text-muted-foreground truncate">{t(`categoryDescriptions.${category.id}`)}</p>
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isExpanded && 'rotate-180')}
                  />
                </button>

                {/* Category master switch */}
                <div className="relative shrink-0">
                  <Switch
                    checked={allEnabled}
                    onCheckedChange={enabled => handleToggleCategory(category.id, enabled)}
                  />
                  {partial && (
                    <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" />
                  )}
                </div>
              </div>

              {/* Expanded individual types */}
              {isExpanded && (
                <div className="border-t border-border/50 bg-muted/20">
                  {category.types.map((typeData, i) => {
                    const pref = getPreferenceForType(typeData.type)
                    return (
                      <div
                        key={typeData.type}
                        className={cn(
                          'flex items-center justify-between px-4 py-2.5 pl-16',
                          i < category.types.length - 1 && 'border-b border-border/20',
                        )}
                      >
                        <span className="text-sm text-foreground">{t(`types.${typeData.type}`)}</span>
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={enabled => handleToggle(typeData.type, enabled)}
                          disabled={!typeData.canDisable}
                          className="scale-90"
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
