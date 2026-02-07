/**
 * TpvConfiguration - TPV Terminal Personalization
 *
 * Layout: 8/4 grid
 * - Left: Module toggles, Category editor, Evidence rules, Terminal management
 * - Right: Phone preview (live)
 *
 * Access: ADMIN+ only
 */

import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Settings, RotateCcw, Save, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/ui/glass-card'
import { useAuth } from '@/context/AuthContext'
import { tpvSettingsService, type VenueTpvSettings } from '@/services/tpv-settings.service'
import { useToast } from '@/hooks/use-toast'
import {
  ModuleToggles,
  CategoryEditor,
  PhonePreview,
  TerminalManagement,
  type ModuleToggleState,
} from './components'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'

// Default module state (matches backend defaults)
const DEFAULT_MODULES: ModuleToggleState = {
  attendanceTracking: false,
  requireFacadePhoto: false,
  requireDepositPhoto: false,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
}

/** Map API response to component state */
function settingsToState(settings: VenueTpvSettings): ModuleToggleState {
  return {
    attendanceTracking: settings.attendanceTracking,
    requireFacadePhoto: settings.requireFacadePhoto,
    requireDepositPhoto: settings.requireDepositPhoto,
    enableCashPayments: settings.enableCashPayments,
    enableCardPayments: settings.enableCardPayments,
    enableBarcodeScanner: settings.enableBarcodeScanner,
  }
}

export function TpvConfiguration() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch venue-level TPV settings
  const { data: tpvSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['venue', venueId, 'tpv-settings'],
    queryFn: () => tpvSettingsService.getVenueSettings(venueId!),
    enabled: !!venueId,
    staleTime: 60000,
  })

  // State
  const [modules, setModules] = useState<ModuleToggleState>(DEFAULT_MODULES)
  const [hasChanges, setHasChanges] = useState(false)

  // Hydrate state from API when settings are fetched
  useEffect(() => {
    if (tpvSettings && !hasChanges) {
      setModules(settingsToState(tpvSettings))
    }
  }, [tpvSettings, hasChanges])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue ID')
      await tpvSettingsService.updateVenueSettings(venueId, modules)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'tpv-settings'] })
      setHasChanges(false)
      toast({
        title: t('playtelecom:tpvConfig.saveSuccess', { defaultValue: 'Configuracion guardada' }),
        description: t('playtelecom:tpvConfig.saveSuccessDesc', { defaultValue: 'Los cambios se sincronizaran con todas las terminales.' }),
      })
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message || t('playtelecom:tpvConfig.saveError', { defaultValue: 'Error al guardar la configuracion' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Handlers
  const handleModuleChange = useCallback((key: keyof ModuleToggleState, value: boolean) => {
    setModules(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  const handleResetDefaults = useCallback(() => {
    setModules(DEFAULT_MODULES)
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(() => {
    saveMutation.mutate()
  }, [saveMutation])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageTitleWithInfo
        title={t('playtelecom:tpvConfig.title', { defaultValue: 'Personalizacion de Terminal (TPV)' })}
        className="text-xl font-bold tracking-tight"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
            <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t('playtelecom:tpvConfig.title', { defaultValue: 'Personalizacion de Terminal (TPV)' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('playtelecom:tpvConfig.subtitle', { defaultValue: 'Define las reglas, modulos y productos visibles en la App Movil' })}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleResetDefaults} disabled={!hasChanges || saveMutation.isPending}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            {t('playtelecom:tpvConfig.resetDefaults', { defaultValue: 'Restaurar Defaults' })}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {t('playtelecom:tpvConfig.saveSync', { defaultValue: 'Guardar y Sincronizar' })}
          </Button>
        </div>
      </div>

      {settingsLoading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-8 space-y-6">
            {/* ModuleToggles skeleton */}
            <GlassCard className="p-6">
              <Skeleton className="h-5 w-48 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </div>
                ))}
              </div>
            </GlassCard>
            {/* CategoryEditor skeleton */}
            <GlassCard className="p-6">
              <Skeleton className="h-5 w-52 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2">
                    <Skeleton className="h-1.5 w-full rounded" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="col-span-12 xl:col-span-4 hidden xl:flex justify-center">
            <Skeleton className="h-[500px] w-[280px] rounded-3xl" />
          </div>
        </div>
      ) : (
        /* Main layout: config (left) + preview (right) */
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Config sections */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            <ModuleToggles values={modules} onChange={handleModuleChange} />
            <CategoryEditor />
            <TerminalManagement />
          </div>

          {/* Right: Phone preview */}
          <div className="col-span-12 xl:col-span-4 hidden xl:flex">
            <PhonePreview modules={modules} className="sticky top-6" />
          </div>
        </div>
      )}
    </div>
  )
}

export default TpvConfiguration
