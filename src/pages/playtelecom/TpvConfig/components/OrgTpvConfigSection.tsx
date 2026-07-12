/**
 * OrgTpvConfigSection - Organization-level TPV module & attendance defaults
 *
 * Shows org-level config: 6 module toggles + attendance parameters.
 * Visible for OWNER+ roles (OWNER and SUPERADMIN).
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Loader2,
  RotateCcw,
  Save,
  Clock,
  Banknote,
  CreditCard,
  ScanBarcode,
  Store,
  Camera,
  MapPin,
  ChevronDown,
} from 'lucide-react'
import {
  useOrgAttendanceConfig,
  useUpsertOrgAttendanceConfig,
  useDeleteOrgAttendanceConfig,
  useOrgPromoterLocationSettings,
  useUpdateVenuePromoterLocationSettings,
} from '@/hooks/useOrganizationConfig'
import type { VenuePromoterLocationSettings } from '@/services/organizationConfig.service'
import { useAccess } from '@/hooks/use-access'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i) // 0..23
const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1) // 1..24
const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

const MODULE_TOGGLES = [
  {
    key: 'attendanceTracking' as const,
    icon: Clock,
    colorClass: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
  },
  {
    key: 'enableCashPayments' as const,
    icon: Banknote,
    colorClass: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
  },
  {
    key: 'enableCardPayments' as const,
    icon: CreditCard,
    colorClass: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
  },
  {
    key: 'enableBarcodeScanner' as const,
    icon: ScanBarcode,
    colorClass: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
  },
  {
    key: 'trackPromoterLocation' as const,
    icon: MapPin,
    colorClass: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
  },
  {
    key: 'requireFacadePhoto' as const,
    icon: Store,
    colorClass: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
    parentKey: 'attendanceTracking' as const,
  },
  {
    key: 'requireDepositPhoto' as const,
    icon: Camera,
    colorClass: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    parentKey: 'attendanceTracking' as const,
  },
] as const

type ModuleKey = typeof MODULE_TOGGLES[number]['key']

export default function OrgTpvConfigSection() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { role } = useAccess()
  const { isOwner } = useCurrentOrganization()
  const isOwnerPlus = role === 'OWNER' || role === 'SUPERADMIN' || isOwner
  const { toast } = useToast()

  const { data: config, isLoading } = useOrgAttendanceConfig({ enabled: isOwnerPlus })
  const upsertMutation = useUpsertOrgAttendanceConfig()
  const deleteMutation = useDeleteOrgAttendanceConfig()

  // Module toggles state
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    attendanceTracking: false,
    requireFacadePhoto: false,
    requireDepositPhoto: false,
    enableCashPayments: true,
    enableCardPayments: true,
    enableBarcodeScanner: true,
    trackPromoterLocation: false,
  })

  // Attendance config state
  const [expectedCheckInTime, setExpectedCheckInTime] = useState('09:00')
  const [latenessThreshold, setLatenessThreshold] = useState('30')
  const [geofenceRadius, setGeofenceRadius] = useState('500')

  // Promoter location capture window (org default)
  const [promoterLocationStartHour, setPromoterLocationStartHour] = useState(11)
  const [promoterLocationEndHour, setPromoterLocationEndHour] = useState(18)
  const is24h = promoterLocationStartHour === 0 && promoterLocationEndHour === 24

  // Sync form with fetched config
  useEffect(() => {
    if (config) {
      setModules({
        attendanceTracking: config.attendanceTracking,
        requireFacadePhoto: config.requireFacadePhoto,
        requireDepositPhoto: config.requireDepositPhoto,
        enableCashPayments: config.enableCashPayments,
        enableCardPayments: config.enableCardPayments,
        enableBarcodeScanner: config.enableBarcodeScanner,
        trackPromoterLocation: config.trackPromoterLocation ?? false,
      })
      setExpectedCheckInTime(config.expectedCheckInTime)
      setLatenessThreshold(String(config.latenessThresholdMinutes))
      setGeofenceRadius(String(config.geofenceRadiusMeters))
      setPromoterLocationStartHour(config.promoterLocationStartHour ?? 11)
      setPromoterLocationEndHour(config.promoterLocationEndHour ?? 18)
    }
  }, [config])

  const handleToggle24h = useCallback((checked: boolean) => {
    if (checked) {
      setPromoterLocationStartHour(0)
      setPromoterLocationEndHour(24)
    } else {
      setPromoterLocationStartHour(11)
      setPromoterLocationEndHour(18)
    }
  }, [])

  const handleModuleChange = useCallback((key: ModuleKey, value: boolean) => {
    setModules(prev => {
      const next = { ...prev, [key]: value }
      // When disabling attendance, also disable sub-toggles
      if (key === 'attendanceTracking' && !value) {
        next.requireFacadePhoto = false
        next.requireDepositPhoto = false
      }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (modules.trackPromoterLocation && !is24h && promoterLocationStartHour >= promoterLocationEndHour) {
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.invalidWindow'), variant: 'destructive' })
      return
    }
    try {
      await upsertMutation.mutateAsync({
        ...modules,
        expectedCheckInTime,
        latenessThresholdMinutes: Number(latenessThreshold) || 30,
        geofenceRadiusMeters: Number(geofenceRadius) || 500,
        promoterLocationStartHour,
        promoterLocationEndHour,
      })
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.saveSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.error'), variant: 'destructive' })
    }
  }, [
    upsertMutation,
    modules,
    expectedCheckInTime,
    latenessThreshold,
    geofenceRadius,
    promoterLocationStartHour,
    promoterLocationEndHour,
    is24h,
    toast,
    t,
  ])

  const handleReset = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync()
      setModules({
        attendanceTracking: false,
        requireFacadePhoto: false,
        requireDepositPhoto: false,
        enableCashPayments: true,
        enableCardPayments: true,
        enableBarcodeScanner: true,
        trackPromoterLocation: false,
      })
      setExpectedCheckInTime('09:00')
      setLatenessThreshold('30')
      setGeofenceRadius('500')
      setPromoterLocationStartHour(11)
      setPromoterLocationEndHour(18)
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.resetSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.error'), variant: 'destructive' })
    }
  }, [deleteMutation, toast, t])

  if (!isOwnerPlus) return null

  const isMutating = upsertMutation.isPending || deleteMutation.isPending
  const ns = 'playtelecom:tpvConfig.orgTpvConfig'

  return (
    <GlassCard className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-muted-foreground uppercase">
            {t(`${ns}.title`)}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground" disabled={isMutating}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {t(`${ns}.reset`)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t(`${ns}.reset`)}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(`${ns}.resetConfirm`)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>{t('common:confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 hover:bg-primary/10" onClick={handleSave} disabled={isMutating}>
            {isMutating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            {t(`${ns}.save`)}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-5">{t(`${ns}.description`)}</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Module Toggles Section */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              {t(`${ns}.modulesTitle`)}
            </h5>
            <p className="text-[10px] text-muted-foreground mb-3">{t(`${ns}.modulesDescription`)}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MODULE_TOGGLES.map(mod => {
                const Icon = mod.icon
                const isDisabled = 'parentKey' in mod && !modules[mod.parentKey]
                return (
                  <div
                    key={mod.key}
                    className={cn(
                      'flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3 transition-opacity',
                      isDisabled && 'opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg bg-linear-to-br', mod.colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{t(`${ns}.${mod.key}`)}</p>
                        <p className="text-[10px] text-muted-foreground">{t(`${ns}.${mod.key}Desc`)}</p>
                      </div>
                    </div>
                    <Switch
                      checked={modules[mod.key]}
                      disabled={isDisabled}
                      onCheckedChange={(checked) => handleModuleChange(mod.key, checked)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Promoter Location Capture Window (visible when trackPromoterLocation is on) */}
          {modules.trackPromoterLocation && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                {t(`${ns}.locationWindowTitle`)}
              </h5>
              <p className="text-[10px] text-muted-foreground mb-3">{t(`${ns}.locationWindowDesc`)}</p>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(`${ns}.locationWindowStart`)}</Label>
                  <Select
                    value={String(promoterLocationStartHour)}
                    onValueChange={v => setPromoterLocationStartHour(Number(v))}
                    disabled={is24h}
                  >
                    <SelectTrigger className="w-28 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {START_HOUR_OPTIONS.map(h => (
                        <SelectItem key={h} value={String(h)}>
                          {formatHourLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(`${ns}.locationWindowEnd`)}</Label>
                  <Select
                    value={String(promoterLocationEndHour)}
                    onValueChange={v => setPromoterLocationEndHour(Number(v))}
                    disabled={is24h}
                  >
                    <SelectTrigger className="w-28 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {END_HOUR_OPTIONS.map(h => (
                        <SelectItem key={h} value={String(h)}>
                          {formatHourLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pb-1.5">
                  <Switch checked={is24h} onCheckedChange={handleToggle24h} />
                  <span className="text-xs text-muted-foreground">{t(`${ns}.locationWindow24h`)}</span>
                </div>
              </div>

              <div className="mt-4">
                <PerVenuePromoterLocationSettings ns={ns} />
              </div>
            </div>
          )}

          {/* Attendance Config Section (visible when attendanceTracking is on) */}
          {modules.attendanceTracking && (
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                {t(`${ns}.attendanceTitle`)}
              </h5>
              <p className="text-[10px] text-muted-foreground mb-3">{t(`${ns}.attendanceDescription`)}</p>
              <div className="space-y-4">
                {/* Expected Check-in Time */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(`${ns}.expectedCheckInTime`)}</Label>
                  <p className="text-[10px] text-muted-foreground">{t(`${ns}.expectedCheckInTimeDesc`)}</p>
                  <Input
                    type="time"
                    value={expectedCheckInTime}
                    onChange={e => setExpectedCheckInTime(e.target.value)}
                    className="w-40 h-8 text-sm"
                  />
                </div>

                {/* Lateness Threshold */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(`${ns}.latenessThreshold`)}</Label>
                  <p className="text-[10px] text-muted-foreground">{t(`${ns}.latenessThresholdDesc`)}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={latenessThreshold}
                      onChange={e => setLatenessThreshold(e.target.value)}
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{t(`${ns}.minutes`)}</span>
                  </div>
                </div>

                {/* Geofence Radius */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(`${ns}.geofenceRadius`)}</Label>
                  <p className="text-[10px] text-muted-foreground">{t(`${ns}.geofenceRadiusDesc`)}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="50"
                      max="5000"
                      value={geofenceRadius}
                      onChange={e => setGeofenceRadius(e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{t(`${ns}.meters`)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !config && (
        <p className="text-xs text-muted-foreground mt-3 italic">{t(`${ns}.noConfig`)}</p>
      )}
    </GlassCard>
  )
}

/**
 * PerVenuePromoterLocationSettings - Collapsible list letting OWNER+ override
 * trackPromoterLocation + the capture window (start/end hour) per venue.
 * Each row saves independently via a PUT to
 * /organizations/:orgId/venues/:venueId/promoter-location-settings.
 */
function PerVenuePromoterLocationSettings({ ns }: { ns: string }) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const [open, setOpen] = useState(false)
  const { data: venues, isLoading } = useOrgPromoterLocationSettings({ enabled: open })

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-input bg-card/50">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-left cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold">{t(`${ns}.perVenueTitle`)}</p>
            <p className="text-[10px] text-muted-foreground">{t(`${ns}.perVenueDesc`)}</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-input p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(venues ?? []).map(venue => (
              <VenueLocationRow key={venue.venueId} venue={venue} ns={ns} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function VenueLocationRow({ venue, ns }: { venue: VenuePromoterLocationSettings; ns: string }) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { toast } = useToast()
  const updateMutation = useUpdateVenuePromoterLocationSettings()

  const [trackPromoterLocation, setTrackPromoterLocation] = useState(venue.trackPromoterLocation)
  const [startHour, setStartHour] = useState(venue.promoterLocationStartHour ?? 11)
  const [endHour, setEndHour] = useState(venue.promoterLocationEndHour ?? 18)

  useEffect(() => {
    setTrackPromoterLocation(venue.trackPromoterLocation)
    setStartHour(venue.promoterLocationStartHour ?? 11)
    setEndHour(venue.promoterLocationEndHour ?? 18)
  }, [venue])

  const rowIs24h = startHour === 0 && endHour === 24

  const save = useCallback(
    (data: { trackPromoterLocation?: boolean; promoterLocationStartHour?: number; promoterLocationEndHour?: number }) => {
      updateMutation.mutate(
        { venueId: venue.venueId, data },
        {
          onSuccess: () => toast({ title: t(`${ns}.venueUpdated`) }),
          onError: () => toast({ title: t(`${ns}.error`), variant: 'destructive' }),
        },
      )
    },
    [updateMutation, venue.venueId, toast, t, ns],
  )

  const handleTrackChange = (checked: boolean) => {
    setTrackPromoterLocation(checked)
    save({ trackPromoterLocation: checked })
  }

  const handleStartChange = (value: string) => {
    const newStart = Number(value)
    setStartHour(newStart)
    if (newStart >= endHour) {
      toast({ title: t(`${ns}.invalidWindow`), variant: 'destructive' })
      return
    }
    save({ promoterLocationStartHour: newStart })
  }

  const handleEndChange = (value: string) => {
    const newEnd = Number(value)
    setEndHour(newEnd)
    if (startHour >= newEnd) {
      toast({ title: t(`${ns}.invalidWindow`), variant: 'destructive' })
      return
    }
    save({ promoterLocationEndHour: newEnd })
  }

  const handleToggle24h = (checked: boolean) => {
    const nextStart = checked ? 0 : 11
    const nextEnd = checked ? 24 : 18
    setStartHour(nextStart)
    setEndHour(nextEnd)
    save({ promoterLocationStartHour: nextStart, promoterLocationEndHour: nextEnd })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-input bg-background/50 p-2">
      <div className="flex items-center gap-2 min-w-0">
        <Switch checked={trackPromoterLocation} onCheckedChange={handleTrackChange} className="shrink-0" />
        <p className="text-xs font-medium truncate">{venue.name}</p>
      </div>
      <div className={cn('flex items-center gap-2', !trackPromoterLocation && 'opacity-40 pointer-events-none')}>
        <Select value={String(startHour)} onValueChange={handleStartChange} disabled={rowIs24h || !trackPromoterLocation}>
          <SelectTrigger className="w-20 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {START_HOUR_OPTIONS.map(h => (
              <SelectItem key={h} value={String(h)} className="text-xs">
                {formatHourLabel(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(endHour)} onValueChange={handleEndChange} disabled={rowIs24h || !trackPromoterLocation}>
          <SelectTrigger className="w-20 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {END_HOUR_OPTIONS.map(h => (
              <SelectItem key={h} value={String(h)} className="text-xs">
                {formatHourLabel(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Switch checked={rowIs24h} onCheckedChange={handleToggle24h} disabled={!trackPromoterLocation} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t(`${ns}.locationWindow24h`)}</span>
        </div>
      </div>
    </div>
  )
}
