/**
 * OrgTpvConfigSection - Organization-level TPV module & attendance defaults
 *
 * Shows org-level config: 6 module toggles + attendance parameters.
 * Gated behind attendance:org-manage permission (OWNER-only by default).
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Building2, Loader2, RotateCcw, Save, Clock, Banknote, CreditCard, ScanBarcode, Store, Camera } from 'lucide-react'
import { useOrgAttendanceConfig, useUpsertOrgAttendanceConfig, useDeleteOrgAttendanceConfig } from '@/hooks/useStoresAnalysis'
import { useAccess } from '@/hooks/use-access'
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
  const { can } = useAccess()
  const { toast } = useToast()

  const { data: config, isLoading } = useOrgAttendanceConfig({ enabled: can('attendance:org-manage') })
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
  })

  // Attendance config state
  const [expectedCheckInTime, setExpectedCheckInTime] = useState('09:00')
  const [latenessThreshold, setLatenessThreshold] = useState('30')
  const [geofenceRadius, setGeofenceRadius] = useState('500')

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
      })
      setExpectedCheckInTime(config.expectedCheckInTime)
      setLatenessThreshold(String(config.latenessThresholdMinutes))
      setGeofenceRadius(String(config.geofenceRadiusMeters))
    }
  }, [config])

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
    try {
      await upsertMutation.mutateAsync({
        ...modules,
        expectedCheckInTime,
        latenessThresholdMinutes: Number(latenessThreshold) || 30,
        geofenceRadiusMeters: Number(geofenceRadius) || 500,
      })
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.saveSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.error'), variant: 'destructive' })
    }
  }, [upsertMutation, modules, expectedCheckInTime, latenessThreshold, geofenceRadius, toast, t])

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
      })
      setExpectedCheckInTime('09:00')
      setLatenessThreshold('30')
      setGeofenceRadius('500')
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.resetSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgTpvConfig.error'), variant: 'destructive' })
    }
  }, [deleteMutation, toast, t])

  if (!can('attendance:org-manage')) return null

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
