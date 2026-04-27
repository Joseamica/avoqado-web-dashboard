import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, ChevronRight, MoreHorizontal, RefreshCcw, Search, Undo2, X } from 'lucide-react'
import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import creditPackService from '@/services/creditPack.service'
import type { CreditPackPurchase, CreditItemBalance, CreditPurchaseStatus } from '@/types/creditPack'
import { getIntlLocale } from '@/utils/i18n-locale'
import { includesNormalized } from '@/lib/utils'

export default function CreditPackPurchasesTab() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('creditPacks')
  const { t: tCommon } = useTranslation()

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Dialog state
  const [refundingPurchase, setRefundingPurchase] = useState<CreditPackPurchase | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [redeemingBalance, setRedeemingBalance] = useState<CreditItemBalance | null>(null)
  const [redeemQuantity, setRedeemQuantity] = useState(1)
  const [adjustingBalance, setAdjustingBalance] = useState<CreditItemBalance | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')

  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ['credit-pack-purchases', venueId, pagination.pageIndex, pagination.pageSize, statusFilter],
    queryFn: () =>
      creditPackService.getPurchases(venueId, {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        status: statusFilter.length === 1 ? (statusFilter[0] as CreditPurchaseStatus) : undefined,
      }),
  })

  const purchases = useMemo(() => {
    let result = purchasesData?.data || []
    if (debouncedSearch) {
      result = result.filter((p: CreditPackPurchase) => {
        const name = [p.customer.firstName, p.customer.lastName].filter(Boolean).join(' ')
        return includesNormalized(name, debouncedSearch) || includesNormalized(p.customer.email ?? '', debouncedSearch) || (p.customer.phone ?? '').includes(debouncedSearch)
      })
    }
    return result
  }, [purchasesData?.data, debouncedSearch])

  // Mutations
  const refundMutation = useMutation({
    mutationFn: () => creditPackService.refundPurchase(venueId, refundingPurchase!.id, { reason: refundReason }),
    onSuccess: () => {
      toast({ title: t('toasts.refundSuccess') })
      queryClient.invalidateQueries({ queryKey: ['credit-pack-purchases', venueId] })
      setRefundingPurchase(null)
      setRefundReason('')
    },
    onError: (error: any) => {
      toast({ title: tCommon('common.error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
    },
  })

  const redeemMutation = useMutation({
    mutationFn: () => creditPackService.redeemItem(venueId, redeemingBalance!.id, { quantity: redeemQuantity }),
    onSuccess: () => {
      toast({ title: t('toasts.redeemSuccess') })
      queryClient.invalidateQueries({ queryKey: ['credit-pack-purchases', venueId] })
      setRedeemingBalance(null)
      setRedeemQuantity(1)
    },
    onError: (error: any) => {
      toast({ title: tCommon('common.error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
    },
  })

  const adjustMutation = useMutation({
    mutationFn: () => creditPackService.adjustBalance(venueId, adjustingBalance!.id, { quantity: adjustQuantity, reason: adjustReason }),
    onSuccess: () => {
      toast({ title: t('toasts.adjustSuccess') })
      queryClient.invalidateQueries({ queryKey: ['credit-pack-purchases', venueId] })
      setAdjustingBalance(null)
      setAdjustQuantity(0)
      setAdjustReason('')
    },
    onError: (error: any) => {
      toast({ title: tCommon('common.error'), description: error.response?.data?.message || t('toasts.error'), variant: 'destructive' })
    },
  })

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const getStatusBadgeVariant = useCallback((status: CreditPurchaseStatus) => {
    switch (status) {
      case 'ACTIVE': return 'default' as const
      case 'EXHAUSTED': return 'secondary' as const
      case 'EXPIRED': return 'destructive' as const
      case 'REFUNDED': return 'outline' as const
      default: return 'secondary' as const
    }
  }, [])

  const formatDate = useCallback(
    (dateStr: string) => new Date(dateStr).toLocaleDateString(getIntlLocale(i18n.language), { dateStyle: 'medium' }),
    [i18n.language],
  )

  const formatPrice = useCallback(
    (amount: number) => new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' }).format(amount),
    [i18n.language],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: t('status.ACTIVE') },
      { value: 'EXHAUSTED', label: t('status.EXHAUSTED') },
      { value: 'EXPIRED', label: t('status.EXPIRED') },
      { value: 'REFUNDED', label: t('status.REFUNDED') },
    ],
    [t],
  )

  const statusLabels = useMemo(
    () => ({
      ACTIVE: t('status.ACTIVE'),
      EXHAUSTED: t('status.EXHAUSTED'),
      EXPIRED: t('status.EXPIRED'),
      REFUNDED: t('status.REFUNDED'),
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

  const renderSubComponent = useCallback(
    (purchase: CreditPackPurchase): ReactNode | null => {
      if (!expandedRows.has(purchase.id)) return null
      return (
        <div className="px-12 py-4">
          <h4 className="font-medium mb-3 text-sm">{t('purchases.balances')}</h4>
          <div className="space-y-2">
            {purchase.itemBalances.map((balance: CreditItemBalance) => (
              <div key={balance.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/30">
                <div>
                  <span className="font-medium">{balance.product.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {t('purchases.remaining', { remaining: balance.remainingQuantity, original: balance.originalQuantity })}
                  </span>
                </div>
                {purchase.status === 'ACTIVE' && balance.remainingQuantity > 0 && (
                  <div className="flex gap-2">
                    <PermissionGate permission="creditPacks:update">
                      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => { setRedeemingBalance(balance); setRedeemQuantity(1) }}>
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        {t('actions.redeem')}
                      </Button>
                      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => { setAdjustingBalance(balance); setAdjustQuantity(0); setAdjustReason('') }}>
                        {t('actions.adjust')}
                      </Button>
                    </PermissionGate>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    },
    [expandedRows, t],
  )

  const columns: ColumnDef<CreditPackPurchase>[] = useMemo(
    () => [
      {
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <button type="button" onClick={() => toggleRow(row.original.id)} className="bg-transparent cursor-pointer p-1">
            {expandedRows.has(row.original.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ),
        size: 32,
      },
      {
        accessorKey: 'customer',
        header: t('purchases.columns.customer'),
        cell: ({ row }) => {
          const c = row.original.customer
          return (
            <div>
              <div className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</div>
              <div className="text-sm text-muted-foreground">{c.email || c.phone || ''}</div>
            </div>
          )
        },
      },
      {
        accessorKey: 'creditPack',
        header: t('purchases.columns.pack'),
        cell: ({ row }) => <span className="font-medium">{row.original.creditPack.name}</span>,
      },
      {
        accessorKey: 'amountPaid',
        header: t('purchases.columns.amountPaid'),
        cell: ({ row }) => <span>{formatPrice(row.original.amountPaid)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('purchases.columns.status'),
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {t(`status.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: 'expiresAt',
        header: t('purchases.columns.expiresAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.expiresAt ? formatDate(row.original.expiresAt) : t('validity.noExpiry')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => {
          if (row.original.status !== 'ACTIVE') return null
          return (
            <div onClick={e => e.stopPropagation()}>
              <PermissionGate permission="creditPacks:delete">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={5} className="w-48">
                    <DropdownMenuItem onClick={() => setRefundingPurchase(row.original)} className="text-red-600 cursor-pointer">
                      <Undo2 className="h-4 w-4 mr-2" />
                      {t('actions.refund')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGate>
            </div>
          )
        },
      },
    ],
    [t, tCommon, formatDate, formatPrice, getStatusBadgeVariant, expandedRows, toggleRow],
  )

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Expandable search */}
        <div className="relative">
          {isSearchOpen ? (
            <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-200">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder={tCommon('search')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 w-64 rounded-full"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 h-9 w-9 p-0 cursor-pointer"
                onClick={() => { setSearchTerm(''); setIsSearchOpen(false) }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-full cursor-pointer" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              {tCommon('search')}
              {debouncedSearch && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary" />}
            </Button>
          )}
        </div>

        <FilterPill
          label={getFilterDisplayLabel(statusFilter, t('purchases.columns.status'), statusLabels)}
          isActive={statusFilter.length > 0}
          onClear={() => setStatusFilter([])}
        >
          <CheckboxFilterContent
            title={t('purchases.columns.status')}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={setStatusFilter}
          />
        </FilterPill>

        {(statusFilter.length > 0 || debouncedSearch) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => { setStatusFilter([]); setSearchTerm(''); setIsSearchOpen(false) }}
          >
            <X className="h-4 w-4 mr-1" />
            {t('filters.clearAll')}
          </Button>
        )}
      </div>

      <DataTable
        data={purchases}
        columns={columns}
        isLoading={isLoading}
        pagination={pagination}
        setPagination={setPagination}
        tableId="credit-pack-purchases:list"
        rowCount={purchasesData?.meta?.total || 0}
        showColumnCustomizer={false}
        renderSubComponent={renderSubComponent}
      />

      {/* Refund Dialog */}
      {refundingPurchase && (
        <AlertDialog open={!!refundingPurchase} onOpenChange={() => setRefundingPurchase(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('refund.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('refund.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label>{t('refund.reasonLabel')}</Label>
              <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder={t('refund.reasonPlaceholder')} className="mt-1" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('refund.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending || !refundReason} className="bg-red-600 hover:bg-red-700">
                {t('refund.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Redeem Dialog */}
      {redeemingBalance && (
        <Dialog open={!!redeemingBalance} onOpenChange={() => setRedeemingBalance(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('redeem.title')}</DialogTitle>
              <DialogDescription>{redeemingBalance.product.name}</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label>{t('redeem.quantityLabel')}</Label>
              <Input type="number" min={1} max={redeemingBalance.remainingQuantity} value={redeemQuantity} onChange={e => setRedeemQuantity(parseInt(e.target.value) || 1)} className="mt-1" />
              <p className="text-sm text-muted-foreground mt-1">
                {t('purchases.remaining', { remaining: redeemingBalance.remainingQuantity, original: redeemingBalance.originalQuantity })}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRedeemingBalance(null)}>{t('redeem.cancel')}</Button>
              <Button onClick={() => redeemMutation.mutate()} disabled={redeemMutation.isPending}>{t('redeem.confirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Adjust Dialog */}
      {adjustingBalance && (
        <Dialog open={!!adjustingBalance} onOpenChange={() => setAdjustingBalance(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('adjust.title')}</DialogTitle>
              <DialogDescription>{adjustingBalance.product.name}</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <div>
                <Label>{t('adjust.quantityLabel')}</Label>
                <Input type="number" value={adjustQuantity} onChange={e => setAdjustQuantity(parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <Label>{t('adjust.reasonLabel')}</Label>
                <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder={t('adjust.reasonPlaceholder')} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustingBalance(null)}>{t('adjust.cancel')}</Button>
              <Button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || !adjustReason || adjustQuantity === 0}>{t('adjust.confirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
