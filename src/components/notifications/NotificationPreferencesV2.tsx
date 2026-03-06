import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { notificationCategories } from '@/lib/notifications/categories'
import { NotificationChannel, NotificationPriority, NotificationType } from '@/services/notification.service'
import * as notificationService from '@/services/notification.service'
import { canShowNotifications, requestNotificationPermission } from '@/utils/notification.utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Bell, Check, Clock, CreditCard, Mail, Shield, ShoppingBag, Smartphone, Star, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface NotificationPreferencesV2Props {
  className?: string
}

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

const channelIconMap = {
  [NotificationChannel.IN_APP]: Bell,
  [NotificationChannel.EMAIL]: Mail,
  [NotificationChannel.SMS]: Smartphone,
  [NotificationChannel.PUSH]: Bell,
}

// Category IDs + special tabs
const ALL_TABS = ['all', ...notificationCategories.map(c => c.id), 'settings'] as const
type TabId = (typeof ALL_TABS)[number]

export function NotificationPreferencesV2({ className }: NotificationPreferencesV2Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('notifications')

  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  )

  // Fetch preferences
  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationService.getPreferences(),
  })

  // Update preference mutation
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
      quietStart: '',
      quietEnd: '',
    }
  }

  const handleToggleNotification = async (type: NotificationType, enabled: boolean) => {
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

  const handleRequestBrowserPermission = async () => {
    const permission = await requestNotificationPermission()
    setBrowserPermission(permission)
    toast(
      permission === 'granted'
        ? { title: t('enabled'), description: t('browserEnabled') }
        : { title: t('blocked'), description: t('browserBlocked'), variant: 'destructive' },
    )
  }

  const totalEnabled = useMemo(() => preferences.filter(p => p.enabled).length, [preferences])
  const totalAvailable = useMemo(() => notificationCategories.reduce((acc, cat) => acc + cat.types.length, 0), [])

  // Categories to show based on active tab
  const visibleCategories = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'settings') return notificationCategories
    return notificationCategories.filter(c => c.id === activeTab)
  }, [activeTab])

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="h-14 bg-card border-y border-border" />
        <div className="p-6 animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Sticky Nav — same pattern as MenuMaker */}
      <nav className="sticky top-0 z-50 flex items-center space-x-6 lg:space-x-8 border-y border-border px-4 sm:px-6 bg-card h-14 shadow-sm overflow-x-auto">
        {/* "All" tab */}
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-primary',
          )}
        >
          {t('all')}
        </button>

        {/* Category tabs */}
        {notificationCategories.map(category => {
          const enabledCount = category.types.filter(td => getPreferenceForType(td.type).enabled).length
          return (
            <button
              key={category.id}
              onClick={() => setActiveTab(category.id)}
              className={cn(
                'text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
                activeTab === category.id ? 'text-foreground' : 'text-muted-foreground hover:text-primary',
              )}
            >
              {t(`categories.${category.id}`)}
              <span className="text-[11px] text-muted-foreground">
                {enabledCount}/{category.types.length}
              </span>
            </button>
          )
        })}

        {/* Settings tab */}
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
            activeTab === 'settings' ? 'text-foreground' : 'text-muted-foreground hover:text-primary',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {t('quietHours')}
        </button>
      </nav>

      {/* Content */}
      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('preferences')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('preferencesSubtitle')}</p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {totalEnabled} / {totalAvailable} {t('enabled').toLowerCase()}
          </Badge>
        </div>

        {/* Browser permission banner */}
        {browserPermission !== 'granted' && activeTab !== 'settings' && (
          <div className="flex items-center justify-between rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20 px-4 py-3">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-sm font-medium text-foreground">{t('enableBrowser')}</p>
                <p className="text-xs text-muted-foreground">{t('enableBrowserDesc')}</p>
              </div>
            </div>
            <Button onClick={handleRequestBrowserPermission} variant="outline" size="sm">
              {t('enable')}
            </Button>
          </div>
        )}

        {/* Settings tab content */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Quiet Hours */}
            <Card className="border-input">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
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
            <Card className="border-input">
              <CardHeader>
                <CardTitle className="text-lg">{t('testTitle')}</CardTitle>
                <CardDescription>{t('testDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (canShowNotifications()) {
                      new Notification(t('testTitle'), { body: t('testBody'), icon: '/favicon.ico' })
                    } else {
                      toast({ title: t('testTitle'), description: t('testBody') })
                    }
                  }}
                  variant="outline"
                >
                  {t('sendTest')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notification types list */}
        {activeTab !== 'settings' &&
          visibleCategories.map(category => {
            const Icon = iconMap[category.icon] || Bell

            return (
              <div key={category.id}>
                {/* Category header — only show when viewing "all" */}
                {activeTab === 'all' && (
                  <div className="flex items-center gap-2 mb-3 mt-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      {t(`categories.${category.id}`)}
                    </h2>
                    <span className="text-xs text-muted-foreground">— {t(`categoryDescriptions.${category.id}`)}</span>
                  </div>
                )}

                {/* Single category header when filtered */}
                {activeTab !== 'all' && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-lg font-semibold text-foreground">{t(`categories.${category.id}`)}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{t(`categoryDescriptions.${category.id}`)}</p>
                  </div>
                )}

                {/* Notification rows */}
                <div className="rounded-lg border border-input divide-y divide-border">
                  {category.types.map(typeData => {
                    const preference = getPreferenceForType(typeData.type)
                    const isEnabled = preference.enabled

                    return (
                      <div key={typeData.type} className="px-4 py-4 flex items-start gap-4">
                        {/* Left: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{t(`types.${typeData.type}`)}</span>
                            {!typeData.canDisable && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t('required')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(`typeDescriptions.${typeData.type}`)}</p>

                          {/* Channel pills — inline, compact */}
                          {isEnabled && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH].map(
                                channel => {
                                  const isActive = preference.channels?.includes(channel) || false
                                  const ChannelIcon = channelIconMap[channel]
                                  const isDisabled = channel === NotificationChannel.IN_APP && preference.channels?.length === 1

                                  return (
                                    <button
                                      key={channel}
                                      onClick={() => !isDisabled && handleToggleChannel(typeData.type, channel)}
                                      disabled={isDisabled}
                                      className={cn(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                                        isActive
                                          ? 'bg-primary/10 text-primary border border-primary/20'
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                                        isDisabled && 'opacity-50 cursor-not-allowed',
                                        !isDisabled && 'cursor-pointer',
                                      )}
                                    >
                                      <ChannelIcon className="h-2.5 w-2.5" />
                                      {t(`channelNames.${channel}`)}
                                      {isActive && <Check className="h-2.5 w-2.5" />}
                                    </button>
                                  )
                                },
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: toggle */}
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={enabled => handleToggleNotification(typeData.type, enabled)}
                          disabled={!typeData.canDisable}
                        />
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

export default NotificationPreferencesV2
