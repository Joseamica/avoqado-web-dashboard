/**
 * Variant 2: Slack-style — ON/OFF per type + channel toggles inline
 * Flat list grouped by category, channel pills visible when enabled.
 * No tabs, no collapsible — everything visible at once.
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
  Check,
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

const channelConfig = [
  { channel: NotificationChannel.IN_APP, icon: Bell, label: 'IN_APP' },
  { channel: NotificationChannel.EMAIL, icon: Mail, label: 'EMAIL' },
  { channel: NotificationChannel.PUSH, icon: Bell, label: 'PUSH' },
  { channel: NotificationChannel.SMS, icon: Smartphone, label: 'SMS' },
]

export default function NotificationPreferences2() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')

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

  const handleToggleChannel = async (type: NotificationType, channel: NotificationChannel) => {
    const currentPref = getPreferenceForType(type)
    const currentChannels = currentPref.channels || []
    let newChannels: NotificationChannel[]
    if (currentChannels.includes(channel)) {
      newChannels = currentChannels.filter(c => c !== channel)
      if (newChannels.length === 0) newChannels = [NotificationChannel.IN_APP]
    } else {
      newChannels = [...currentChannels, channel]
    }
    await updatePreferenceMutation.mutateAsync({ type, channels: newChannels })
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
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

      {/* Flat grouped list */}
      <div className="space-y-8">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon] || Bell

          return (
            <div key={category.id}>
              {/* Category label */}
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t(`categories.${category.id}`)}
                </h2>
              </div>

              {/* Notification rows */}
              <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/30">
                {category.types.map(typeData => {
                  const pref = getPreferenceForType(typeData.type)
                  const isEnabled = pref.enabled

                  return (
                    <div key={typeData.type} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{t(`types.${typeData.type}`)}</span>
                            {!typeData.canDisable && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                {t('required')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(`typeDescriptions.${typeData.type}`)}</p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={enabled => handleToggle(typeData.type, enabled)}
                          disabled={!typeData.canDisable}
                        />
                      </div>

                      {/* Channel toggles — only when enabled */}
                      {isEnabled && (
                        <div className="flex items-center gap-1.5 mt-2 ml-0">
                          {channelConfig.map(({ channel, icon: ChannelIcon, label }) => {
                            const isActive = pref.channels?.includes(channel) || false
                            return (
                              <button
                                key={channel}
                                onClick={() => handleToggleChannel(typeData.type, channel)}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                  isActive
                                    ? 'bg-foreground/10 text-foreground'
                                    : 'bg-muted/50 text-muted-foreground/60 hover:text-muted-foreground',
                                )}
                              >
                                <ChannelIcon className="h-3 w-3" />
                                {t(`channelNames.${label}`)}
                                {isActive && <Check className="h-3 w-3" />}
                              </button>
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
        })}
      </div>
    </div>
  )
}
