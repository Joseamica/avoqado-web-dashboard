import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Layers, MoreHorizontal, Pencil, Plus, Ticket, Trash2 } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import DataTable from '@/components/data-table'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import couponService from '@/services/coupon.service'
import discountService from '@/services/discount.service'
import type { Coupon, Discount } from '@/types/discount'
import { getIntlLocale } from '@/utils/i18n-locale'

import BulkGenerateDialog from './components/BulkGenerateDialog'

export default function Coupons() {
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()

  // State
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null)
  const [showBulkGenerate, setShowBulkGenerate] = useState(false)

  // Fetch coupons
  const { data: couponsData, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['coupons', venueId, pagination.pageIndex, pagination.pageSize, selectedDiscountId, activeFilter],
    queryFn: () =>
      couponService.getCoupons(venueId, {
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        discountId: selectedDiscountId || undefined,
        active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
      }),
    refetchOnWindowFocus: true,
  })

  // Fetch discounts for filter
  const { data: discountsData } = useQuery({
    queryKey: ['discounts', venueId, 'all'],
    queryFn: () => discountService.getDiscounts(venueId, { pageSize: 100 }),
  })

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: (couponId: string) => couponService.deleteCoupon(venueId, couponId),
    onSuccess: () => {
      toast({
        title: t('coupons.toasts.deleteSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['coupons', venueId] })
      setDeletingCoupon(null)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('coupons.toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Memoized coupons list
  const coupons = useMemo(() => couponsData?.data || [], [couponsData?.data])

  // Memoized discounts list for filter
  const discounts = useMemo(() => discountsData?.data || [], [discountsData?.data])

  // Client-side search
  const handleSearch = useCallback((search: string, rows: Coupon[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(c => {
      const code = (c.code || '').toLowerCase()
      return code.includes(q)
    })
  }, [])

  // Format validity period
  const formatValidityPeriod = useCallback(
    (coupon: Coupon) => {
      if (!coupon.validFrom && !coupon.validUntil) {
        return tCommon('validAlways')
      }
      if (coupon.validFrom && coupon.validUntil) {
        const from = new Date(coupon.validFrom).toLocaleDateString(getIntlLocale(i18n.language))
        const to = new Date(coupon.validUntil).toLocaleDateString(getIntlLocale(i18n.language))
        return tCommon('dateRange', { from, to })
      }
      if (coupon.validFrom) {
        return tCommon('validFrom', { date: new Date(coupon.validFrom).toLocaleDateString(getIntlLocale(i18n.language)) })
      }
      if (coupon.validUntil) {
        return tCommon('validUntil', { date: new Date(coupon.validUntil).toLocaleDateString(getIntlLocale(i18n.language)) })
      }
      return tCommon('validAlways')
    },
    [i18n.language, t],
  )

  // Get coupon status
  const getCouponStatus = useCallback((coupon: Coupon) => {
    if (!coupon.active) return 'inactive'
    const now = new Date()
    if (coupon.validUntil && new Date(coupon.validUntil) < now) return 'expired'
    if (coupon.validFrom && new Date(coupon.validFrom) > now) return 'scheduled'
    return 'active'
  }, [])

  // Get status badge variant
  const getStatusBadgeVariant = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'expired':
        return 'destructive'
      case 'scheduled':
        return 'outline'
      default:
        return 'secondary'
    }
  }, [])

  // Format discount display
  const formatDiscountValue = useCallback(
    (discount?: Discount) => {
      if (!discount) return '—'
      if (discount.type === 'PERCENTAGE') {
        return `${discount.value}% ${tCommon('off')}`
      } else if (discount.type === 'FIXED_AMOUNT') {
        return (
          new Intl.NumberFormat(getIntlLocale(i18n.language), {
            style: 'currency',
            currency: 'MXN',
          }).format(discount.value) + ` ${tCommon('off')}`
        )
      } else if (discount.type === 'COMP') {
        return '100%'
      }
      return discount.value.toString()
    },
    [i18n.language, t],
  )

  // Column definitions
  const columns: ColumnDef<Coupon>[] = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('coupons.list.columns.code')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
              <Ticket className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-mono font-medium">{row.original.code}</div>
              {row.original.discount && <div className="text-sm text-muted-foreground">{row.original.discount.name}</div>}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'discount',
        header: t('coupons.list.columns.discount'),
        cell: ({ row }) => <div className="font-medium">{formatDiscountValue(row.original.discount)}</div>,
      },
      {
        accessorKey: 'validFrom',
        header: t('coupons.list.columns.validPeriod'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatValidityPeriod(row.original)}</span>,
      },
      {
        accessorKey: 'currentUses',
        header: t('coupons.list.columns.uses'),
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.maxUses
              ? tCommon('usesFormat', { current: row.original.currentUses, max: row.original.maxUses })
              : tCommon('usesUnlimited', { current: row.original.currentUses })}
          </div>
        ),
      },
      {
        accessorKey: 'active',
        header: t('coupons.list.columns.status'),
        cell: ({ row }) => {
          const status = getCouponStatus(row.original)
          return <Badge variant={getStatusBadgeVariant(status)}>{t(`coupons.status.${status}`)}</Badge>
        },
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={5} className="w-48">
                <PermissionGate permission="coupons:update">
                  <DropdownMenuItem onClick={() => navigate(row.original.id)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('coupons.actions.edit')}
                  </DropdownMenuItem>
                </PermissionGate>
                <DropdownMenuSeparator />
                <PermissionGate permission="coupons:delete">
                  <DropdownMenuItem onClick={() => setDeletingCoupon(row.original)} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('coupons.actions.delete')}
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, tCommon, formatDiscountValue, formatValidityPeriod, getCouponStatus, getStatusBadgeVariant, navigate],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageTitleWithInfo
            title={t('coupons.title')}
            className="text-2xl font-bold"
            tooltip={t('info.coupons', {
              defaultValue: 'Crea y administra cupones vinculados a descuentos y su vigencia.',
            })}
          />
          <p className="text-muted-foreground">{t('coupons.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="coupons:create">
            <Dialog open={showBulkGenerate} onOpenChange={setShowBulkGenerate}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Layers className="h-4 w-4 mr-2" />
                  {t('coupons.actions.bulkGenerate')}
                </Button>
              </DialogTrigger>
              {showBulkGenerate && (
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t('coupons.bulkGenerate.title')}</DialogTitle>
                    <DialogDescription>{t('coupons.bulkGenerate.description')}</DialogDescription>
                  </DialogHeader>
                  <BulkGenerateDialog
                    venueId={venueId}
                    discounts={discounts}
                    onSuccess={() => {
                      setShowBulkGenerate(false)
                      queryClient.invalidateQueries({ queryKey: ['coupons', venueId] })
                    }}
                  />
                </DialogContent>
              )}
            </Dialog>
          </PermissionGate>

          <PermissionGate permission="coupons:create">
            <Button onClick={() => navigate('create')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('coupons.actions.create')}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={selectedDiscountId || 'all'} onValueChange={value => setSelectedDiscountId(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t('coupons.list.filters.allDiscounts')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('coupons.list.filters.allDiscounts')}</SelectItem>
            {discounts.map((discount: Discount) => (
              <SelectItem key={discount.id} value={discount.id}>
                {discount.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeFilter || 'all'} onValueChange={value => setActiveFilter(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('coupons.list.filters.allDiscounts')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('coupons.list.filters.allDiscounts')}</SelectItem>
            <SelectItem value="active">{t('coupons.list.filters.active')}</SelectItem>
            <SelectItem value="inactive">{t('coupons.list.filters.inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        data={coupons}
        columns={columns}
        isLoading={isLoadingCoupons}
        pagination={pagination}
        setPagination={setPagination}
        tableId="coupons:list"
        rowCount={couponsData?.meta.totalCount || 0}
        enableSearch={true}
        searchPlaceholder={t('coupons.list.searchPlaceholder')}
        onSearch={handleSearch}
        clickableRow={row => ({ to: row.id })}
      />

      {/* Delete Coupon Alert */}
      {deletingCoupon && (
        <AlertDialog open={!!deletingCoupon} onOpenChange={() => setDeletingCoupon(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('coupons.delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('coupons.delete.description', {
                  code: deletingCoupon.code,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('coupons.delete.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteCouponMutation.mutate(deletingCoupon.id)}
                disabled={deleteCouponMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteCouponMutation.isPending ? tCommon('deleting') : t('coupons.delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
