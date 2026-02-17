/**
 * TpvConfiguration - Unified Configuration Page
 *
 * Pill tabs:
 * - General: Summary dashboard (modules, categories, goals, messages quick view)
 * - Metas: OrgGoalConfigSection + VenueGoals table
 * - TPV: Module toggles + Terminal management + Phone preview
 * - Categorias: CategoryEditor
 * - Mensajes: MessagesSection
 *
 * Access: ADMIN+ only
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, RotateCcw, Save, Loader2, Store, Plus, Pencil, Target, Package, Megaphone, Monitor, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/components/ui/glass-card'
import { useAuth } from '@/context/AuthContext'
import { useAccess } from '@/hooks/use-access'
import { tpvSettingsService, type VenueTpvSettings } from '@/services/tpv-settings.service'
import { getItemCategories } from '@/services/stockDashboard.service'
import { getTpvMessages } from '@/services/tpv-messages.service'
import { useToast } from '@/hooks/use-toast'
import { useStoresStorePerformance } from '@/hooks/useStoresAnalysis'
import {
  ModuleToggles,
  CategoryEditor,
  PhonePreview,
  TerminalManagement,
  MessagesSection,
  type ModuleToggleState,
} from './components'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import OrgGoalConfigSection from '@/pages/playtelecom/Supervisor/OrgGoalConfigSection'
import OrgCategoryConfigSection from './components/OrgCategoryConfigSection'
import CreateStoreGoalDialog from '@/pages/playtelecom/Supervisor/CreateStoreGoalDialog'

// Default module state (matches backend defaults)
const DEFAULT_MODULES: ModuleToggleState = {
  attendanceTracking: false,
  requireFacadePhoto: false,
  requireDepositPhoto: false,
  enableCashPayments: true,
  enableCardPayments: true,
  enableBarcodeScanner: true,
}

const VALID_TABS = ['general', 'metas', 'tpv', 'categorias', 'mensajes'] as const
type TabValue = typeof VALID_TABS[number]

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
  const { can } = useAccess()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const canManageGoals = can('goals:org-manage')

  // --- Venue goals state ---
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [selectedStoreForGoal, setSelectedStoreForGoal] = useState<string | null>(null)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editGoalAmount, setEditGoalAmount] = useState<number | undefined>()
  const [editGoalType, setEditGoalType] = useState<'AMOUNT' | 'QUANTITY' | undefined>()
  const [editGoalPeriod, setEditGoalPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined>()

  const { data: storePerformanceData } = useStoresStorePerformance({})

  const venueGoals = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.map(s => ({
      id: s.id,
      name: s.name,
      hasGoal: s.goalAmount != null,
      goalAmount: s.goalAmount ?? 0,
      goalType: (s.goalType || 'AMOUNT') as 'AMOUNT' | 'QUANTITY',
      goalPeriod: s.goalPeriod as 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined,
      goalId: s.goalId,
      goalSource: s.goalSource as 'organization' | 'venue' | undefined,
    }))
  }, [storePerformanceData])

  const goalStoreOptions = useMemo(() => {
    if (!storePerformanceData?.stores?.length) return []
    return storePerformanceData.stores.map(s => ({ id: s.id, name: s.name }))
  }, [storePerformanceData])

  const handleOpenGoalDialog = useCallback(
    (storeId?: string, goalId?: string | null, goalAmount?: number, goalType?: 'AMOUNT' | 'QUANTITY', goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
      setSelectedStoreForGoal(storeId || null)
      setEditGoalId(goalId || null)
      setEditGoalAmount(goalAmount)
      setEditGoalType(goalType)
      setEditGoalPeriod(goalPeriod)
      setGoalDialogOpen(true)
    },
    [],
  )

  const formatGoalDisplay = useCallback((amount: number, type: 'AMOUNT' | 'QUANTITY') => {
    if (type === 'QUANTITY') return `${amount.toLocaleString()} ventas`
    return `$${amount.toLocaleString()}`
  }, [])

  const periodLabel = useCallback((period?: string) => {
    if (!period) return ''
    return t(`playtelecom:supervisor.goalDialog.periods.${period}`, { defaultValue: period })
  }, [t])

  // --- Tab state with hash sync ---
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    if (VALID_TABS.includes(hash as TabValue)) return hash as TabValue
    return 'general'
  }

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) {
      setActiveTab(tabFromHash)
    }
  }, [location.hash])

  const handleTabChange = (value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  // --- TPV settings (hooks must be unconditional) ---
  const { data: tpvSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['venue', venueId, 'tpv-settings'],
    queryFn: () => tpvSettingsService.getVenueSettings(venueId!),
    enabled: !!venueId,
    staleTime: 60000,
  })

  const [modules, setModules] = useState<ModuleToggleState>(DEFAULT_MODULES)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (tpvSettings && !hasChanges) {
      setModules(settingsToState(tpvSettings))
    }
  }, [tpvSettings, hasChanges])

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

  // --- Summary data for General tab ---
  const { data: categoriesData } = useQuery({
    queryKey: ['venue', venueId, 'item-categories'],
    queryFn: () => getItemCategories(venueId!, { includeStats: true }),
    enabled: !!venueId,
    staleTime: 60000,
  })

  const { data: messagesData } = useQuery({
    queryKey: ['tpv-messages', venueId, 'all', 'all'],
    queryFn: () => getTpvMessages(venueId!, { limit: 100 }),
    enabled: !!venueId,
    staleTime: 60000,
  })

  // Summary computed values
  const summaryStats = useMemo(() => {
    const activeModules = modules ? Object.values(modules).filter(Boolean).length : 0
    const totalModules = modules ? Object.keys(modules).length : 0
    const totalCategories = categoriesData?.categories?.length ?? 0
    const activeCategories = categoriesData?.categories?.filter((c: any) => c.isActive !== false)?.length ?? totalCategories
    const totalMessages = messagesData?.messages?.length ?? messagesData?.length ?? 0
    const totalStores = venueGoals.length
    const storesWithGoals = venueGoals.filter(v => v.hasGoal).length

    return { activeModules, totalModules, totalCategories, activeCategories, totalMessages, totalStores, storesWithGoals }
  }, [modules, categoriesData, messagesData, venueGoals])

  // Pill tab class (same pattern as CommissionsPage)
  const pillClass = "group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageTitleWithInfo
        title={t('playtelecom:tpvConfig.pageTitle', { defaultValue: 'Configuracion' })}
        className="text-xl font-bold tracking-tight"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
            <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t('playtelecom:tpvConfig.pageTitle', { defaultValue: 'Configuracion' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('playtelecom:tpvConfig.pageSubtitle', { defaultValue: 'Administra metas, comisiones, terminal y catalogo' })}
            </p>
          </div>
        </div>
        {/* Save/Restore only on TPV tab */}
        {activeTab === 'tpv' && (
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
        )}
      </div>

      {/* Pill Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger value="general" className={pillClass}>
            <span>{t('playtelecom:tpvConfig.tabs.general', { defaultValue: 'General' })}</span>
          </TabsTrigger>
          <TabsTrigger value="metas" className={pillClass}>
            <span>{t('playtelecom:tpvConfig.tabs.metas', { defaultValue: 'Metas' })}</span>
          </TabsTrigger>
          <TabsTrigger value="tpv" className={pillClass}>
            <span>{t('playtelecom:tpvConfig.tabs.tpv', { defaultValue: 'TPV' })}</span>
          </TabsTrigger>
          <TabsTrigger value="categorias" className={pillClass}>
            <span>{t('playtelecom:tpvConfig.tabs.categorias', { defaultValue: 'Categorias' })}</span>
          </TabsTrigger>
          <TabsTrigger value="mensajes" className={pillClass}>
            <span>{t('playtelecom:tpvConfig.tabs.mensajes', { defaultValue: 'Mensajes' })}</span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab — Summary Dashboard */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TPV Modules Card */}
            <GlassCard
              className="p-5 cursor-pointer transition-all hover:border-primary/30"
              onClick={() => handleTabChange('tpv')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold">
                    {t('playtelecom:tpvConfig.summary.modules', { defaultValue: 'Modulos TPV' })}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              {settingsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{summaryStats.activeModules}</span>
                    <span className="text-sm text-muted-foreground">
                      {t('playtelecom:tpvConfig.summary.modulesOf', { total: summaryStats.totalModules, defaultValue: `de ${summaryStats.totalModules}` })}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${summaryStats.totalModules > 0 ? (summaryStats.activeModules / summaryStats.totalModules) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Goals Card */}
            <GlassCard
              className="p-5 cursor-pointer transition-all hover:border-primary/30"
              onClick={() => handleTabChange('metas')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                    <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-sm font-semibold">
                    {t('playtelecom:tpvConfig.summary.goals', { defaultValue: 'Metas' })}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{summaryStats.storesWithGoals}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('playtelecom:tpvConfig.summary.goalsTotal', { total: summaryStats.totalStores, defaultValue: `de ${summaryStats.totalStores} tiendas` })}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${summaryStats.totalStores > 0 ? (summaryStats.storesWithGoals / summaryStats.totalStores) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Categories Card */}
            <GlassCard
              className="p-5 cursor-pointer transition-all hover:border-primary/30"
              onClick={() => handleTabChange('categorias')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                    <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-sm font-semibold">
                    {t('playtelecom:tpvConfig.summary.categories', { defaultValue: 'Categorias' })}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{summaryStats.activeCategories}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('playtelecom:tpvConfig.summary.categoriesTotal', { total: summaryStats.totalCategories, defaultValue: `${summaryStats.totalCategories} total` })}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${summaryStats.totalCategories > 0 ? (summaryStats.activeCategories / summaryStats.totalCategories) * 100 : 100}%` }}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Messages Card */}
            <GlassCard
              className="p-5 cursor-pointer transition-all hover:border-primary/30"
              onClick={() => handleTabChange('mensajes')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                    <Megaphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold">
                    {t('playtelecom:tpvConfig.summary.messages', { defaultValue: 'Mensajes' })}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{summaryStats.totalMessages}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('playtelecom:tpvConfig.summary.messagesCount', { count: summaryStats.totalMessages, defaultValue: `${summaryStats.totalMessages} enviados` })}
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-6">
          {/* Org-Level Goals */}
          <OrgGoalConfigSection />

          {/* Per-Venue Goals */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-muted-foreground uppercase">
                  {t('playtelecom:tpvConfig.venueGoals.title', { defaultValue: 'Metas por Tienda' })}
                </h4>
              </div>
              {canManageGoals && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 hover:bg-primary/10" onClick={() => handleOpenGoalDialog()}>
                  <Plus className="w-3 h-3 mr-1" />
                  {t('playtelecom:supervisor.goalDialog.createGoal', { defaultValue: 'Crear Meta' })}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t('playtelecom:tpvConfig.venueGoals.description', { defaultValue: 'Metas personalizadas por tienda. Las tiendas sin meta propia heredan la meta de organizacion.' })}
            </p>

            {venueGoals.length > 0 ? (
              <div className="space-y-2">
                {venueGoals.map(venue => (
                  <div key={venue.id} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 border border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium min-w-[120px]">{venue.name}</span>
                      {venue.hasGoal ? (
                        <>
                          <Badge variant="outline" className={`text-[10px] ${venue.goalSource === 'venue' ? 'border-green-500/30 text-green-500' : 'border-primary/30 text-primary'}`}>
                            {venue.goalSource === 'venue'
                              ? t('playtelecom:supervisor.orgGoals.custom', { defaultValue: 'Personalizada' })
                              : t('playtelecom:supervisor.orgGoals.inherited', { defaultValue: 'Heredada' })}
                          </Badge>
                          <span className="text-sm font-bold">{formatGoalDisplay(venue.goalAmount, venue.goalType)}</span>
                          <span className="text-xs text-muted-foreground">{periodLabel(venue.goalPeriod)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('playtelecom:supervisor.noGoal', { defaultValue: 'Sin meta' })}
                        </span>
                      )}
                    </div>
                    {canManageGoals && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          venue.hasGoal && venue.goalSource === 'venue'
                            ? handleOpenGoalDialog(venue.id, venue.goalId, venue.goalAmount, venue.goalType, venue.goalPeriod)
                            : handleOpenGoalDialog(venue.id)
                        }
                      >
                        {venue.hasGoal && venue.goalSource === 'venue' ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('playtelecom:tpvConfig.venueGoals.empty', { defaultValue: 'No hay tiendas registradas' })}</p>
              </div>
            )}
          </GlassCard>

          {/* Goal Dialog */}
          <CreateStoreGoalDialog
            open={goalDialogOpen}
            onOpenChange={setGoalDialogOpen}
            stores={goalStoreOptions}
            selectedStoreId={selectedStoreForGoal}
            editGoalId={editGoalId}
            editGoalAmount={editGoalAmount}
            editGoalType={editGoalType}
            editGoalPeriod={editGoalPeriod}
          />
        </TabsContent>

        {/* TPV Tab */}
        <TabsContent value="tpv" className="space-y-6">
          {settingsLoading ? (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 xl:col-span-8 space-y-6">
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
              </div>
              <div className="col-span-12 xl:col-span-4 hidden xl:flex justify-center">
                <Skeleton className="h-[500px] w-[280px] rounded-3xl" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 xl:col-span-8 space-y-6">
                <ModuleToggles values={modules} onChange={handleModuleChange} />
                <TerminalManagement />
              </div>
              <div className="col-span-12 xl:col-span-4 hidden xl:flex">
                <PhonePreview modules={modules} className="sticky top-6" />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Categorias Tab */}
        <TabsContent value="categorias" className="space-y-6">
          <OrgCategoryConfigSection />
          <CategoryEditor />
        </TabsContent>

        {/* Mensajes Tab */}
        <TabsContent value="mensajes" className="space-y-6">
          <MessagesSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TpvConfiguration
