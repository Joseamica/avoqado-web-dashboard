import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  getStockCountStatusBadge,
  getStockCountTypeLabel,
  stockCountService,
} from '@/services/stockCount.service'

/**
 * Stock Count Detail — READ-ONLY.
 * Shows the header info and a searchable table of counted items.
 */
export default function StockCountDetailPage() {
  const navigate = useNavigate()
  const { countId } = useParams<{ countId: string }>()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-count', venueId, countId],
    queryFn: () => stockCountService.get(venueId!, countId!),
    enabled: !!venueId && !!countId,
  })

  const count = data?.data

  const filteredItems = useMemo(() => {
    if (!count) return []
    if (!search) return count.items
    const term = search.toLowerCase()
    return count.items.filter(
      item =>
        item.productName.toLowerCase().includes(term) ||
        (item.sku ?? '').toLowerCase().includes(term) ||
        (item.gtin ?? '').toLowerCase().includes(term),
    )
  }, [count, search])

  const summary = useMemo(() => {
    if (!count) return { total: 0, matched: 0, mismatched: 0, totalDiff: 0 }
    const mismatched = count.items.filter(i => i.difference !== 0).length
    return {
      total: count.items.length,
      matched: count.items.length - mismatched,
      mismatched,
      totalDiff: count.items.reduce((sum, i) => sum + i.difference, 0),
    }
  }, [count])

  if (!venue) return null

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`${fullBasePath}/inventory/stock-counts`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Detalle del conteo</h1>
          <p className="text-sm text-muted-foreground">Vista de auditoría (solo lectura).</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              No se pudo cargar el conteo. Verifica el enlace o inténtalo de nuevo.
            </p>
          </CardContent>
        </Card>
      )}

      {count && (
        <>
          {/* Header card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</div>
                  <div className="mt-1 text-sm font-medium">
                    {format(new Date(count.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</div>
                  <div className="mt-1">
                    <Badge variant="outline" className="font-normal">
                      {getStockCountTypeLabel(count.type)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Estado</div>
                  <div className="mt-1">
                    {(() => {
                      const b = getStockCountStatusBadge(count.status)
                      return (
                        <Badge variant={b.variant} className={b.className}>
                          {b.label}
                        </Badge>
                      )
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Creado por
                  </div>
                  <div className="mt-1 text-sm font-medium">{count.createdBy ?? '—'}</div>
                </div>
              </div>

              {count.note && (
                <div className="mt-4 border-t pt-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Nota</div>
                  <p className="mt-1 text-sm">{count.note}</p>
                </div>
              )}

              {/* Summary */}
              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Artículos</div>
                  <div className="mt-1 text-lg font-semibold">{summary.total}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Coinciden
                  </div>
                  <div className="mt-1 text-lg font-semibold text-muted-foreground">
                    {summary.matched}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Con diferencia
                  </div>
                  <div className="mt-1 text-lg font-semibold">{summary.mismatched}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Diferencia total
                  </div>
                  <div
                    className={`mt-1 text-lg font-semibold ${
                      summary.totalDiff === 0
                        ? 'text-muted-foreground'
                        : summary.totalDiff > 0
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {summary.totalDiff > 0 ? '+' : ''}
                    {summary.totalDiff}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search + items table */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Artículos contados</h2>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o SKU"
                    className="h-9 pl-8 pr-8"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          {search ? 'No hay coincidencias.' : 'No hay artículos en este conteo.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map(item => {
                        const diff = item.difference
                        const diffClass =
                          diff === 0
                            ? 'text-muted-foreground'
                            : diff > 0
                            ? 'text-green-700 dark:text-green-400 font-medium'
                            : 'text-red-700 dark:text-red-400 font-medium'
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.sku ?? '—'}
                            </TableCell>
                            <TableCell className="text-right">{item.expected}</TableCell>
                            <TableCell className="text-right">{item.counted}</TableCell>
                            <TableCell className={`text-right ${diffClass}`}>
                              {diff > 0 ? '+' : ''}
                              {diff}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
