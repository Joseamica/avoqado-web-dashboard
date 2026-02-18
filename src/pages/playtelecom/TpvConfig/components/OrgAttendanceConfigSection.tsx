/**
 * OrgAttendanceConfigSection - Organization-level attendance defaults
 *
 * Shows org-level attendance config (check-in time, lateness threshold, geofence radius).
 * Gated behind attendance:org-manage permission (OWNER-only by default).
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Loader2, RotateCcw, Save } from 'lucide-react'
import { useOrgAttendanceConfig, useUpsertOrgAttendanceConfig, useDeleteOrgAttendanceConfig } from '@/hooks/useStoresAnalysis'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
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

export default function OrgAttendanceConfigSection() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { can } = useAccess()
  const { toast } = useToast()

  const { data: config, isLoading } = useOrgAttendanceConfig({ enabled: can('attendance:org-manage') })
  const upsertMutation = useUpsertOrgAttendanceConfig()
  const deleteMutation = useDeleteOrgAttendanceConfig()

  const [expectedCheckInTime, setExpectedCheckInTime] = useState('09:00')
  const [latenessThreshold, setLatenessThreshold] = useState('30')
  const [geofenceRadius, setGeofenceRadius] = useState('500')

  // Sync form with fetched config
  useEffect(() => {
    if (config) {
      setExpectedCheckInTime(config.expectedCheckInTime)
      setLatenessThreshold(String(config.latenessThresholdMinutes))
      setGeofenceRadius(String(config.geofenceRadiusMeters))
    }
  }, [config])

  const handleSave = useCallback(async () => {
    try {
      await upsertMutation.mutateAsync({
        expectedCheckInTime,
        latenessThresholdMinutes: Number(latenessThreshold) || 30,
        geofenceRadiusMeters: Number(geofenceRadius) || 500,
      })
      toast({ title: t('playtelecom:tpvConfig.orgAttendance.saveSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgAttendance.error'), variant: 'destructive' })
    }
  }, [upsertMutation, expectedCheckInTime, latenessThreshold, geofenceRadius, toast, t])

  const handleReset = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync()
      setExpectedCheckInTime('09:00')
      setLatenessThreshold('30')
      setGeofenceRadius('500')
      toast({ title: t('playtelecom:tpvConfig.orgAttendance.resetSuccess') })
    } catch {
      toast({ title: t('playtelecom:tpvConfig.orgAttendance.error'), variant: 'destructive' })
    }
  }, [deleteMutation, toast, t])

  if (!can('attendance:org-manage')) return null

  const isMutating = upsertMutation.isPending || deleteMutation.isPending

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-muted-foreground uppercase">
            {t('playtelecom:tpvConfig.orgAttendance.title')}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground" disabled={isMutating}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {t('playtelecom:tpvConfig.orgAttendance.reset')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('playtelecom:tpvConfig.orgAttendance.reset')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('playtelecom:tpvConfig.orgAttendance.resetConfirm')}
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
            {t('playtelecom:tpvConfig.orgAttendance.save')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t('playtelecom:tpvConfig.orgAttendance.description')}</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Expected Check-in Time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('playtelecom:tpvConfig.orgAttendance.expectedCheckInTime')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('playtelecom:tpvConfig.orgAttendance.expectedCheckInTimeDesc')}</p>
            <Input
              type="time"
              value={expectedCheckInTime}
              onChange={e => setExpectedCheckInTime(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>

          {/* Lateness Threshold */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('playtelecom:tpvConfig.orgAttendance.latenessThreshold')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('playtelecom:tpvConfig.orgAttendance.latenessThresholdDesc')}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="120"
                value={latenessThreshold}
                onChange={e => setLatenessThreshold(e.target.value)}
                className="w-24 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">{t('playtelecom:tpvConfig.orgAttendance.minutes')}</span>
            </div>
          </div>

          {/* Geofence Radius */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('playtelecom:tpvConfig.orgAttendance.geofenceRadius')}</Label>
            <p className="text-[10px] text-muted-foreground">{t('playtelecom:tpvConfig.orgAttendance.geofenceRadiusDesc')}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="50"
                max="5000"
                value={geofenceRadius}
                onChange={e => setGeofenceRadius(e.target.value)}
                className="w-28 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">{t('playtelecom:tpvConfig.orgAttendance.meters')}</span>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !config && (
        <p className="text-xs text-muted-foreground mt-3 italic">{t('playtelecom:tpvConfig.orgAttendance.noConfig')}</p>
      )}
    </GlassCard>
  )
}
