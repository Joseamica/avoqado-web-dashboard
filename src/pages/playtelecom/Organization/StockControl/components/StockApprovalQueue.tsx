import { useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { IccidBadge } from './IccidBadge'
import { useStockApprovals, useApproveStock, type StockApprovalItem } from '../hooks/useStockApprovals'

interface Props {
  orgId: string
}

type CustodyState = StockApprovalItem['custodyState']

function custodyPill(state: CustodyState) {
  switch (state) {
    case 'ADMIN_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          En almacén
        </Badge>
      )
    case 'SUPERVISOR_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
          Con supervisor
        </Badge>
      )
    case 'PROMOTER_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          Con promotor
        </Badge>
      )
    case 'PROMOTER_PENDING':
      return (
        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
          Pendiente
        </Badge>
      )
    case 'PROMOTER_REJECTED':
      return (
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
          Rechazado
        </Badge>
      )
  }
}

export function StockApprovalQueue({ orgId }: Props) {
  const { can } = useAccess()
  const canApprove = can('sim-custody:approve-registration')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useStockApprovals(orgId, search)
  const approve = useApproveStock(orgId)

  const items = data?.pages.flatMap(p => p.items) ?? []

  const allVisibleIds = items.map(i => i.id)
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allVisibleIds))
    }
  }

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleApproveSelected = () => {
    const ids = Array.from(selected)
    approve.mutate(ids, {
      onSuccess: () => setSelected(new Set()),
    })
  }

  const handleApproveOne = (id: string) => {
    approve.mutate([id])
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <Input
        placeholder="Buscar por ICCID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Bulk toolbar */}
      {canApprove && items.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Seleccionar todos"
            />
            Seleccionar todos (visibles)
          </label>
          <Button
            size="sm"
            onClick={handleApproveSelected}
            disabled={selected.size === 0 || approve.isPending}
          >
            {approve.isPending ? 'Aprobando…' : `Aprobar seleccionados (${selected.size})`}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !isLoading && (
        <GlassCard className="p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay SIMs pendientes de aprobación</p>
        </GlassCard>
      )}

      {/* Table rows */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-border/50 px-4 py-3 text-sm"
            >
              {canApprove && (
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                  aria-label={`Seleccionar ${item.serialNumber}`}
                />
              )}
              <IccidBadge value={item.serialNumber} className="shrink-0" />
              <span className="text-muted-foreground">{item.category?.name ?? '—'}</span>
              <span className="text-muted-foreground">{item.registeredFromVenue?.name ?? '—'}</span>
              <span>{custodyPill(item.custodyState)}</span>
              {canApprove && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto shrink-0"
                  onClick={() => handleApproveOne(item.id)}
                  disabled={approve.isPending}
                >
                  Aprobar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  )
}
