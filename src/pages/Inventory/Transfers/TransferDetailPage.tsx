import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-react'

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
  getTransferStatusBadge,
  inventoryTransferService,
} from '@/services/inventoryTransfer.service'
import { includesNormalized } from '@/lib/utils'

/**
 * Transfer Detail — READ-ONLY.
 */
export default function TransferDetailPage() {
  const navigate = useNavigate()
  const { transferId } = useParams<{ transferId: string }>()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inventory-transfer', venueId, transferId],
    queryFn: () => inventoryTransferService.get(venueId!, transferId!),
    enabled: !!venueId && !!transferId,
  })

  const transfer = data?.data

  const filteredItems = useMemo(() => {
    if (!transfer) return []
    if (!search) return transfer.items
    return transfer.items.filter(item => includesNormalized(item.productName ?? '', search))
  }, [transfer, search])

  const totalQuantity = useMemo(() => {
    if (!transfer) return 0
    return transfer.items.reduce((sum, i) => sum + (i.quantity || 0), 0)
  }, [transfer])

  if (!venue) return null

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`${fullBasePath}/inventory/transfers`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Detalle de transferencia</h1>
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
              No se pudo cargar la transferencia. Verifica el enlace o inténtalo de nuevo.
            </p>
          </CardContent>
        </Card>
      )}

      {transfer && (
        <>
          <Card>
            <CardContent className="pt-6">
              {/* Route */}
              <div className="mb-4 flex flex-wrap items-center gap-3 text-base">
                <span className="font-semibold">{transfer.fromLocationName}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{transfer.toLocationName}</span>
                <span className="ml-auto">
                  {(() => {
                    const b = getTransferStatusBadge(transfer.status)
                    return (
                      <Badge variant={b.variant} className={b.className}>
                        {b.label}
                      </Badge>
                    )
                  })()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t pt-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</div>
                  <div className="mt-1 text-sm font-medium">
                    {format(new Date(transfer.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Creado por
                  </div>
                  <div className="mt-1 text-sm font-medium">{transfer.createdByName ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Artículos
                  </div>
                  <div className="mt-1 text-lg font-semibold">{transfer.items.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cantidad total
                  </div>
                  <div className="mt-1 text-lg font-semibold">{totalQuantity}</div>
                </div>
              </div>

              {transfer.notes && (
                <div className="mt-4 border-t pt-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Notas</div>
                  <p className="mt-1 text-sm">{transfer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Artículos transferidos</h2>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto"
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
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                          {search ? 'No hay coincidencias.' : 'No hay artículos en esta transferencia.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <TableRow key={`${item.productId}-${idx}`}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))
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
