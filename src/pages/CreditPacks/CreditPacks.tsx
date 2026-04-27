import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Package, Pencil, Plus, Power, Search, X } from 'lucide-react'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { PermissionGate } from '@/components/PermissionGate'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import creditPackService from '@/services/creditPack.service'
import type { CreditPack } from '@/types/creditPack'
import { getIntlLocale } from '@/utils/i18n-locale'
import { includesNormalized } from '@/lib/utils'

import CreditPackFormModal from './CreditPackForm'
import CreditPackPurchasesTab from './CreditPackPurchases'
import CreditPackTransactionsTab from './CreditPackTransactions'

// ─── Hash-based tabs ───────────────────────────────────────
const VALID_TABS = ['packs', 'purchases', 'transactions'] as const
type TabValue = (typeof VALID_TABS)[number]

export default function CreditPacks() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('creditPacks')
  const { t: tCommon } = useTranslation()

  // ─── Hash tabs ───────────────────────────────────────────
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'packs'
  }
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) setActiveTab(tabFromHash)
  }, [location.hash])

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  // ─── State ───────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [deactivatingPack, setDeactivatingPack] = useState<CreditPack | null>(null)

  // FullScreenModal state
  const [showForm, setShowForm] = useState(false)
  const [editingPackId, setEditingPackId] = useState<string | undefined>()

  // ─── Data ────────────────────────────────────────────────
  const { data: packsData, isLoading } = useQuery({
    queryKey: ['credit-packs', venueId],
    queryFn: () => creditPackService.getCreditPacks(venueId),
  })

  const deactivateMutation = useMutation({
    mutationFn: (packId: string) => creditPackService.deactivateCreditPack(venueId, packId),
    onSuccess: () => {
      toast({ title: t('toasts.deactivateSuccess') })
      queryClient.invalidateQueries({ queryKey: ['credit-packs', venueId] })
      setDeactivatingPack(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ packId, active }: { packId: string; active: boolean }) =>
      creditPackService.updateCreditPack(venueId, packId, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-packs', venueId] })
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // ─── Filtered packs ──────────────────────────────────────
  const packs = useMemo(() => {
    let result = packsData || []
    if (statusFilter.length > 0) {
      result = result.filter(p => {
        const status = p.active ? 'active' : 'inactive'
        return statusFilter.includes(status)
      })
    }
    if (debouncedSearch) {
      result = result.filter(p => includesNormalized(p.name ?? '', debouncedSearch) || includesNormalized(p.description ?? '', debouncedSearch))
    }
    return result
  }, [packsData, statusFilter, debouncedSearch])

  // ─── Helpers ─────────────────────────────────────────────
  const formatPrice = useCallback(
    (price: number, currency: string) =>
      new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency }).format(price),
    [i18n.language],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('status.onSale', { defaultValue: 'A la venta' }) },
      { value: 'inactive', label: t('status.offSale', { defaultValue: 'No disponible' }) },
    ],
    [t],
  )

  const statusLabels = useMemo(
    () => ({
      active: t('status.onSale', { defaultValue: 'A la venta' }),
      inactive: t('status.offSale', { defaultValue: 'No disponible' }),
    }),
    [t],
  )

  const getFilterDisplayLabel = useCallback(
    (values: string[], label: string, labels: Record<string, string>): string => {
      if (values.length === 0) return label
      if (values.length === 1) return `${label}: ${labels[values[0]] || values[0]}`
      return `${label}: ${values.length}`
    },
    [],
  )

  const openCreate = () => {
    setEditingPackId(undefined)
    setShowForm(true)
  }

  const openEdit = (packId: string) => {
    setEditingPackId(packId)
    setShowForm(true)
  }

  // ─── Columns ─────────────────────────────────────────────
  const columns: ColumnDef<CreditPack>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('list.columns.name')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium">{row.original.name}</div>
              {row.original.description && (
                <div className="text-sm text-muted-foreground truncate max-w-[200px]">{row.original.description}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'price',
        header: t('list.columns.price'),
        cell: ({ row }) => (
          <span className="font-medium">{formatPrice(row.original.price, row.original.currency)}</span>
        ),
      },
      {
        accessorKey: 'items',
        header: t('list.columns.items'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {t('itemsSummary', { count: row.original.items.length })}
          </span>
        ),
      },
      {
        accessorKey: 'validityDays',
        header: t('list.columns.validity'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.validityDays
              ? t('validity.days', { days: row.original.validityDays })
              : t('validity.noExpiry')}
          </span>
        ),
      },
      {
        accessorKey: 'active',
        header: t('list.columns.onSale', { defaultValue: 'A la venta' }),
        cell: ({ row }) => (
          <div onClick={e => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={row.original.active}
                    onCheckedChange={checked =>
                      toggleActiveMutation.mutate({ packId: row.original.id, active: checked })
                    }
                    disabled={toggleActiveMutation.isPending}
                    className="cursor-pointer"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {row.original.active
                  ? t('status.toggleOff', { defaultValue: 'Desactivar venta' })
                  : t('status.toggleOn', { defaultValue: 'Activar venta' })}
              </TooltipContent>
            </Tooltip>
          </div>
        ),
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={5} className="w-48">
                <PermissionGate permission="creditPacks:update">
                  <DropdownMenuItem onClick={() => openEdit(row.original.id)} className="cursor-pointer">
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('actions.edit')}
                  </DropdownMenuItem>
                </PermissionGate>
                {row.original.active && (
                  <>
                    <DropdownMenuSeparator />
                    <PermissionGate permission="creditPacks:delete">
                      <DropdownMenuItem onClick={() => setDeactivatingPack(row.original)} className="text-red-600 cursor-pointer">
                        <Power className="h-4 w-4 mr-2" />
                        {t('actions.deactivate')}
                      </DropdownMenuItem>
                    </PermissionGate>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, tCommon, formatPrice],
  )

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <PermissionGate permission="creditPacks:create">
          <Button onClick={openCreate} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            {t('actions.create')}
          </Button>
        </PermissionGate>
      </div>

      {/* Underline tabs (hash-based) */}
      <Tabs value={activeTab} onValueChange={v => handleTabChange(v as TabValue)} className="space-y-6">
        <div className="border-b border-border">
          <nav className="flex items-center gap-6">
            {VALID_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`relative pb-3 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`tabs.${tab}`)}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ─── Packs tab ──────────────────────────────────── */}
        <TabsContent value="packs" className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Expandable search */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-200">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={t('list.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-8 h-9 w-64 rounded-full"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 h-9 w-9 p-0 cursor-pointer"
                    onClick={() => {
                      setSearchTerm('')
                      setIsSearchOpen(false)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-full cursor-pointer"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  {tCommon('search')}
                  {debouncedSearch && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              )}
            </div>

            {/* Status filter pill */}
            <FilterPill
              label={getFilterDisplayLabel(statusFilter, t('list.columns.onSale', { defaultValue: 'A la venta' }), statusLabels)}
              isActive={statusFilter.length > 0}
              onClear={() => setStatusFilter([])}
            >
              <CheckboxFilterContent
                title={t('list.columns.status')}
                options={statusOptions}
                selectedValues={statusFilter}
                onApply={setStatusFilter}
              />
            </FilterPill>

            {/* Clear all */}
            {(statusFilter.length > 0 || debouncedSearch) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => {
                  setStatusFilter([])
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
              >
                <X className="h-4 w-4 mr-1" />
                {t('filters.clearAll')}
              </Button>
            )}
          </div>

          <DataTable
            data={packs}
            columns={columns}
            isLoading={isLoading}
            tableId="credit-packs:list"
            rowCount={packs.length}
            showColumnCustomizer={false}
          />
        </TabsContent>

        {/* ─── Purchases tab ──────────────────────────────── */}
        <TabsContent value="purchases">
          <CreditPackPurchasesTab />
        </TabsContent>

        {/* ─── Transactions tab ───────────────────────────── */}
        <TabsContent value="transactions">
          <CreditPackTransactionsTab />
        </TabsContent>
      </Tabs>

      {/* ─── FullScreenModal: Create/Edit ────────────────── */}
      <CreditPackFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        packId={editingPackId}
        onSuccess={() => {
          setShowForm(false)
          queryClient.invalidateQueries({ queryKey: ['credit-packs', venueId] })
        }}
      />

      {/* ─── Deactivate Alert ────────────────────────────── */}
      {deactivatingPack && (
        <AlertDialog open={!!deactivatingPack} onOpenChange={() => setDeactivatingPack(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deactivate.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deactivate.description', { name: deactivatingPack.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('deactivate.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deactivateMutation.mutate(deactivatingPack.id)}
                disabled={deactivateMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deactivateMutation.isPending ? tCommon('deleting') : t('deactivate.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
