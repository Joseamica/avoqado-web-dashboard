/**
 * Máquina de efectivo · fase 1a · B2 (plan `2026-11-20-maquina-de-efectivo-fase-1a.md`, R4-4): «Cobros de la máquina en duda».
 * La PC de la máquina no supo cómo terminó un cobro y lo subió como duda; aquí un gerente (`cash-machine:resolve`) lo resuelve con
 * lo que ve en la máquina. Lista ACOTADA del SERVIDOR (≤ 100 por página, más nuevas primero) con el total y «Cargar más» por cursor:
 * nunca se recorta en silencio. La PC se entera sola de la resolución en su siguiente consulta.
 * La MISMA lista trae también las incidencias abiertas que no son duda (Codex r1 #7: imposible, conflicto, sin registrar, tras
 * desemparejar), cada una con su `kind`: van en su propia tabla, de sólo lectura, con «Revisar» para marcarlas como revisadas.
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
import { cashMachineDoubtsKey } from '@/hooks/use-cash-machine-doubts'
import { ResolveCashMachineDoubtDialog, carritoDeLaDuda, type CashMachineDoubt } from './components/ResolveCashMachineDoubtDialog'
import { ReviewCashMachineIncidentDialog, type CashMachineIncident } from './components/ReviewCashMachineIncidentDialog'

const PAGE_SIZE = 50

type Fila = CashMachineDoubt | CashMachineIncident
const esDuda = (f: Fila): f is CashMachineDoubt => !f.kind || f.kind === 'ESPERANDO'

interface DoubtsPage {
  data: Fila[]
  total: number
  nextCursor: string | null
}

export default function CashMachineDoubts() {
  const { t } = useTranslation('shifts')
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const [abierta, setAbierta] = useState<CashMachineDoubt | null>(null)
  // Por id, no por copia: tras un 409 «llegó evidencia nueva» la lista se refresca y la ventana recibe la fila (y versión) nueva.
  const [revisandoId, setRevisandoId] = useState<string | null>(null)

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
    const porId = new Map<string, Fila>()
    for (const page of query.data?.pages ?? []) for (const d of page.data) if (!porId.has(d.id)) porId.set(d.id, d)
    return [...porId.values()]
  }, [query.data])
  const dudas = useMemo(() => filas.filter(esDuda), [filas])
  const incidencias = useMemo(() => filas.filter((f): f is CashMachineIncident => !esDuda(f)), [filas])
  const revisando = revisandoId ? incidencias.find(i => i.id === revisandoId) : undefined
  // La fila VIVA de la duda abierta: tras un 409 «llegó evidencia nueva» la lista se refresca y la ventana recibe la versión y lo que
  // vio la PC nuevos, sin perder lo tecleado (misma `key`). Si la duda ya salió de la lista, se queda con la última que se vio.
  const dudaAbierta = abierta ? (dudas.find(d => d.id === abierta.id) ?? abierta) : null
  const total = query.data?.pages[0]?.total ?? 0
  const tipo = (kind: string) => t(`cashMachineDoubts.incidents.kinds.${kind}.label`, { defaultValue: kind })

  const carrito = (d: CashMachineDoubt) => carritoDeLaDuda(d.pedido, t('cashMachineDoubts.promotionLine'))

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="mb-2">
        <PageTitleWithInfo
          title={t('cashMachineDoubts.title')}
          className="text-xl font-semibold"
          tooltip={t('cashMachineDoubts.tooltip')}
        />
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
          {dudas.length > 0 && (
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
                  {dudas.map(d => (
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
          )}
          {incidencias.length > 0 && (
            <section className="space-y-2" data-tour="cash-machine-incidents">
              <h2 className="text-base font-semibold">{t('cashMachineDoubts.incidents.heading')}</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">{t('cashMachineDoubts.incidents.intro')}</p>
              <div className="rounded-lg border border-input">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('cashMachineDoubts.columns.folio')}</TableHead>
                      <TableHead>{t('cashMachineDoubts.incidents.columns.kind')}</TableHead>
                      <TableHead>{t('cashMachineDoubts.incidents.columns.createdAt')}</TableHead>
                      <TableHead>{t('cashMachineDoubts.incidents.columns.times')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidencias.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.referenceCC}</TableCell>
                        <TableCell>{tipo(i.kind)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(i.createdAt)}</TableCell>
                        <TableCell>
                          {t('cashMachineDoubts.incidents.times', { count: i.veces ?? 1 })}
                          {(i.repetidas ?? 0) > 0 && ` · ${t('cashMachineDoubts.incidents.repeated', { count: i.repetidas })}`}
                          {(i.revisiones?.length ?? 0) > 0 &&
                            ` · ${t('cashMachineDoubts.incidents.reviewedBefore', { count: i.revisiones!.length })}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setRevisandoId(i.id)} data-tour="cash-machine-incident-review">
                            {t('cashMachineDoubts.incidents.reviewButton')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {t('cashMachineDoubts.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}

      {dudaAbierta && venueId && (
        <ResolveCashMachineDoubtDialog
          key={dudaAbierta.id}
          open
          onOpenChange={o => !o && setAbierta(null)}
          venueId={venueId}
          doubt={dudaAbierta}
        />
      )}
      {revisando && venueId && (
        <ReviewCashMachineIncidentDialog
          key={revisando.id}
          open
          onOpenChange={o => !o && setRevisandoId(null)}
          venueId={venueId}
          incident={revisando}
        />
      )}
    </div>
  )
}
