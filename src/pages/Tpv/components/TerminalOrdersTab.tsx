import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckboxFilterContent, FilterPill, FilterPillBar } from '@/components/filters'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import { formatMxnCents } from '@/config/tpvCatalog'
import {
  tpvOrderService,
  type TerminalOrder,
  type TerminalOrderFulfillmentStatus,
  type TerminalOrderPaymentStatus,
} from '@/services/tpvOrder.service'

const PAYMENT_STATUSES: TerminalOrderPaymentStatus[] = [
  'AWAITING_PAYMENT',
  'AWAITING_PROOF',
  'PROOF_UPLOADED',
  'PAID',
  'REJECTED',
  'EXPIRED',
  'REFUNDED',
]

const FULFILLMENT_STATUSES: TerminalOrderFulfillmentStatus[] = [
  'NEW',
  'AWAITING_SERIALS',
  'SERIALS_ASSIGNED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

const PAYMENT_STATUS_LABELS: Record<TerminalOrderPaymentStatus, string> = {
  AWAITING_PAYMENT: 'Esperando pago',
  AWAITING_PROOF: 'Esperando comprobante',
  PROOF_UPLOADED: 'Comprobante subido',
  PAID: 'Pagado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Expirado',
  REFUNDED: 'Reembolsado',
}

const FULFILLMENT_STATUS_LABELS: Record<TerminalOrderFulfillmentStatus, string> = {
  NEW: 'Nuevo',
  AWAITING_SERIALS: 'Pendiente de asignar',
  SERIALS_ASSIGNED: 'Listo para enviar',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

function paymentBadgeVariant(
  status: TerminalOrderPaymentStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PAID') return 'default'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'destructive'
  return 'secondary'
}

export function TerminalOrdersTab() {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation('common')
  const { venueId, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { formatDate } = useVenueDateTime()

  const [paymentFilter, setPaymentFilter] = useState<string[]>([])
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['tpv-orders', venueId],
    queryFn: () => tpvOrderService.listForVenue(venueId!),
    enabled: !!venueId,
  })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return orders.filter(o => {
      if (paymentFilter.length > 0 && !paymentFilter.includes(o.paymentStatus)) return false
      if (fulfillmentFilter.length > 0 && !fulfillmentFilter.includes(o.fulfillmentStatus)) return false
      if (q && !o.orderNumber.toLowerCase().includes(q)) return false
      return true
    })
  }, [orders, paymentFilter, fulfillmentFilter, debouncedSearch])

  const paymentOptions = useMemo(
    () =>
      PAYMENT_STATUSES.map(v => ({
        value: v,
        label: t(`orders.paymentStatus.${v}`, { defaultValue: PAYMENT_STATUS_LABELS[v] }),
      })),
    [t],
  )

  const fulfillmentOptions = useMemo(
    () =>
      FULFILLMENT_STATUSES.map(v => ({
        value: v,
        label: t(`orders.fulfillmentStatus.${v}`, { defaultValue: FULFILLMENT_STATUS_LABELS[v] }),
      })),
    [t],
  )

  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const opt = options.find(o => o.value === values[0])
      return opt?.label ?? values[0]
    }
    return t('orders.filters.nSelected', {
      count: values.length,
      defaultValue: `${values.length} seleccionados`,
    })
  }

  const resetFilters = useCallback(() => {
    setPaymentFilter([])
    setFulfillmentFilter([])
    setSearchTerm('')
  }, [])

  return (
    <div className="space-y-4 py-4">
      {/* Filters + search row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Expandable search */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('orders.search.placeholder', { defaultValue: 'Buscar pedidos…' })}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                  }}
                  className="h-7 w-[200px] pl-8 pr-7 text-xs rounded-full"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => {
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant={searchTerm ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          )}
          {searchTerm && !isSearchOpen && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        <FilterPillBar onReset={resetFilters} resetLabel={t('orders.filters.reset', { defaultValue: 'Borrar filtros' })}>
          <FilterPill
            label={t('orders.filters.payment', { defaultValue: 'Pago' })}
            activeValue={getFilterDisplayLabel(paymentFilter, paymentOptions)}
            isActive={paymentFilter.length > 0}
            onClear={() => setPaymentFilter([])}
          >
            <CheckboxFilterContent
              title={t('orders.filters.payment', { defaultValue: 'Pago' })}
              options={paymentOptions}
              selectedValues={paymentFilter}
              onApply={setPaymentFilter}
            />
          </FilterPill>
          <FilterPill
            label={t('orders.filters.fulfillment', { defaultValue: 'Cumplimiento' })}
            activeValue={getFilterDisplayLabel(fulfillmentFilter, fulfillmentOptions)}
            isActive={fulfillmentFilter.length > 0}
            onClear={() => setFulfillmentFilter([])}
          >
            <CheckboxFilterContent
              title={t('orders.filters.fulfillment', { defaultValue: 'Cumplimiento' })}
              options={fulfillmentOptions}
              selectedValues={fulfillmentFilter}
              onApply={setFulfillmentFilter}
            />
          </FilterPill>
        </FilterPillBar>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-input overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">
                {t('orders.columns.orderNumber', { defaultValue: 'Pedido' })}
              </th>
              <th className="text-left p-3 font-medium">
                {t('orders.columns.date', { defaultValue: 'Fecha' })}
              </th>
              <th className="text-left p-3 font-medium">
                {t('orders.columns.items', { defaultValue: 'Productos' })}
              </th>
              <th className="text-right p-3 font-medium">
                {t('orders.columns.total', { defaultValue: 'Total' })}
              </th>
              <th className="text-left p-3 font-medium">
                {t('orders.columns.method', { defaultValue: 'Método' })}
              </th>
              <th className="text-left p-3 font-medium">
                {t('orders.columns.status', { defaultValue: 'Estado' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  {tCommon('loading', { defaultValue: 'Cargando…' })}
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('orders.empty', { defaultValue: 'Sin pedidos para mostrar' })}
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((o: TerminalOrder) => {
                const totalUnits = o.items.reduce((s, i) => s + i.quantity, 0)
                return (
                  <tr
                    key={o.id}
                    className="border-t border-input cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`${fullBasePath}/tpv/orders/${o.id}`)}
                  >
                    <td className="p-3 font-mono">{o.orderNumber}</td>
                    <td className="p-3">{formatDate(o.createdAt)}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {o.items.length} ·{' '}
                        {t('orders.unitsCount', {
                          count: totalUnits,
                          defaultValue: `${totalUnits} u.`,
                        })}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{formatMxnCents(o.totalCents)} MXN</td>
                    <td className="p-3">
                      {o.paymentMethod === 'CARD_STRIPE'
                        ? t('orders.method.card', { defaultValue: 'Tarjeta' })
                        : t('orders.method.spei', { defaultValue: 'SPEI' })}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant={paymentBadgeVariant(o.paymentStatus)} className="w-fit">
                          {t(`orders.paymentStatus.${o.paymentStatus}`, {
                            defaultValue: PAYMENT_STATUS_LABELS[o.paymentStatus],
                          })}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t(`orders.fulfillmentStatus.${o.fulfillmentStatus}`, {
                            defaultValue: FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus],
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
