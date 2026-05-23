import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { cn, includesNormalized } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { FilterPill, FilterPillBar, CheckboxFilterContent } from '@/components/filters'
import DataTable from '@/components/data-table'
import {
  GlassCard,
  ManualAccountDialog,
  DeleteConfirmDialog,
  BlumonAutoFetchWizard,
  BatchAutoFetchDialog,
  TerminalAssignmentsDialog,
  CostStructureDialog,
  MerchantAccountCard,
  AssignAccountToVenueDialog,
} from './components/merchant-accounts'
import MerchantSetupPanel from './components/merchant-accounts/merchant-setup-panel/MerchantSetupPanel'

/** Bucket a raw merchant-account environment into PROD / SANDBOX (mirrors MerchantAccountCard). */
const envBucket = (raw?: string | null): 'PRODUCTION' | 'SANDBOX' | null => {
  if (!raw) return null
  return raw === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX'
}

const MerchantAccounts: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [environmentFilter, setEnvironmentFilter] = useState<string[]>([])
  const [costFilter, setCostFilter] = useState<string[]>([])
  const [credentialsFilter, setCredentialsFilter] = useState<string[]>([])
  const [terminalsFilter, setTerminalsFilter] = useState<string[]>([])
  const [venueFilter, setVenueFilter] = useState<string[]>([])

  // View mode — card grid (default) or table
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    const saved = localStorage.getItem('merchant-accounts:view')
    return saved === 'table' ? 'table' : 'cards'
  })
  const changeViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('merchant-accounts:view', mode)
  }

  // Dialog states
  const [blumonWizardOpen, setBlumonWizardOpen] = useState(false)
  const [batchAutoFetchOpen, setBatchAutoFetchOpen] = useState(false)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalsDialogOpen, setTerminalsDialogOpen] = useState(false)
  const [costDialogOpen, setCostDialogOpen] = useState(false)
  const [assignToVenueDialogOpen, setAssignToVenueDialogOpen] = useState(false)
  const [setupPanelOpen, setSetupPanelOpen] = useState(false)
  /** ID of the merchant whose setup panel is open in EDIT mode (Task 4.3).
   *  When set, the panel hydrates the merchant via useMerchantBundle and lets
   *  the operator update each card via per-card mutations (Task 4.2). */
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<MerchantAccount | null>(null)

  // Fetch ALL merchant accounts (superadmin endpoint returns enriched venues/terminals)
  const { data: allAccounts = [], isLoading } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  // Filter options derived from the accounts themselves — only show options that actually exist
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>()
    allAccounts.forEach(a => {
      if (a.provider?.id) map.set(a.provider.id, a.provider.name || a.provider.code || a.provider.id)
    })
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))
  }, [allAccounts])

  const venueOptions = useMemo(() => {
    const map = new Map<string, string>()
    allAccounts.forEach(a => (a.venues ?? []).forEach(v => map.set(v.id, v.name)))
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))
  }, [allAccounts])

  const hasEnvironments = useMemo(() => allAccounts.some(a => envBucket(a.blumonEnvironment)), [allAccounts])

  // Filter accounts based on search + all filters
  const filteredAccounts = useMemo(() => {
    let result = [...allAccounts]

    // Search filter — covers identity, provider, blumon, bank, AngelPay, venues and terminals
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm
      result = result.filter(
        account =>
          includesNormalized(account.displayName ?? '', q) ||
          includesNormalized(account.alias ?? '', q) ||
          includesNormalized(account.externalMerchantId ?? '', q) ||
          includesNormalized(account.blumonSerialNumber ?? '', q) ||
          includesNormalized(account.blumonMerchantId ?? '', q) ||
          includesNormalized(account.blumonPosId ?? '', q) ||
          includesNormalized(account.provider?.name ?? '', q) ||
          includesNormalized(account.provider?.code ?? '', q) ||
          includesNormalized(account.bankName ?? '', q) ||
          includesNormalized(account.accountHolder ?? '', q) ||
          includesNormalized(account.clabeNumber ?? '', q) ||
          includesNormalized(account.angelpayAffiliation ?? '', q) ||
          includesNormalized(account.angelpayMerchantName ?? '', q) ||
          (account.venues ?? []).some(v => includesNormalized(v.name, q) || includesNormalized(v.slug, q)) ||
          (account.terminals ?? []).some(tm => includesNormalized(tm.serialNumber, q)),
      )
    }

    // Provider filter
    if (providerFilter.length > 0) {
      result = result.filter(a => a.provider?.id && providerFilter.includes(a.provider.id))
    }

    // Status filter
    if (statusFilter.length > 0) {
      result = result.filter(a => statusFilter.includes(a.active ? 'active' : 'inactive'))
    }

    // Environment filter (Blumon PROD/SANDBOX)
    if (environmentFilter.length > 0) {
      result = result.filter(a => {
        const env = envBucket(a.blumonEnvironment)
        return env !== null && environmentFilter.includes(env)
      })
    }

    // Cost structures filter
    if (costFilter.length > 0) {
      result = result.filter(a => costFilter.includes((a._count?.costStructures ?? 0) > 0 ? 'with' : 'without'))
    }

    // Credentials filter
    if (credentialsFilter.length > 0) {
      result = result.filter(a => credentialsFilter.includes(a.hasCredentials ? 'with' : 'without'))
    }

    // Terminals filter
    if (terminalsFilter.length > 0) {
      result = result.filter(a => terminalsFilter.includes((a._count?.terminals ?? 0) > 0 ? 'with' : 'without'))
    }

    // Venue filter — uses enriched venues from the superadmin endpoint
    if (venueFilter.length > 0) {
      result = result.filter(a => (a.venues ?? []).some(v => venueFilter.includes(v.id)))
    }

    return result
  }, [
    allAccounts,
    debouncedSearchTerm,
    providerFilter,
    statusFilter,
    environmentFilter,
    costFilter,
    credentialsFilter,
    terminalsFilter,
    venueFilter,
  ])

  // Split accounts into active/inactive for rendering with divider
  const { activeAccounts, inactiveAccounts } = useMemo(() => {
    const active = filteredAccounts.filter(a => a.active)
    const inactive = filteredAccounts.filter(a => !a.active)
    return { activeAccounts: active, inactiveAccounts: inactive }
  }, [filteredAccounts])

  const hasActiveFilters =
    !!searchTerm ||
    providerFilter.length > 0 ||
    statusFilter.length > 0 ||
    environmentFilter.length > 0 ||
    costFilter.length > 0 ||
    credentialsFilter.length > 0 ||
    terminalsFilter.length > 0 ||
    venueFilter.length > 0

  const resetFilters = () => {
    setSearchTerm('')
    setProviderFilter([])
    setStatusFilter([])
    setEnvironmentFilter([])
    setCostFilter([])
    setCredentialsFilter([])
    setTerminalsFilter([])
    setVenueFilter([])
  }

  // The venueId forwarded to dialogs only makes sense when exactly one venue is selected
  const singleSelectedVenueId = venueFilter.length === 1 ? venueFilter[0] : undefined

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
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
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Éxito', description: 'Estructura de costos eliminada' })
    },
  })

  // Delete venue config
  const deleteVenueConfigMutation = useMutation({
    mutationFn: ({ venueId }: { venueId: string; configId: string }) => paymentProviderAPI.deleteVenuePaymentConfig(venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Éxito', description: 'Configuración de venue eliminada' })
    },
  })

  // Handlers
  const handleSave = async (data: any) => {
    if (selectedAccount) {
      return await updateMutation.mutateAsync({ id: selectedAccount.id, data })
    } else {
      return await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = useCallback((account: MerchantAccount) => {
    setSelectedAccount(account)
    setManualDialogOpen(true)
  }, [])

  const handleAdd = () => {
    setSelectedAccount(null)
    setManualDialogOpen(true)
  }

  const handleToggle = useCallback(
    async (id: string) => {
      await toggleMutation.mutateAsync(id)
    },
    [toggleMutation],
  )

  const handleDelete = useCallback((account: MerchantAccount) => {
    setSelectedAccount(account)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = async () => {
    if (selectedAccount) {
      await deleteMutation.mutateAsync(selectedAccount.id)
    }
  }

  const handleManageTerminals = useCallback((account: MerchantAccount) => {
    setSelectedAccount(account)
    setTerminalsDialogOpen(true)
  }, [])

  const handleManageCosts = useCallback((account: MerchantAccount) => {
    setSelectedAccount(account)
    setCostDialogOpen(true)
  }, [])

  const handleAssignToVenue = useCallback((account: MerchantAccount) => {
    setSelectedAccount(account)
    setAssignToVenueDialogOpen(true)
  }, [])

  /**
   * Task 4.3: Open the MerchantSetupPanel in edit mode for an AngelPay
   * merchant. Only AngelPay accounts surface the "Configurar" button — Blumon
   * keeps its own dedicated flow (BlumonAutoFetchWizard) and is not touched
   * by the setup panel.
   */
  const handleOpenSetupPanel = useCallback((account: MerchantAccount) => {
    if (account.provider?.code !== 'ANGELPAY') return
    setEditingMerchantId(account.id)
  }, [])

  // Table columns — mirror the data shown on the account cards
  const columns = useMemo<ColumnDef<MerchantAccount, any>[]>(
    () => [
      {
        id: 'account',
        header: 'Cuenta',
        accessorFn: row => row.displayName || row.alias || '',
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('shrink-0 p-1.5 rounded-lg', a.active ? 'bg-green-500/10' : 'bg-muted')}>
                {a.provider?.code === 'BLUMON' ? (
                  <Zap className={cn('w-4 h-4', a.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                ) : (
                  <CreditCard className={cn('w-4 h-4', a.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                )}
              </div>
              <span className="font-medium text-sm truncate" title={a.displayName || a.alias || ''}>
                {a.displayName || a.alias || 'Sin nombre'}
              </span>
            </div>
          )
        },
      },
      {
        id: 'provider',
        header: 'Proveedor',
        accessorFn: row => row.provider?.name ?? '',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.provider?.name || '—'}</span>,
      },
      {
        id: 'environment',
        header: 'Ambiente',
        accessorFn: row => envBucket(row.blumonEnvironment) ?? '',
        cell: ({ row }) => {
          const env = envBucket(row.original.blumonEnvironment)
          if (!env) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <Badge
              variant={env === 'PRODUCTION' ? 'default' : 'secondary'}
              className={cn(
                'text-[10px]',
                env === 'PRODUCTION'
                  ? 'bg-green-600 hover:bg-green-600'
                  : 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80',
              )}
            >
              {env === 'PRODUCTION' ? 'PROD' : 'SANDBOX'}
            </Badge>
          )
        },
      },
      {
        id: 'identifier',
        header: 'ID / Serial',
        accessorFn: row => row.externalMerchantId ?? '',
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="font-mono text-xs text-muted-foreground">
              <div className="truncate max-w-[180px]" title={a.externalMerchantId}>
                {a.externalMerchantId || '—'}
              </div>
              {a.blumonSerialNumber && <div className="text-[11px]">S/N {a.blumonSerialNumber}</div>}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Estado',
        accessorFn: row => (row.active ? 'active' : 'inactive'),
        cell: ({ row }) =>
          row.original.active ? (
            <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">Activa</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Inactiva
            </Badge>
          ),
      },
      {
        id: 'credentials',
        header: 'Credenciales',
        accessorFn: row => (row.hasCredentials ? 1 : 0),
        cell: ({ row }) =>
          row.original.hasCredentials ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Shield className="w-3.5 h-3.5" /> Sí
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No</span>
          ),
      },
      {
        id: 'costs',
        header: 'Costos',
        accessorFn: row => row._count?.costStructures ?? 0,
        cell: ({ row }) => {
          const c = row.original._count?.costStructures ?? 0
          return c > 0 ? (
            <span className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {c}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Sin costos
            </span>
          )
        },
      },
      {
        id: 'terminals',
        header: 'Terminales',
        accessorFn: row => row._count?.terminals ?? 0,
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Smartphone className="w-3.5 h-3.5 text-blue-500" /> {row.original._count?.terminals ?? 0}
          </span>
        ),
      },
      {
        id: 'venues',
        header: 'Venues',
        accessorFn: row => row._count?.venueConfigs ?? 0,
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="w-3.5 h-3.5" /> {row.original._count?.venueConfigs ?? 0}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                title="Costos"
                onClick={() => handleManageCosts(a)}
              >
                <DollarSign className="w-3.5 h-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                title="Terminales"
                onClick={() => handleManageTerminals(a)}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                title="Asignar a Venue"
                onClick={() => handleAssignToVenue(a)}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
              </Button>
              {a.provider?.code === 'ANGELPAY' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  title="Configurar (panel completo)"
                  onClick={() => handleOpenSetupPanel(a)}
                  data-tour="merchant-row-configure"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-600" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" title="Editar (sólo identidad)" onClick={() => handleEdit(a)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                title={a.active ? 'Desactivar' : 'Activar'}
                onClick={() => handleToggle(a.id)}
              >
                <Power className={cn('w-3.5 h-3.5', a.active ? 'text-green-600' : 'text-muted-foreground')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                title="Eliminar"
                onClick={() => handleDelete(a)}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
              </Button>
            </div>
          )
        },
      },
    ],
    [handleManageCosts, handleManageTerminals, handleAssignToVenue, handleEdit, handleToggle, handleDelete, handleOpenSetupPanel],
  )

  // Calculate stats
  const activeCount = allAccounts.filter(a => a.active).length
  const withCostsCount = allAccounts.filter(a => a._count?.costStructures && a._count.costStructures > 0).length
  const withoutCostsCount = allAccounts.length - withCostsCount

  // Toggle a stat card filter — clicking again clears it
  const toggleStatusShortcut = (value: 'active' | 'inactive') =>
    setStatusFilter(prev => (prev.length === 1 && prev[0] === value ? [] : [value]))
  const toggleCostShortcut = (value: 'with' | 'without') =>
    setCostFilter(prev => (prev.length === 1 && prev[0] === value ? [] : [value]))

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
            className="bg-yellow-500 hover:bg-yellow-600 text-primary-foreground"
          >
            <Zap className="w-4 h-4 mr-2" />
            Blumon Auto-Fetch
          </Button>
          <Button
            onClick={() => setBatchAutoFetchOpen(true)}
            variant="outline"
            className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
          >
            <Layers className="w-4 h-4 mr-2" />
            Batch (x10+)
          </Button>
          <Button
            onClick={() => setSetupPanelOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-primary-foreground"
            data-tour="angelpay-wizard-btn"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Agregar AngelPay
          </Button>
        </div>
      </div>

      {/* Statistics Grid — cards double as quick filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button type="button" onClick={resetFilters} className="text-left">
          <GlassCard
            className={cn('p-4 transition-all hover:ring-1 hover:ring-blue-500/40', !hasActiveFilters && 'ring-1 ring-blue-500/60')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allAccounts.length}</p>
                <p className="text-xs text-muted-foreground">Total de Cuentas</p>
              </div>
            </div>
          </GlassCard>
        </button>

        <button type="button" onClick={() => toggleStatusShortcut('active')} className="text-left">
          <GlassCard
            className={cn(
              'p-4 transition-all hover:ring-1 hover:ring-green-500/40',
              statusFilter.length === 1 && statusFilter[0] === 'active' && 'ring-1 ring-green-500/60',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Activas</p>
              </div>
            </div>
          </GlassCard>
        </button>

        <button type="button" onClick={() => toggleCostShortcut('with')} className="text-left">
          <GlassCard
            className={cn(
              'p-4 transition-all hover:ring-1 hover:ring-purple-500/40',
              costFilter.length === 1 && costFilter[0] === 'with' && 'ring-1 ring-purple-500/60',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withCostsCount}</p>
                <p className="text-xs text-muted-foreground">Con Costos</p>
              </div>
            </div>
          </GlassCard>
        </button>

        <button type="button" onClick={() => toggleCostShortcut('without')} className="text-left">
          <GlassCard
            className={cn(
              'p-4 transition-all hover:ring-1 hover:ring-amber-500/40',
              costFilter.length === 1 && costFilter[0] === 'without' && 'ring-1 ring-amber-500/60',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withoutCostsCount}</p>
                <p className="text-xs text-muted-foreground">Sin Costos</p>
              </div>
            </div>
          </GlassCard>
        </button>
      </div>

      {/* Search + Filters */}
      <GlassCard className="p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, proveedor, ID, serial, banco, venue, terminal..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter pills */}
        <FilterPillBar onReset={hasActiveFilters ? resetFilters : undefined}>
          <FilterPill
            label="Proveedor"
            activeCount={providerFilter.length}
            activeLabel={
              providerFilter.length === 1 ? providerOptions.find(o => o.value === providerFilter[0])?.label : undefined
            }
            onClear={() => setProviderFilter([])}
          >
            <CheckboxFilterContent
              title="Proveedor"
              options={providerOptions}
              selectedValues={providerFilter}
              onApply={setProviderFilter}
              searchable={providerOptions.length > 6}
              emptyLabel="Sin proveedores"
            />
          </FilterPill>

          <FilterPill
            label="Estado"
            activeCount={statusFilter.length}
            activeLabel={statusFilter.length === 1 ? (statusFilter[0] === 'active' ? 'Activas' : 'Inactivas') : undefined}
            onClear={() => setStatusFilter([])}
          >
            <CheckboxFilterContent
              title="Estado"
              options={[
                { value: 'active', label: 'Activas' },
                { value: 'inactive', label: 'Inactivas' },
              ]}
              selectedValues={statusFilter}
              onApply={setStatusFilter}
            />
          </FilterPill>

          {hasEnvironments && (
            <FilterPill
              label="Ambiente"
              activeCount={environmentFilter.length}
              activeLabel={
                environmentFilter.length === 1 ? (environmentFilter[0] === 'PRODUCTION' ? 'Producción' : 'Sandbox') : undefined
              }
              onClear={() => setEnvironmentFilter([])}
            >
              <CheckboxFilterContent
                title="Ambiente"
                options={[
                  { value: 'PRODUCTION', label: 'Producción' },
                  { value: 'SANDBOX', label: 'Sandbox' },
                ]}
                selectedValues={environmentFilter}
                onApply={setEnvironmentFilter}
              />
            </FilterPill>
          )}

          <FilterPill
            label="Costos"
            activeCount={costFilter.length}
            activeLabel={costFilter.length === 1 ? (costFilter[0] === 'with' ? 'Con costos' : 'Sin costos') : undefined}
            onClear={() => setCostFilter([])}
          >
            <CheckboxFilterContent
              title="Estructura de costos"
              options={[
                { value: 'with', label: 'Con costos' },
                { value: 'without', label: 'Sin costos' },
              ]}
              selectedValues={costFilter}
              onApply={setCostFilter}
            />
          </FilterPill>

          <FilterPill
            label="Credenciales"
            activeCount={credentialsFilter.length}
            activeLabel={
              credentialsFilter.length === 1 ? (credentialsFilter[0] === 'with' ? 'Con credenciales' : 'Sin credenciales') : undefined
            }
            onClear={() => setCredentialsFilter([])}
          >
            <CheckboxFilterContent
              title="Credenciales"
              options={[
                { value: 'with', label: 'Con credenciales' },
                { value: 'without', label: 'Sin credenciales' },
              ]}
              selectedValues={credentialsFilter}
              onApply={setCredentialsFilter}
            />
          </FilterPill>

          <FilterPill
            label="Terminales"
            activeCount={terminalsFilter.length}
            activeLabel={
              terminalsFilter.length === 1 ? (terminalsFilter[0] === 'with' ? 'Con terminales' : 'Sin terminales') : undefined
            }
            onClear={() => setTerminalsFilter([])}
          >
            <CheckboxFilterContent
              title="Terminales"
              options={[
                { value: 'with', label: 'Con terminales' },
                { value: 'without', label: 'Sin terminales' },
              ]}
              selectedValues={terminalsFilter}
              onApply={setTerminalsFilter}
            />
          </FilterPill>

          <FilterPill
            label="Venue"
            activeCount={venueFilter.length}
            activeLabel={venueFilter.length === 1 ? venueOptions.find(o => o.value === venueFilter[0])?.label : undefined}
            onClear={() => setVenueFilter([])}
          >
            <CheckboxFilterContent
              title="Venue asignado"
              options={venueOptions}
              selectedValues={venueFilter}
              onApply={setVenueFilter}
              searchable
              searchPlaceholder="Buscar venue..."
              emptyLabel="Ninguna cuenta asignada a un venue"
            />
          </FilterPill>
        </FilterPillBar>
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
            {hasActiveFilters
              ? 'No hay cuentas que coincidan con los filtros seleccionados'
              : 'No hay cuentas de comercio registradas aún'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <Button onClick={resetFilters} variant="outline">
                Borrar filtros
              </Button>
            ) : (
              <>
                <Button onClick={handleAdd} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Manual
                </Button>
                <Button onClick={() => setBlumonWizardOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-primary-foreground">
                  <Zap className="w-4 h-4 mr-2" />
                  Blumon Auto-Fetch
                </Button>
              </>
            )}
          </div>
        </GlassCard>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredAccounts.length} de {allAccounts.length} cuentas
            </p>
            {/* View toggle: cards vs table */}
            <div className="flex items-center gap-0.5 rounded-lg border border-input p-0.5">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 cursor-pointer"
                onClick={() => changeViewMode('cards')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Tarjetas
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 cursor-pointer"
                onClick={() => changeViewMode('table')}
              >
                <List className="w-3.5 h-3.5" />
                Tabla
              </Button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <DataTable
              data={filteredAccounts}
              rowCount={filteredAccounts.length}
              columns={columns}
              tableId="superadmin-merchant-accounts"
              getRowClassName={account => (!account.active ? 'opacity-60' : undefined)}
            />
          ) : (
            <>
              {/* Active Accounts */}
              {activeAccounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAccounts.map(account => (
                    <MerchantAccountCard
                      key={account.id}
                      account={account}
                      onEdit={handleEdit}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onManageTerminals={handleManageTerminals}
                      onManageCosts={handleManageCosts}
                      onAssignToVenue={handleAssignToVenue}
                      onConfigure={handleOpenSetupPanel}
                    />
                  ))}
                </div>
              )}

              {/* Divider - only if both active and inactive exist */}
              {activeAccounts.length > 0 && inactiveAccounts.length > 0 && (
                <div className="flex items-center gap-4 my-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-sm text-muted-foreground">Cuentas Inactivas</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              {/* Inactive Accounts */}
              {inactiveAccounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inactiveAccounts.map(account => (
                    <MerchantAccountCard
                      key={account.id}
                      account={account}
                      onEdit={handleEdit}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onManageTerminals={handleManageTerminals}
                      onManageCosts={handleManageCosts}
                      onAssignToVenue={handleAssignToVenue}
                      onConfigure={handleOpenSetupPanel}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Dialogs */}
      <ManualAccountDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        account={selectedAccount}
        onSave={handleSave}
        venueId={singleSelectedVenueId}
      />

      <BlumonAutoFetchWizard
        open={blumonWizardOpen}
        onOpenChange={setBlumonWizardOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
        }}
      />

      <BatchAutoFetchDialog
        open={batchAutoFetchOpen}
        onOpenChange={setBatchAutoFetchOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
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
        venueId={singleSelectedVenueId}
      />

      <CostStructureDialog open={costDialogOpen} onOpenChange={setCostDialogOpen} account={selectedAccount} />

      <AssignAccountToVenueDialog open={assignToVenueDialogOpen} onOpenChange={setAssignToVenueDialogOpen} account={selectedAccount} />

      <MerchantSetupPanel
        open={setupPanelOpen}
        onOpenChange={setSetupPanelOpen}
        mode="create"
      />

      {/* Edit-mode panel — separate instance keyed by merchantId so state
       *  is rebuilt cleanly each time the operator picks a different merchant
       *  to configure. Task 4.3. */}
      {editingMerchantId && (
        <MerchantSetupPanel
          key={editingMerchantId}
          open={!!editingMerchantId}
          onOpenChange={o => !o && setEditingMerchantId(null)}
          mode="edit"
          merchantAccountId={editingMerchantId}
        />
      )}
    </div>
  )
}

export default MerchantAccounts
