/**
 * TpvConfiguration - TPV Terminal Personalization
 *
 * Layout: 8/4 grid
 * - Left: Module toggles, Catalog editor, Evidence rules
 * - Right: Phone preview (live)
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Settings, RotateCcw, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getItemCategories, type ItemCategory } from '@/services/stockDashboard.service'
import {
  ModuleToggles,
  CatalogEditor,
  EvidenceRules,
  PhonePreview,
  type ModuleToggleState,
  type EvidenceRulesState,
  type CatalogItem,
} from './components'

// Default module state
const DEFAULT_MODULES: ModuleToggleState = {
  attendanceTracking: true,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
}

// Default evidence rules
const DEFAULT_EVIDENCE: EvidenceRulesState = {
  clockInPhotoRule: 'OBLIGATORIO',
  depositPhotoRule: 'OBLIGATORIO_ALTA_CALIDAD',
  facadePhotoRule: 'NUNCA',
}

export function TpvConfiguration() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()

  // Fetch categories from API
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['venue', venueId, 'item-categories'],
    queryFn: () => getItemCategories(venueId!, { includeStats: true }),
    enabled: !!venueId,
    staleTime: 60000,
  })

  // Map API categories to CatalogItem format
  const apiCategories: CatalogItem[] = useMemo(() => {
    if (!categoriesData?.categories) return []
    return categoriesData.categories.map((c: ItemCategory) => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      price: c.suggestedPrice ?? 0,
      color: c.color || '#3b82f6',
      isActive: c.active,
      sortOrder: c.sortOrder,
    }))
  }, [categoriesData])

  // State
  const [modules, setModules] = useState<ModuleToggleState>(DEFAULT_MODULES)
  const [evidence, setEvidence] = useState<EvidenceRulesState>(DEFAULT_EVIDENCE)
  const [categories, setCategories] = useState<CatalogItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Sync API categories into local state when loaded
  useEffect(() => {
    if (apiCategories.length > 0 && !hasChanges) {
      setCategories(apiCategories)
    }
  }, [apiCategories, hasChanges])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save config — currently the backend TpvSettings is stored as JSON on Terminal.config
      // For now just log; the real save would call updateTerminalConfig
      console.log('Saving config:', { modules, evidence, categories })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'item-categories'] })
      setHasChanges(false)
    },
  })

  // Handlers
  const handleModuleChange = useCallback((key: keyof ModuleToggleState, value: boolean) => {
    setModules(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  const handleEvidenceChange = useCallback((key: keyof EvidenceRulesState, value: string) => {
    setEvidence(prev => ({ ...prev, [key]: value as EvidenceRulesState[typeof key] }))
    setHasChanges(true)
  }, [])

  const handleAddCategory = useCallback(() => {
    // TODO: Open add category dialog
    console.log('Add category')
  }, [])

  const handleRemoveCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
    setHasChanges(true)
  }, [])

  const handleReorderCategories = useCallback((reordered: Array<{ id: string; sortOrder: number }>) => {
    setCategories(prev =>
      prev.map(c => {
        const match = reordered.find(r => r.id === c.id)
        return match ? { ...c, sortOrder: match.sortOrder } : c
      })
    )
    setHasChanges(true)
  }, [])

  const handleResetDefaults = useCallback(() => {
    setModules(DEFAULT_MODULES)
    setEvidence(DEFAULT_EVIDENCE)
    setCategories(apiCategories.length > 0 ? apiCategories : [])
    setHasChanges(false)
  }, [apiCategories])

  const handleSave = useCallback(() => {
    saveMutation.mutate()
  }, [saveMutation])

  // Memoize categories for preview
  const memoizedCategories = useMemo(() => categories, [categories])

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button variant="outline" size="sm" onClick={handleResetDefaults} disabled={!hasChanges}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            {t('playtelecom:tpvConfig.resetDefaults', { defaultValue: 'Restaurar Defaults' })}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Save className="w-3.5 h-3.5 mr-1" />
            {t('playtelecom:tpvConfig.saveSync', { defaultValue: 'Guardar y Sincronizar' })}
          </Button>
        </div>
      </div>

      {/* Main layout: config (left) + preview (right) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Config sections */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <ModuleToggles values={modules} onChange={handleModuleChange} />
          <CatalogEditor
            categories={memoizedCategories}
            onAdd={handleAddCategory}
            onRemove={handleRemoveCategory}
            onReorder={handleReorderCategories}
          />
          <EvidenceRules values={evidence} onChange={handleEvidenceChange} />
        </div>

        {/* Right: Phone preview */}
        <div className="col-span-12 xl:col-span-4 hidden xl:flex">
          <PhonePreview
            modules={modules}
            categories={memoizedCategories}
            className="sticky top-6"
          />
        </div>
      </div>
    </div>
  )
}

export default TpvConfiguration
