/**
 * Variant 4: Hybrid — Global channel toggles + collapsible categories with ON/OFF per type
 * Best of Linear (simple per-type toggles) + Notion (master channel config).
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

const channelOptions = [
  {
    channel: NotificationChannel.IN_APP,
    icon: Bell,
    labelKey: 'IN_APP',
    descEs: 'Dentro del dashboard',
  },
  {
    channel: NotificationChannel.EMAIL,
    icon: Mail,
    labelKey: 'EMAIL',
    descEs: 'Resúmenes y alertas importantes',
  },
  {
    channel: NotificationChannel.PUSH,
    icon: Smartphone,
    labelKey: 'PUSH',
    descEs: 'Alertas en tiempo real al celular',
  },
]

export default function NotificationPreferences4() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')

  // Global channel state (local for now — could persist to backend)
  const [globalChannels, setGlobalChannels] = useState<Record<string, boolean>>({
    [NotificationChannel.IN_APP]: true,
    [NotificationChannel.EMAIL]: true,
    [NotificationChannel.PUSH]: false,
  })

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

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    await updatePreferenceMutation.mutateAsync({ type, enabled })
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const toggleGlobalChannel = (channel: string) => {
    setGlobalChannels(prev => ({ ...prev, [channel]: !prev[channel] }))
  }

  // Count active channels
  const activeChannelCount = Object.values(globalChannels).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
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

      {/* Global channel toggles */}
      <div className="rounded-xl border border-border/50 bg-card mb-6">
        <div className="px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t('channels')}</h2>
            <span className="text-xs text-muted-foreground">
              {activeChannelCount} {activeChannelCount === 1 ? 'canal activo' : 'canales activos'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Elige por dónde quieres recibir notificaciones. Aplica a todas las categorías.
          </p>
        </div>
        <div className="divide-y divide-border/30">
          {channelOptions.map(ch => {
            const isOn = globalChannels[ch.channel] ?? false
            return (
              <div key={ch.channel} className="flex items-center gap-3 px-4 py-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                  <ch.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{t(`channelNames.${ch.labelKey}`)}</span>
                  <p className="text-xs text-muted-foreground">{ch.descEs}</p>
                </div>
                <Switch checked={isOn} onCheckedChange={() => toggleGlobalChannel(ch.channel)} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Category cards — collapsible */}
      <div className="space-y-2">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon] || Bell
          const isExpanded = expandedCategories.has(category.id)
          const enabledCount = category.types.filter(td => getPreferenceForType(td.type).enabled).length
          const totalCount = category.types.length

          return (
            <div key={category.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-medium text-foreground">{t(`categories.${category.id}`)}</span>
                  <p className="text-xs text-muted-foreground truncate">{t(`categoryDescriptions.${category.id}`)}</p>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                  {enabledCount}/{totalCount}
                </Badge>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {/* Expanded types */}
              {isExpanded && (
                <div className="border-t border-border/30">
                  {category.types.map((typeData, i) => {
                    const pref = getPreferenceForType(typeData.type)
                    return (
                      <div
                        key={typeData.type}
                        className={cn(
                          'flex items-center justify-between px-4 py-3 pl-16',
                          i < category.types.length - 1 && 'border-b border-border/20',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">{t(`types.${typeData.type}`)}</span>
                            {!typeData.canDisable && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {t('required')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t(`typeDescriptions.${typeData.type}`)}
                          </p>
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
