import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Bell, BellOff, Clock, Mail, Smartphone, Volume2, VolumeX } from 'lucide-react'
import * as notificationService from '@/services/notification.service'
import { NotificationType, NotificationChannel, NotificationPriority, formatNotificationType } from '@/services/notification.service'
import { requestNotificationPermission, canShowNotifications } from '@/utils/notification.utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

interface NotificationPreferencesProps {
  className?: string
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default')
  
  // Fetch preferences
  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationService.getPreferences
  })

  // Update preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-preferences'])
      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.'
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update preferences',
        variant: 'destructive'
      })
    }
  })

  // Check browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }, [])

  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission()
    setBrowserPermission(permission)
    
    if (permission === 'granted') {
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive browser notifications.'
      })
    } else {
      toast({
        title: 'Notifications blocked',
        description: 'Browser notifications have been blocked. You can enable them in your browser settings.',
        variant: 'destructive'
      })
    }
  }

  const handlePreferenceUpdate = async (
    type: NotificationType,
    updates: Partial<{
      enabled: boolean
      channels: NotificationChannel[]
      priority: NotificationPriority
      quietStart: string
      quietEnd: string
    }>
  ) => {
    await updatePreferenceMutation.mutateAsync({
      type,
      ...updates
    })
  }

  const getPreferenceForType = (type: NotificationType) => {
    return preferences.find(p => p.type === type) || {
      type,
      enabled: true,
      channels: [NotificationChannel.IN_APP],
      priority: NotificationPriority.NORMAL,
      quietStart: '',
      quietEnd: ''
    }
  }

  const notificationTypes = Object.values(NotificationType)
  const notificationChannels = Object.values(NotificationChannel)
  const priorities = Object.values(NotificationPriority)

  // Group notification types by category
  const notificationCategories = {
    orders: [
      NotificationType.NEW_ORDER,
      NotificationType.ORDER_UPDATED,
      NotificationType.ORDER_READY,
      NotificationType.ORDER_CANCELLED
    ],
    payments: [
      NotificationType.PAYMENT_RECEIVED,
      NotificationType.PAYMENT_FAILED,
      NotificationType.REFUND_PROCESSED
    ],
    reviews: [
      NotificationType.NEW_REVIEW,
      NotificationType.BAD_REVIEW,
      NotificationType.REVIEW_RESPONSE_NEEDED
    ],
    staff: [
      NotificationType.SHIFT_REMINDER,
      NotificationType.SHIFT_ENDED,
      NotificationType.NEW_STAFF_JOINED
    ],
    system: [
      NotificationType.POS_DISCONNECTED,
      NotificationType.POS_RECONNECTED,
      NotificationType.LOW_INVENTORY,
      NotificationType.SYSTEM_MAINTENANCE,
      NotificationType.FEATURE_UPDATED
    ],
    admin: [
      NotificationType.VENUE_APPROVAL_NEEDED,
      NotificationType.VENUE_SUSPENDED,
      NotificationType.HIGH_COMMISSION_ALERT,
      NotificationType.REVENUE_MILESTONE
    ],
    general: [
      NotificationType.ANNOUNCEMENT,
      NotificationType.REMINDER,
      NotificationType.ALERT
    ]
  }

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center">
          <Settings className="h-6 w-6 mr-2" />
          Notification Preferences
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure how and when you receive notifications
        </p>
      </div>

      <Tabs defaultValue="types" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="types">Notification Types</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="general">General Settings</TabsTrigger>
        </TabsList>

        {/* Notification Types Tab */}
        <TabsContent value="types">
          <div className="space-y-6">
            {Object.entries(notificationCategories).map(([category, types]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize text-lg">
                    {category} Notifications
                  </CardTitle>
                  <CardDescription>
                    Configure notifications for {category}-related events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {types.map(type => {
                    const preference = getPreferenceForType(type)
                    return (
                      <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Label className="font-medium">
                              {formatNotificationType(type)}
                            </Label>
                            <Badge variant={preference.enabled ? 'default' : 'secondary'}>
                              {preference.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          
                          {preference.enabled && (
                            <div className="mt-2 flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <span>Channels:</span>
                                {preference.channels.map(channel => (
                                  <Badge key={channel} variant="outline" className="text-xs">
                                    {channel}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center space-x-1">
                                <span>Priority:</span>
                                <Badge variant="outline" className="text-xs">
                                  {preference.priority}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-4">
                          {preference.enabled && (
                            <>
                              <Select
                                value={preference.priority}
                                onValueChange={(value) =>
                                  handlePreferenceUpdate(type, { priority: value as NotificationPriority })
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {priorities.map(priority => (
                                    <SelectItem key={priority} value={priority}>
                                      {priority}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}

                          <Switch
                            checked={preference.enabled}
                            onCheckedChange={(enabled) =>
                              handlePreferenceUpdate(type, { enabled })
                            }
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels">
          <div className="space-y-6">
            {/* Browser Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Browser Notifications
                </CardTitle>
                <CardDescription>
                  Receive notifications directly in your browser
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Permission Status</p>
                    <p className="text-sm text-muted-foreground">
                      {browserPermission === 'granted' && 'Browser notifications are enabled'}
                      {browserPermission === 'denied' && 'Browser notifications are blocked'}
                      {browserPermission === 'default' && 'Browser notification permission not set'}
                    </p>
                  </div>
                  
                  {browserPermission !== 'granted' && (
                    <Button onClick={handleRequestPermission}>
                      {browserPermission === 'denied' ? 'Enable in Settings' : 'Enable Notifications'}
                    </Button>
                  )}
                  
                  {browserPermission === 'granted' && (
                    <Badge variant="default" className="flex items-center space-x-1">
                      <Bell className="h-3 w-3" />
                      <span>Enabled</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* In-App Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Volume2 className="h-5 w-5 mr-2" />
                  In-App Notifications
                </CardTitle>
                <CardDescription>
                  Notifications shown within the dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Always Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      In-app notifications are always active and cannot be disabled
                    </p>
                  </div>
                  <Badge variant="default" className="flex items-center space-x-1">
                    <Volume2 className="h-3 w-3" />
                    <span>Active</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <div className="space-y-6">
            {/* Quiet Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Quiet Hours
                </CardTitle>
                <CardDescription>
                  Set times when you don't want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      placeholder="22:00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      placeholder="08:00"
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  During quiet hours, only urgent notifications will be shown
                </p>
              </CardContent>
            </Card>

            {/* Test Notification */}
            <Card>
              <CardHeader>
                <CardTitle>Test Notifications</CardTitle>
                <CardDescription>
                  Send a test notification to verify your settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (canShowNotifications()) {
                      new Notification('Test Notification', {
                        body: 'Your notification settings are working correctly!',
                        icon: '/favicon.ico'
                      })
                    } else {
                      toast({
                        title: 'Test Notification',
                        description: 'Your notification settings are working correctly!'
                      })
                    }
                  }}
                >
                  Send Test Notification
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default NotificationPreferences