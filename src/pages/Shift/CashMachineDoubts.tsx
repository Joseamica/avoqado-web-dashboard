/**
 * Máquina de efectivo · fase 1a · B2 (plan `2026-11-20-maquina-de-efectivo-fase-1a.md`, R4-4): «Cobros de la máquina en duda».
 * La PC de la máquina no supo cómo terminó un cobro y lo subió como duda; aquí un gerente (`cash-machine:resolve`) lo resuelve con
 * lo que ve en la máquina. Lista ACOTADA del SERVIDOR (≤ 100 por página, más nuevas primero) con el total y «Cargar más» por cursor:
 * nunca se recorta en silencio. La PC se entera sola de la resolución en su siguiente consulta.
 */
import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { ResolveCashMachineDoubtDialog, cashMachineDoubtsKey, type CashMachineDoubt } from './components/ResolveCashMachineDoubtDialog'

const PAGE_SIZE = 50

interface DoubtsPage {
  data: CashMachineDoubt[]
  total: number
  nextCursor: string | null
}

export default function CashMachineDoubts() {
  const { t } = useTranslation('shifts')
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const [abierta, setAbierta] = useState<CashMachineDoubt | null>(null)

  const query = useInfiniteQuery({
    queryKey: cashMachineDoubtsKey(venueId ?? ''),
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/cash-machine/doubts`, {
        params: { status: 'ABIERTO', limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
      })
      return res.data as DoubtsPage
    },
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Deduplicadas por id: una duda nueva entre páginas no se dibuja dos veces.
  const filas = useMemo(() => {
    const porId = new Map<string, CashMachineDoubt>()
    for (const page of query.data?.pages ?? []) for (const d of page.data) if (!porId.has(d.id)) porId.set(d.id, d)
    return [...porId.values()]
  }, [query.data])
  const total = query.data?.pages[0]?.total ?? 0

  const carrito = (d: CashMachineDoubt) =>
    (d.pedido?.items ?? [])
      .map(i => (i.promotionRef ? t('cashMachineDoubts.promotionLine') : `${i.quantity ?? 1}× ${i.name ?? ''}`))
      .join(', ') || '—'

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="mb-2">
        <PageTitleWithInfo title={t('cashMachineDoubts.title')} className="text-xl font-semibold" tooltip={t('cashMachineDoubts.tooltip')} />
      </div>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{t('cashMachineDoubts.intro')}</p>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('cashMachineDoubts.loading')}</p>
      ) : query.isError && filas.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-input p-6">
          <p className="text-sm">{t('cashMachineDoubts.loadError')}</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            {t('cashMachineDoubts.retry')}
          </Button>
        </div>
      ) : filas.length === 0 ? (
        <div className="rounded-lg border border-input p-6 text-sm text-muted-foreground">{t('cashMachineDoubts.empty')}</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('cashMachineDoubts.showing', { shown: filas.length, total })}</p>
          <div className="rounded-lg border border-input">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cashMachineDoubts.columns.folio')}</TableHead>
                  <TableHead>{t('cashMachineDoubts.columns.startedAt')}</TableHead>
                  <TableHead className="text-right">{t('cashMachineDoubts.columns.sale')}</TableHead>
                  <TableHead className="text-right">{t('cashMachineDoubts.columns.tip')}</TableHead>
                  <TableHead className="text-right">{t('cashMachineDoubts.columns.due')}</TableHead>
                  <TableHead>{t('cashMachineDoubts.columns.cart')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.referenceCC}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(d.startedAt)}</TableCell>
                    <TableCell className="text-right">{Currency(d.saleCents, true)}</TableCell>
                    <TableCell className="text-right">{Currency(d.tipCents, true)}</TableCell>
                    <TableCell className="text-right font-medium">{Currency(d.dueCents, true)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={carrito(d)}>
                      {carrito(d)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setAbierta(d)} data-tour="cash-machine-doubt-resolve">
                        {t('cashMachineDoubts.resolveButton')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {t('cashMachineDoubts.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}

      {abierta && venueId && (
        <ResolveCashMachineDoubtDialog
          key={abierta.id}
          open
          onOpenChange={o => !o && setAbierta(null)}
          venueId={venueId}
          doubt={abierta}
        />
      )}
    </div>
  )
}
