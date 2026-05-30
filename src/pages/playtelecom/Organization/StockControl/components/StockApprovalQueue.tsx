import { useState, useCallback } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAccess } from '@/hooks/use-access'
import { IccidBadge } from './IccidBadge'
import { useStockApprovals, useApproveStock, type StockApprovalItem } from '../hooks/useStockApprovals'

interface Props {
  orgId: string
}

type CustodyState = StockApprovalItem['custodyState']

function custodyLabel(state: CustodyState): string {
  switch (state) {
    case 'ADMIN_HELD':
      return 'En almacén'
    case 'SUPERVISOR_HELD':
      return 'Con supervisor'
    case 'PROMOTER_HELD':
      return 'Con promotor'
    case 'PROMOTER_PENDING':
      return 'Pendiente promotor'
    case 'PROMOTER_REJECTED':
      return 'Rechazado promotor'
    default:
      return state
  }
}

function custodyPill(state: CustodyState) {
  const label = custodyLabel(state)
  switch (state) {
    case 'ADMIN_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          {label}
        </Badge>
      )
    case 'SUPERVISOR_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
          {label}
        </Badge>
      )
    case 'PROMOTER_HELD':
      return (
        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          {label}
        </Badge>
      )
    case 'PROMOTER_PENDING':
      return (
        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
          {label}
        </Badge>
      )
    case 'PROMOTER_REJECTED':
      return (
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
          {label}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {label}
        </Badge>
      )
  }
}

export function StockApprovalQueue({ orgId }: Props) {
  const { can } = useAccess()
  const canAct = can('sim-custody:approve-registration')

  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useStockApprovals(orgId, { search })
  const approve = useApproveStock(orgId)

  const allItems: StockApprovalItem[] = data?.pages.flatMap(p => p.items) ?? []

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setSearch(draftSearch.trim())
        setSelected(new Set())
      }
    },
    [draftSearch],
  )

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const allVisibleIds = allItems.map(i => i.id)
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id))

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allVisibleIds))
    }
  }, [allVisibleSelected, allVisibleIds])

  const handleApproveSingle = useCallback(
    (id: string) => {
      approve.mutate({ serializedItemIds: [id] })
    },
    [approve],
  )

  const handleApproveBulk = useCallback(() => {
    if (selected.size === 0) return
    approve.mutate({ serializedItemIds: Array.from(selected) }, {
      onSuccess: () => setSelected(new Set()),
    })
  }, [selected, approve])

  // ─── Loading skeletons ───
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  // ─── Empty state ───
  if (!isLoading && allItems.length === 0) {
    return (
      <div className="space-y-3">
        {/* Search bar even in empty state so user can clear filter */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por ICCID… (Enter)"
            value={draftSearch}
            onChange={e => setDraftSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="max-w-xs"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftSearch('')
                setSearch('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
        <GlassCard className="p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay SIMs pendientes de aprobación</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <Input
          placeholder="Buscar por ICCID… (Enter)"
          value={draftSearch}
          onChange={e => setDraftSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="max-w-xs"
        />
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraftSearch('')
              setSearch('')
              setSelected(new Set())
            }}
          >
            Limpiar
          </Button>
        )}
        {canAct && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all-approvals"
              />
              <span>Seleccionar todos ({allItems.length})</span>
            </label>
            {selected.size > 0 && (
              <Button
                size="sm"
                onClick={handleApproveBulk}
                disabled={approve.isPending}
              >
                {approve.isPending ? 'Aprobando…' : `Aprobar seleccionados (${selected.size})`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {canAct && <th className="w-10 px-3 py-2" />}
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">ICCID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Categoría</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sucursal origen</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado actual</th>
                {canAct && <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {allItems.map(item => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  {canAct && (
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                        id={`approval-${item.id}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <IccidBadge value={item.serialNumber} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {item.category?.name ?? <span className="italic">Sin categoría</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {item.registeredFromVenue?.name ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {custodyPill(item.custodyState)}
                  </td>
                  {canAct && (
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveSingle(item.id)}
                        disabled={approve.isPending}
                      >
                        Aprobar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  )
}
