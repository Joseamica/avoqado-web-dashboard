import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Ban, Search, X } from 'lucide-react'

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
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { getStockCountStatusBadge, getStockCountTypeLabel, stockCountService } from '@/services/stockCount.service'
import { includesNormalized } from '@/lib/utils'
import { colorDeDiferencia, etiquetaDeUnidad, formatearCantidad, formatearDiferencia } from './resumen'

/**
 * El motivo que el SERVIDOR construyó, si la respuesta lo trae (patrón del repo:
 * `Teams.tsx`, `ShiftPlanner.tsx`). Devuelve `undefined` —no una cadena vacía— cuando
 * no hay nada que decir, para que el toast no pinte una descripción en blanco.
 */
function mensajeDelServidor(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data
  const texto = data?.message ?? data?.error
  return typeof texto === 'string' && texto.trim() !== '' ? texto : undefined
}

/**
 * Stock Count Detail — lectura, más «cancelar el borrador».
 * Lo que enseña sale del `summary` del SERVIDOR: sólo cuenta lo que alguien contó.
 */
export default function StockCountDetailPage() {
  const navigate = useNavigate()
  const { countId } = useParams<{ countId: string }>()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  const [search, setSearch] = useState('')
  const { t, i18n } = useTranslation('inventory')
  const locale = i18n.language
  const { can } = useAccess()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-count', venueId, countId],
    queryFn: () => stockCountService.get(venueId!, countId!),
    enabled: !!venueId && !!countId,
  })

  const count = data?.data

  const filteredItems = useMemo(() => {
    if (!count) return []
    if (!search) return count.items
    return count.items.filter(
      item =>
        includesNormalized(item.productName ?? '', search) ||
        includesNormalized(item.sku ?? '', search) ||
        includesNormalized(item.gtin ?? '', search),
    )
  }, [count, search])

  // El resumen lo calcula el servidor con la regla única: sólo líneas contadas.
  // Aquí no se resta nada — sumar `difference` de líneas sin contar reportaba la
  // bodega entera como faltante (Mindform, 2026-09-07).
  const summary = count?.summary

  const cancelMutation = useMutation({
    mutationFn: () => stockCountService.cancel(venueId!, countId!),
    onSuccess: () => toast({ title: t('stockCounts.cancel.success') }),
    // 🔴 El servidor distingue TRES motivos de 409 —«ya estaba cancelado», «se está
    // aplicando al inventario; espera a que termine», «un conteo completado no se puede
    // cancelar: ya ajustó el inventario»— y cada uno pide algo distinto del gerente.
    // Tragárselos para decir siempre «No se pudo cancelar el conteo» lo deja sin saber
    // qué pasó. El título traducido se conserva; el motivo va como descripción.
    onError: error => toast({ title: t('stockCounts.cancel.error'), description: mensajeDelServidor(error), variant: 'destructive' }),
    // 🔴 Se relee SIEMPRE, no sólo al ganar: un 409 significa que el estado real cambió
    // por debajo (un cajero confirmó desde el POS con el detalle abierto). Sin esta
    // relectura la pantalla se queda «En progreso» con su botón y el gerente reintenta
    // en bucle contra algo que el servidor ya rechazó.
    onSettled: () => {
      setCancelOpen(false)
      // La misma llave con la que se leyó, y el prefijo de la lista (sin los filtros).
      void queryClient.invalidateQueries({ queryKey: ['stock-count', venueId, countId] })
      void queryClient.invalidateQueries({ queryKey: ['stock-counts', venueId] })
    },
  })
  const puedeCancelar = count?.status === 'IN_PROGRESS' && can('inventory:update')

  if (!venue) return null

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${fullBasePath}/inventory/stock-counts`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Detalle del conteo</h1>
          <p className="text-sm text-muted-foreground">Vista de auditoría (solo lectura).</p>
        </div>
        {puedeCancelar && (
          <Button variant="outline" className="ml-auto" onClick={() => setCancelOpen(true)} data-tour="stock-count-cancel-btn">
            <Ban className="mr-2 h-4 w-4" />
            {t('stockCounts.cancel.button')}
          </Button>
        )}
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
            <p className="text-sm text-destructive">No se pudo cargar el conteo. Verifica el enlace o inténtalo de nuevo.</p>
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
                  <div className="mt-1 text-sm font-medium">{format(new Date(count.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}</div>
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
                    {count.status === 'CANCELLED' && count.cancelledAt && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('stockCounts.cancelledOn', { date: format(new Date(count.cancelledAt), 'dd MMM yyyy, HH:mm', { locale: es }) })}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Creado por</div>
                  <div className="mt-1 text-sm font-medium">{count.createdBy ?? '—'}</div>
                </div>
              </div>

              {count.note && (
                <div className="mt-4 border-t pt-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Nota</div>
                  <p className="mt-1 text-sm">{count.note}</p>
                </div>
              )}

              {/* Summary — sólo lo contado cuenta */}
              {summary && (
                <div className="mt-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('stockCounts.counted')}</div>
                      <div className="mt-1 text-lg font-semibold">
                        {t('stockCounts.countedOf', { counted: summary.countedCount, total: summary.itemCount })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('stockCounts.matched')}</div>
                      <div className="mt-1 text-lg font-semibold text-muted-foreground">
                        {summary.countedCount === 0 ? '—' : summary.matchedCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('stockCounts.mismatched')}</div>
                      <div className="mt-1 text-lg font-semibold">{summary.countedCount === 0 ? '—' : summary.mismatchedCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('stockCounts.difference')}</div>
                      {summary.countedCount === 0 ? (
                        <div className="mt-1 text-lg font-semibold text-muted-foreground">{t('stockCounts.notCounted')}</div>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-x-3 text-lg font-semibold">
                          {summary.differenceByUnit.map(d => (
                            <span key={d.unit} className={colorDeDiferencia(d.difference)}>
                              {`${formatearDiferencia(d.difference, locale)} ${etiquetaDeUnidad(t, d.unit)}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {summary.countedCount === 0 && <p className="mt-3 text-sm text-muted-foreground">{t('stockCounts.nothingCountedYet')}</p>}
                </div>
              )}
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
                        const unidad = item.unit ? ` ${etiquetaDeUnidad(t, item.unit)}` : ''
                        const contada = item.countedAt !== null
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-muted-foreground">{item.sku ?? '—'}</TableCell>
                            <TableCell className="text-right">{`${formatearCantidad(item.expected, locale)}${unidad}`}</TableCell>
                            <TableCell className={`text-right ${contada ? '' : 'text-muted-foreground'}`}>
                              {contada ? `${formatearCantidad(item.counted, locale)}${unidad}` : t('stockCounts.notCounted')}
                            </TableCell>
                            <TableCell className={`text-right ${contada ? colorDeDiferencia(item.difference) : 'text-muted-foreground'}`}>
                              {contada ? `${formatearDiferencia(item.difference, locale)}${unidad}` : t('stockCounts.notCounted')}
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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stockCounts.cancel.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('stockCounts.cancel.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>{t('common:cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {t('stockCounts.cancel.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
