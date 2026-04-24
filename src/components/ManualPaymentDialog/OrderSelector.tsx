import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getOrders } from '@/services/order.service'

export interface OrderOption {
  id: string
  orderNumber: string
  total: string | number
  paidAmount: string | number
  remainingBalance: string | number
  paymentStatus: string
  customerName?: string | null
}

/**
 * Searchable combobox for selecting an Order to attach a manual payment to.
 * Queries the backend orders list endpoint with a `search` filter, then
 * client-side filters out fully-paid orders (remainingBalance <= 0) since
 * paying those would be rejected by the server.
 *
 * If the user has no matches, they can't proceed — we intentionally do NOT
 * allow free-text IDs here because that was the whole UX problem we're fixing.
 */
export function OrderSelector({
  venueId,
  value,
  onChange,
}: {
  venueId: string
  value: OrderOption | null
  onChange: (order: OrderOption | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  // Debounce the search input so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['orders-selector', venueId, debounced],
    queryFn: () =>
      getOrders(
        venueId,
        { pageIndex: 0, pageSize: 20 },
        debounced ? { search: debounced } : undefined,
      ),
    enabled: open,
    staleTime: 10_000,
  })

  const options: OrderOption[] = useMemo(() => {
    const raw = (data?.data || data?.orders || data?.results || []) as any[]
    return raw
      .map(o => ({
        id: o.id,
        orderNumber: o.orderNumber || o.id,
        total: o.total,
        paidAmount: o.paidAmount ?? 0,
        remainingBalance: o.remainingBalance ?? o.total,
        paymentStatus: o.paymentStatus || 'PENDING',
        customerName: o.customerName || o.customer?.firstName
          ? `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim() || null
          : null,
      }))
      .filter(o => Number(o.remainingBalance) > 0 && o.paymentStatus !== 'PAID')
  }, [data])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          {value ? (
            <span className="truncate">
              {value.orderNumber}
              {value.customerName ? ` · ${value.customerName}` : ''}
              {` · pendiente $${Number(value.remainingBalance).toFixed(2)}`}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Busca por número de orden...
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por número de orden..." value={search} onValueChange={setSearch} />
          <CommandList>
            {(isLoading || isFetching) && (
              <div className="p-3 text-xs text-muted-foreground">Cargando órdenes...</div>
            )}
            {!isLoading && options.length === 0 && (
              <CommandEmpty>
                {debounced
                  ? 'Sin resultados con ese término. Prueba otro número.'
                  : 'No hay órdenes con saldo pendiente en este venue.'}
              </CommandEmpty>
            )}
            {options.length > 0 && (
              <CommandGroup heading="Órdenes con saldo pendiente">
                {options.map(o => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => {
                      onChange(o)
                      setOpen(false)
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', value?.id === o.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{o.orderNumber}</span>
                        <span className="text-xs text-muted-foreground shrink-0">${Number(o.remainingBalance).toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.customerName ? `${o.customerName} · ` : ''}
                        {o.paymentStatus} · total ${Number(o.total).toFixed(2)}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
