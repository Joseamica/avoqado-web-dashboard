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
import { useAuth } from '@/context/AuthContext'
import { tpvSettingsService, type VenueTpvSettings } from '@/services/tpv-settings.service'
import { useToast } from '@/hooks/use-toast'
import {
  ModuleToggles,
  CategoryEditor,
  EvidenceRules,
  PhonePreview,
  TerminalManagement,
  type ModuleToggleState,
  type EvidenceRulesState,
} from './components'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'

// Default module state (matches backend defaults)
const DEFAULT_MODULES: ModuleToggleState = {
  attendanceTracking: false,
  requireFacadePhoto: false,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
}

// Default evidence rules (matches backend defaults)
const DEFAULT_EVIDENCE: EvidenceRulesState = {
  requireDepositPhoto: false,
}

/** Map API response to component state */
function settingsToState(settings: VenueTpvSettings): {
  modules: ModuleToggleState
  evidence: EvidenceRulesState
} {
  return {
    modules: {
      attendanceTracking: settings.attendanceTracking,
      requireFacadePhoto: settings.requireFacadePhoto,
      enableCashPayments: settings.enableCashPayments,
      enableCardPayments: settings.enableCardPayments,
      enableBarcodeScanner: settings.enableBarcodeScanner,
    },
    evidence: {
      requireDepositPhoto: settings.requireDepositPhoto,
    },
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
  const [evidence, setEvidence] = useState<EvidenceRulesState>(DEFAULT_EVIDENCE)
  const [hasChanges, setHasChanges] = useState(false)

  // Hydrate state from API when settings are fetched
  useEffect(() => {
    if (tpvSettings && !hasChanges) {
      const { modules: m, evidence: e } = settingsToState(tpvSettings)
      setModules(m)
      setEvidence(e)
    }
  }, [tpvSettings, hasChanges])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue ID')
      await tpvSettingsService.updateVenueSettings(venueId, {
        ...modules,
        ...evidence,
      })
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

  const handleEvidenceChange = useCallback((key: keyof EvidenceRulesState, value: boolean) => {
    setEvidence(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  const handleResetDefaults = useCallback(() => {
    setModules(DEFAULT_MODULES)
    setEvidence(DEFAULT_EVIDENCE)
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Main layout: config (left) + preview (right) */
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Config sections */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            <ModuleToggles values={modules} onChange={handleModuleChange} />
            <CategoryEditor />
            <EvidenceRules values={evidence} onChange={handleEvidenceChange} />
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
