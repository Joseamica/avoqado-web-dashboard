import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Search, X } from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import creditPackService from '@/services/creditPack.service'
import type { CreditTransaction, CreditTransactionType } from '@/types/creditPack'
import { getIntlLocale } from '@/utils/i18n-locale'
import { includesNormalized } from '@/lib/utils'

export default function CreditPackTransactionsTab() {
  const { venueId } = useCurrentVenue()
  const { t, i18n } = useTranslation('creditPacks')
  const { t: tCommon } = useTranslation()

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['credit-pack-transactions', venueId, pagination.pageIndex, pagination.pageSize, typeFilter],
    queryFn: () =>
      creditPackService.getTransactions(venueId, {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        type: typeFilter.length === 1 ? (typeFilter[0] as CreditTransactionType) : undefined,
      }),
  })

  const transactions = useMemo(() => {
    let result = transactionsData?.data || []
    if (debouncedSearch) {
      result = result.filter((tx: CreditTransaction) => {
        const name = [tx.customer.firstName, tx.customer.lastName].filter(Boolean).join(' ')
        return includesNormalized(name, debouncedSearch) || includesNormalized(tx.customer.email ?? '', debouncedSearch) || (tx.customer.phone ?? '').includes(debouncedSearch)
      })
    }
    return result
  }, [transactionsData?.data, debouncedSearch])

  const formatDate = useCallback(
    (dateStr: string) =>
      new Date(dateStr).toLocaleString(getIntlLocale(i18n.language), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  )

  const getTypeBadgeVariant = useCallback((type: CreditTransactionType) => {
    switch (type) {
      case 'PURCHASE': return 'default' as const
      case 'REDEEM': return 'secondary' as const
      case 'EXPIRE': return 'destructive' as const
      case 'REFUND': return 'outline' as const
      case 'ADJUST': return 'default' as const
      default: return 'secondary' as const
    }
  }, [])

  const typeOptions = useMemo(
    () => [
      { value: 'PURCHASE', label: t('transactionTypes.PURCHASE') },
      { value: 'REDEEM', label: t('transactionTypes.REDEEM') },
      { value: 'EXPIRE', label: t('transactionTypes.EXPIRE') },
      { value: 'REFUND', label: t('transactionTypes.REFUND') },
      { value: 'ADJUST', label: t('transactionTypes.ADJUST') },
    ],
    [t],
  )

  const typeLabels = useMemo(
    () => ({
      PURCHASE: t('transactionTypes.PURCHASE'),
      REDEEM: t('transactionTypes.REDEEM'),
      EXPIRE: t('transactionTypes.EXPIRE'),
      REFUND: t('transactionTypes.REFUND'),
      ADJUST: t('transactionTypes.ADJUST'),
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

  const columns: ColumnDef<CreditTransaction>[] = useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('transactions.columns.date'),
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
      },
      {
        accessorKey: 'customer',
        header: t('transactions.columns.customer'),
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
        id: 'pack',
        header: t('transactions.columns.pack', { defaultValue: 'Paquete' }),
        cell: ({ row }) => {
          const packName = row.original.creditPackPurchase?.creditPack?.name
          return <span className="text-sm">{packName || '—'}</span>
        },
      },
      {
        accessorKey: 'type',
        header: t('transactions.columns.type'),
        cell: ({ row }) => (
          <Badge variant={getTypeBadgeVariant(row.original.type)}>
            {t(`transactionTypes.${row.original.type}`)}
          </Badge>
        ),
      },
      {
        id: 'detail',
        header: t('transactions.columns.detail', { defaultValue: 'Detalle' }),
        cell: ({ row }) => {
          const productName = row.original.creditItemBalance?.product?.name
          const qty = row.original.quantity
          const isPositive = ['PURCHASE', 'ADJUST'].includes(row.original.type) && qty > 0
          return (
            <div className="flex items-center gap-2">
              <span className={`font-medium tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? `+${qty}` : `${qty}`}
              </span>
              {productName && (
                <span className="text-sm text-muted-foreground">{productName}</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'reason',
        header: t('transactions.columns.reason'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {row.original.reason || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'createdBy',
        header: t('transactions.columns.createdBy'),
        cell: ({ row }) => {
          const staff = row.original.createdBy?.staff
          if (staff) {
            return (
              <span className="text-sm">
                {staff.firstName} {staff.lastName}
              </span>
            )
          }
          // No staff = automatic/system transaction
          const type = row.original.type
          if (type === 'PURCHASE') return <span className="text-sm text-muted-foreground">{t('transactions.actor.system', { defaultValue: 'Sistema (Stripe)' })}</span>
          if (type === 'REDEEM') return <span className="text-sm text-muted-foreground">{t('transactions.actor.customer', { defaultValue: 'Cliente (reserva)' })}</span>
          if (type === 'EXPIRE') return <span className="text-sm text-muted-foreground">{t('transactions.actor.system', { defaultValue: 'Sistema (Stripe)' })}</span>
          return <span className="text-muted-foreground">—</span>
        },
      },
    ],
    [t, formatDate, getTypeBadgeVariant],
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

        {/* Type filter pill */}
        <FilterPill
          label={getFilterDisplayLabel(typeFilter, t('transactions.columns.type'), typeLabels)}
          isActive={typeFilter.length > 0}
          onClear={() => setTypeFilter([])}
        >
          <CheckboxFilterContent
            title={t('transactions.columns.type')}
            options={typeOptions}
            selectedValues={typeFilter}
            onApply={setTypeFilter}
          />
        </FilterPill>

        {/* Clear all */}
        {(typeFilter.length > 0 || debouncedSearch) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => { setTypeFilter([]); setSearchTerm(''); setIsSearchOpen(false) }}
          >
            <X className="h-4 w-4 mr-1" />
            {t('filters.clearAll')}
          </Button>
        )}
      </div>

      <DataTable
        data={transactions}
        columns={columns}
        isLoading={isLoading}
        pagination={pagination}
        setPagination={setPagination}
        tableId="credit-pack-transactions:list"
        rowCount={transactionsData?.meta?.total || 0}
        showColumnCustomizer={false}
      />
    </div>
  )
}
