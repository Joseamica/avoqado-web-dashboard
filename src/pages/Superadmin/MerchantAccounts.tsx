import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Building2, CheckCircle2, CreditCard, Loader2, Plus, Search, Shield, Zap } from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import {
  GlassCard,
  ManualAccountDialog,
  DeleteConfirmDialog,
  BlumonAutoFetchWizard,
  TerminalAssignmentsDialog,
  CostStructureDialog,
  MerchantAccountCard,
  AssignAccountToVenueDialog,
} from './components/merchant-accounts'

const MerchantAccounts: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Dialog states
  const [blumonWizardOpen, setBlumonWizardOpen] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalsDialogOpen, setTerminalsDialogOpen] = useState(false)
  const [costDialogOpen, setCostDialogOpen] = useState(false)
  const [assignToVenueDialogOpen, setAssignToVenueDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<MerchantAccount | null>(null)

  // Fetch all venues for the filter dropdown (includeDemos=true to get ALL venues)
  const { data: venues = [] } = useQuery({
    queryKey: ['superadmin-venues', 'all'],
    queryFn: () => getAllVenues(true), // Include TRIAL and LIVE_DEMO venues
  })

  // Sort venues: ACTIVE first, then others
  const sortedVenues = useMemo(() => {
    const active = venues.filter(v => v.status === 'ACTIVE')
    const others = venues.filter(v => v.status !== 'ACTIVE')
    return [...active, ...others]
  }, [venues])

  // Fetch ALL merchant accounts
  const {
    data: allAccounts = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  // Fetch venue configs to know which accounts are associated with which venues
  const { data: allVenueConfigs = [] } = useQuery({
    queryKey: ['all-venue-configs'],
    queryFn: async () => {
      // Get all venue payment configs for filtering
      const configs = await Promise.all(venues.map(venue => paymentProviderAPI.getVenuePaymentConfig(venue.id).catch(() => null)))
      return configs.filter(Boolean)
    },
    enabled: venues.length > 0 && selectedVenueId !== 'all',
  })

  // Filter accounts based on search, venue, and status
  const filteredAccounts = useMemo(() => {
    let result = [...allAccounts]

    // Search filter
    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase()
      result = result.filter(
        account =>
          account.displayName?.toLowerCase().includes(search) ||
          account.alias?.toLowerCase().includes(search) ||
          account.externalMerchantId.toLowerCase().includes(search) ||
          account.blumonSerialNumber?.toLowerCase().includes(search),
      )
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(a => a.active)
    } else if (statusFilter === 'inactive') {
      result = result.filter(a => !a.active)
    } else if (statusFilter === 'no-costs') {
      result = result.filter(a => !a._count?.costStructures)
    }

    // Venue filter - this is an approximate filter since we need venue configs
    if (selectedVenueId !== 'all') {
      const venueConfig = allVenueConfigs.find((c: any) => c?.venueId === selectedVenueId)
      if (venueConfig) {
        const linkedAccountIds = [
          (venueConfig as any).primaryAccountId,
          (venueConfig as any).secondaryAccountId,
          (venueConfig as any).tertiaryAccountId,
        ].filter(Boolean)
        result = result.filter(a => linkedAccountIds.includes(a.id))
      } else {
        // Venue has no payment config - no accounts are associated
        result = []
      }
    }

    return result
  }, [allAccounts, debouncedSearchTerm, statusFilter, selectedVenueId, allVenueConfigs])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Cuenta de comercio creada exitosamente' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la cuenta de comercio', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => paymentProviderAPI.updateMerchantAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Cuenta de comercio actualizada exitosamente' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la cuenta de comercio', variant: 'destructive' })
    },
  })

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: paymentProviderAPI.toggleMerchantAccountStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Estado de la cuenta actualizado' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Cuenta de comercio eliminada' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo eliminar la cuenta',
        variant: 'destructive',
      })
    },
  })

  // Delete cost structure
  const deleteCostStructureMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Estructura de costos eliminada' })
    },
  })

  // Delete venue config
  const deleteVenueConfigMutation = useMutation({
    mutationFn: ({ venueId }: { venueId: string; configId: string }) => paymentProviderAPI.deleteVenuePaymentConfig(venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      refetch()
      toast({ title: 'Éxito', description: 'Configuración de venue eliminada' })
    },
  })

  // Handlers
  const handleSave = async (data: any) => {
    if (selectedAccount) {
      await updateMutation.mutateAsync({ id: selectedAccount.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setManualDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedAccount(null)
    setManualDialogOpen(true)
  }

  const handleToggle = async (id: string) => {
    await toggleMutation.mutateAsync(id)
  }

  const handleDelete = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (selectedAccount) {
      await deleteMutation.mutateAsync(selectedAccount.id)
    }
  }

  const handleManageTerminals = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setTerminalsDialogOpen(true)
  }

  const handleManageCosts = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setCostDialogOpen(true)
  }

  // Calculate stats
  const activeCount = allAccounts.filter(a => a.active).length
  const inactiveCount = allAccounts.length - activeCount
  const withCostsCount = allAccounts.filter(a => a._count?.costStructures && a._count.costStructures > 0).length
  const withoutCostsCount = allAccounts.length - withCostsCount

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('merchantAccounts.title')}</h1>
          <p className="text-muted-foreground">{t('merchantAccounts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAdd} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t('merchantAccounts.create')}
          </Button>
          <Button
            onClick={() => setBlumonWizardOpen(true)}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Blumon Auto-Fetch
          </Button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allAccounts.length}</p>
              <p className="text-xs text-muted-foreground">Total de Cuentas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withCostsCount}</p>
              <p className="text-xs text-muted-foreground">Con Costos</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withoutCostsCount}</p>
              <p className="text-xs text-muted-foreground">Sin Costos</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('merchantAccounts.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
              <SelectItem value="no-costs">Sin costos</SelectItem>
            </SelectContent>
          </Select>

          {/* Venue Filter */}
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder={t('merchantAccounts.filterByVenue')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t('merchantAccounts.allVenues')}
                </div>
              </SelectItem>
              {sortedVenues.map((venue, idx) => {
                const isActive = venue.status === 'ACTIVE'
                const prevVenue = sortedVenues[idx - 1]
                const showSeparator = idx > 0 && !isActive && prevVenue?.status === 'ACTIVE'

                return (
                  <React.Fragment key={venue.id}>
                    {showSeparator && <div className="h-px bg-border my-1" />}
                    <SelectItem value={venue.id}>
                      <div className={cn('flex items-center gap-2', !isActive && 'text-muted-foreground')}>
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            venue.status === 'ACTIVE' && 'bg-green-500',
                            venue.status === 'ONBOARDING' && 'bg-yellow-500',
                            venue.status === 'TRIAL' && 'bg-orange-500',
                            venue.status === 'PENDING_ACTIVATION' && 'bg-blue-500',
                            !['ACTIVE', 'ONBOARDING', 'TRIAL', 'PENDING_ACTIVATION'].includes(venue.status || '') && 'bg-gray-400',
                          )}
                        />
                        <span className="truncate">{venue.name}</span>
                        {!isActive && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                            {venue.status}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  </React.Fragment>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Cargando cuentas...</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <CreditCard className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No se encontraron cuentas</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {searchTerm || statusFilter !== 'all' || selectedVenueId !== 'all'
              ? 'No hay cuentas que coincidan con los filtros seleccionados'
              : 'No hay cuentas de comercio registradas aún'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleAdd} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Crear Manual
            </Button>
            <Button
              onClick={() => setBlumonWizardOpen(true)}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Blumon Auto-Fetch
            </Button>
          </div>
        </GlassCard>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredAccounts.length} de {allAccounts.length} cuentas
            </p>
            <Badge variant="outline">{filteredAccounts.length} resultados</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAccounts.map(account => (
              <MerchantAccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onManageTerminals={handleManageTerminals}
                onManageCosts={handleManageCosts}
              />
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      <ManualAccountDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} account={selectedAccount} onSave={handleSave} />

      <BlumonAutoFetchWizard
        open={blumonWizardOpen}
        onOpenChange={setBlumonWizardOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
          refetch()
        }}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        account={selectedAccount}
        onConfirmDelete={handleConfirmDelete}
        onDeleteCostStructure={id => deleteCostStructureMutation.mutateAsync(id)}
        onDeleteVenueConfig={(venueId, configId) => deleteVenueConfigMutation.mutateAsync({ venueId, configId })}
      />

      <TerminalAssignmentsDialog
        open={terminalsDialogOpen}
        onOpenChange={setTerminalsDialogOpen}
        account={selectedAccount}
        venueId={selectedVenueId !== 'all' ? selectedVenueId : undefined}
      />

      <CostStructureDialog open={costDialogOpen} onOpenChange={setCostDialogOpen} account={selectedAccount} />
    </div>
  )
}

export default MerchantAccounts
