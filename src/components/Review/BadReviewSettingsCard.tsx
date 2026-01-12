import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, AlertTriangle } from 'lucide-react'

import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole, VenueSettings } from '@/types'

const AVAILABLE_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.ADMIN,
  StaffRole.MANAGER,
  StaffRole.CASHIER,
  StaffRole.WAITER,
]

const THRESHOLD_OPTIONS = [
  { value: '1', labelKey: 'settings.badReviews.threshold.1star' },
  { value: '2', labelKey: 'settings.badReviews.threshold.2stars' },
  { value: '3', labelKey: 'settings.badReviews.threshold.3stars' },
  { value: '4', labelKey: 'settings.badReviews.threshold.4stars' },
]

interface BadReviewSettings {
  notifyBadReviews: boolean
  badReviewThreshold: number
  badReviewAlertRoles: StaffRole[]
}

interface BadReviewSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BadReviewSettingsDialog({ open, onOpenChange }: BadReviewSettingsDialogProps) {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('reviews')
  const { t: tCommon } = useTranslation()
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()

  const [settings, setSettings] = useState<BadReviewSettings>({
    notifyBadReviews: true,
    badReviewThreshold: 3,
    badReviewAlertRoles: [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER],
  })
  const [isDirty, setIsDirty] = useState(false)

  // Fetch venue settings
  const { data: venueSettings, isLoading } = useQuery({
    queryKey: ['venue-settings', venueId],
    queryFn: async () => {
      const response = await api.get<VenueSettings>(`/api/v1/dashboard/venues/${venueId}/settings`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Initialize settings from fetched data
  useEffect(() => {
    if (venueSettings) {
      setSettings({
        notifyBadReviews: venueSettings.notifyBadReviews ?? true,
        badReviewThreshold: venueSettings.badReviewThreshold ?? 3,
        badReviewAlertRoles: venueSettings.badReviewAlertRoles ?? [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER],
      })
      setIsDirty(false)
    }
  }, [venueSettings])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: BadReviewSettings) => {
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, data)
      return response.data
    },
    onSuccess: () => {
      toast({ title: t('settings.badReviews.toasts.updateSuccess') })
      queryClient.invalidateQueries({ queryKey: ['venue-settings', venueId] })
      setIsDirty(false)
    },
    onError: () => {
      toast({
        title: t('settings.badReviews.toasts.updateError'),
        variant: 'destructive',
      })
    },
  })

  const handleToggleNotify = (checked: boolean) => {
    setSettings(prev => ({ ...prev, notifyBadReviews: checked }))
    setIsDirty(true)
  }

  const handleThresholdChange = (value: string) => {
    setSettings(prev => ({ ...prev, badReviewThreshold: parseInt(value) }))
    setIsDirty(true)
  }

  const handleRoleToggle = (role: StaffRole) => {
    setSettings(prev => {
      const roles = prev.badReviewAlertRoles.includes(role)
        ? prev.badReviewAlertRoles.filter(r => r !== role)
        : [...prev.badReviewAlertRoles, role]
      return { ...prev, badReviewAlertRoles: roles }
    })
    setIsDirty(true)
  }

  const handleSave = () => {
    updateMutation.mutate(settings)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('settings.badReviews.title')}
          </DialogTitle>
          <DialogDescription>{t('settings.badReviews.description')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable notifications toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-bad-reviews">{t('settings.badReviews.enableNotifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.badReviews.enableNotificationsDescription')}</p>
              </div>
              <Switch id="notify-bad-reviews" checked={settings.notifyBadReviews} onCheckedChange={handleToggleNotify} />
            </div>

            {/* Threshold selector */}
            {settings.notifyBadReviews && (
              <>
                <div className="space-y-2">
                  <Label>{t('settings.badReviews.thresholdLabel')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.badReviews.thresholdDescription')}</p>
                  <Select value={String(settings.badReviewThreshold)} onValueChange={handleThresholdChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THRESHOLD_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 mt-2 p-3 bg-muted/50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">
                      {t('settings.badReviews.thresholdHint', { threshold: settings.badReviewThreshold })}
                    </span>
                  </div>
                </div>

                {/* Roles selector */}
                <div className="space-y-2">
                  <Label>{t('settings.badReviews.rolesLabel')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.badReviews.rolesDescription')}</p>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {AVAILABLE_ROLES.map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={settings.badReviewAlertRoles.includes(role)}
                          onCheckedChange={() => handleRoleToggle(role)}
                        />
                        <label htmlFor={`role-${role}`} className="text-sm font-medium leading-none cursor-pointer">
                          {getRoleDisplayName(role)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
                {updateMutation.isPending ? t('settings.badReviews.saving') : tCommon('common.save')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
