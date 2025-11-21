import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { notificationCategories, getCategoryById } from '@/lib/notifications/categories'
import * as notificationService from '@/services/notification.service'
import { NotificationChannel, NotificationPriority, NotificationType } from '@/services/notification.service'
import { canShowNotifications, requestNotificationPermission } from '@/utils/notification.utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, ChevronDown, ChevronRight, Clock, CreditCard, Mail, Settings, Shield, ShoppingBag, Smartphone, Star, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface NotificationPreferencesV2Props {
  className?: string
}

const iconMap = {
  ShoppingBag,
  CreditCard,
  Star,
  Users,
  Settings,
  Shield,
  Bell,
}

const channelIconMap = {
  [NotificationChannel.IN_APP]: Bell,
  [NotificationChannel.EMAIL]: Mail,
  [NotificationChannel.SMS]: Smartphone,
  [NotificationChannel.PUSH]: Bell,
}

export function NotificationPreferencesV2({ className }: NotificationPreferencesV2Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')

  const [expandedCategories, setExpandedCategories] = useState<string[]>(['orders', 'payments'])
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )

  // Fetch preferences
  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationService.getPreferences,
  })

  // Update preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      toast({
        title: t('saved'),
        description: t('preferencesSaved'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToUpdate'),
        variant: 'destructive',
      })
    },
  })

  const getPreferenceForType = (type: NotificationType) => {
    const preference = preferences.find(p => p.type === type)
    if (preference) return preference

    // Return default from metadata
    const category = notificationCategories.find(cat => cat.types.some(t => t.type === type))
    const metadata = category?.types.find(t => t.type === type)

    return {
      type,
      enabled: metadata?.defaultEnabled ?? true,
      channels: metadata?.defaultChannels ?? [NotificationChannel.IN_APP],
      priority: metadata?.defaultPriority ?? NotificationPriority.NORMAL,
      quietStart: '',
      quietEnd: '',
    }
  }

  const handleToggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => (prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]))
  }

  const handleToggleNotification = async (type: NotificationType, enabled: boolean) => {
    await updatePreferenceMutation.mutateAsync({ type, enabled })
  }

  const handleToggleChannel = async (type: NotificationType, channel: NotificationChannel) => {
    const currentPref = getPreferenceForType(type)
    const currentChannels = currentPref.channels || []

    let newChannels: NotificationChannel[]
    if (currentChannels.includes(channel)) {
      // Remove channel, but always keep at least IN_APP
      newChannels = currentChannels.filter(c => c !== channel)
      if (newChannels.length === 0) {
        newChannels = [NotificationChannel.IN_APP]
      }
    } else {
      // Add channel
      newChannels = [...currentChannels, channel]
    }

    await updatePreferenceMutation.mutateAsync({ type, channels: newChannels })
  }

  const handleRequestBrowserPermission = async () => {
    const permission = await requestNotificationPermission()
    setBrowserPermission(permission)

    if (permission === 'granted') {
      toast({
        title: t('enabled'),
        description: t('browserEnabled'),
      })
    } else {
      toast({
        title: t('blocked'),
        description: t('browserBlocked'),
        variant: 'destructive',
      })
    }
  }

  const totalEnabled = useMemo(() => {
    return preferences.filter(p => p.enabled).length
  }, [preferences])

  const totalAvailable = useMemo(() => {
    return notificationCategories.reduce((acc, cat) => acc + cat.types.length, 0)
  }, [])

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-5xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('preferences')}</h1>
        <p className="text-muted-foreground mt-2">{t('preferencesSubtitle')}</p>
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {totalEnabled} / {totalAvailable} {t('enabled').toLowerCase()}
          </Badge>
          {browserPermission === 'granted' && (
            <Badge variant="default" className="text-sm flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('browserEnabled')}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Browser Notification Permission */}
      {browserPermission !== 'granted' && (
        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">{t('enableBrowser')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('enableBrowserDesc')}</p>
                </div>
              </div>
              <Button onClick={handleRequestBrowserPermission} variant="outline" size="sm">
                {t('enable')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Categories */}
      <div className="space-y-4">
        {notificationCategories.map(category => {
          const Icon = iconMap[category.icon as keyof typeof iconMap] || Bell
          const isExpanded = expandedCategories.includes(category.id)

          const enabledCount = category.types.filter(typeData => {
            const pref = getPreferenceForType(typeData.type)
            return pref.enabled
          }).length

          return (
            <Card key={category.id} className="overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => handleToggleCategory(category.id)}
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-foreground capitalize">{t(`categories.${category.id}`)}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{category.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {enabledCount}/{category.types.length}
                  </Badge>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="border-t">
                  {category.types.map((typeData, index) => {
                    const preference = getPreferenceForType(typeData.type)
                    const isEnabled = preference.enabled

                    return (
                      <div key={typeData.type} className={`px-6 py-4 ${index !== 0 ? 'border-t' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Title and Toggle */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{notificationService.formatNotificationType(typeData.type)}</span>
                                {!typeData.canDisable && (
                                  <Badge variant="outline" className="text-xs">
                                    {t('required')}
                                  </Badge>
                                )}
                              </div>
                              <Switch checked={isEnabled} onCheckedChange={enabled => handleToggleNotification(typeData.type, enabled)} disabled={!typeData.canDisable} />
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground">{typeData.description}</p>

                            {/* Channels */}
                            {isEnabled && (
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <span className="text-xs text-muted-foreground">{t('channels')}:</span>
                                {[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH].map(channel => {
                                  const isActive = preference.channels?.includes(channel) || false
                                  const ChannelIcon = channelIconMap[channel]
                                  const isDisabled = channel === NotificationChannel.IN_APP && preference.channels?.length === 1

                                  return (
                                    <button
                                      key={channel}
                                      onClick={() => !isDisabled && handleToggleChannel(typeData.type, channel)}
                                      disabled={isDisabled}
                                      className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                                        ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                      `}
                                    >
                                      <ChannelIcon className="h-3 w-3" />
                                      {channel.replace('_', ' ')}
                                      {isActive && <Check className="h-3 w-3" />}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('quietHours')}
          </CardTitle>
          <CardDescription>{t('quietHoursDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiet-start">{t('startTime')}</Label>
              <Input id="quiet-start" type="time" placeholder="22:00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-end">{t('endTime')}</Label>
              <Input id="quiet-end" type="time" placeholder="08:00" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('quietHoursNote')}</p>
        </CardContent>
      </Card>

      {/* Test Notification */}
      <Card>
        <CardHeader>
          <CardTitle>{t('testTitle')}</CardTitle>
          <CardDescription>{t('testDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              if (canShowNotifications()) {
                new Notification(t('testTitle'), {
                  body: t('testBody'),
                  icon: '/favicon.ico',
                })
              } else {
                toast({
                  title: t('testTitle'),
                  description: t('testBody'),
                })
              }
            }}
            variant="outline"
          >
            {t('sendTest')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotificationPreferencesV2
