import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DateTime } from 'luxon'
import { AlertTriangle, Download, Info, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SummaryCards } from '@/components/SummaryCards'
import { SummaryQueryBoundary } from '@/components/SummaryQueryBoundary'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useGiftCardAging, useGiftCardPendingAccounting, useGiftCardSummary } from '@/hooks/use-gift-cards'
import { useToast } from '@/hooks/use-toast'
import { downloadGiftCardBalancesCsv } from '@/services/giftCard.service'
import { monto } from '@/pages/StaffPay/conSigno'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import type { PendingAccountingKind, PendingAccountingRow } from '@/types/giftCard'
import { avisoDeError, esIdiomaEspanol } from '../giftCardText'

const hoyEn = (zona: string) => DateTime.now().setZone(zona).toISODate() ?? ''
const inicioDeMesEn = (zona: string) => DateTime.now().setZone(zona).startOf('month').toISODate() ?? ''
/** Orden fijo de los totales por tipo (D5 r1, I2): venta y su cancelación (pasivo), pago con saldo y su reverso (canje). */
const TIPOS_DE_PENDIENTE: readonly PendingAccountingKind[] = ['VENTA_DE_TARJETAS', 'CANCELACION_DE_VENTA', 'COBRO_CON_SALDO', 'REVERSO_DE_SALDO']

function ErrorConReintento({ texto, onRetry }: { texto: string; onRetry: () => void }) {
  const { t } = useTranslation('giftCards')
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {texto}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('reports.retry')}
      </Button>
    </div>
  )
}

/**
 * Reportes para el contador (spec §7): resumen del periodo, saldo vivo a una fecha por antigüedad, pendientes de revisión
 * contable y exportar saldos. Todo sale de endpoints AGREGADOS o paginados del server: nada se suma en el navegador y un
 * error nunca se ve como $0 (SummaryQueryBoundary). Las fechas son días del negocio (`YYYY-MM-DD` en su zona; el server
 * convierte). El CSV se pide sólo tras el clic. Con datos ya cargados, una relectura que falla deja los datos a la vista; un
 * error sin `code` dice el texto genérico de su sección, nunca el `message` crudo (notas 10 y 12 del coordinador).
 */
export function GiftCardReports({ venueId }: { venueId: string }) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { fullBasePath } = useCurrentVenue()
  const { venueTimezone, formatDateTime } = useVenueDateTime()
  const [desde, setDesde] = useState(() => inicioDeMesEn(venueTimezone))
  const [hasta, setHasta] = useState(() => hoyEn(venueTimezone))
  const [al, setAl] = useState(() => hoyEn(venueTimezone))
  const rangoValido = desde !== '' && hasta !== '' && desde <= hasta
  const from = rangoValido ? desde : ''
  const to = rangoValido ? hasta : ''
  const summary = useGiftCardSummary(venueId, from, to)
  const aging = useGiftCardAging(venueId, al)
  const pending = useGiftCardPendingAccounting(venueId, from, to)
  const [bajando, setBajando] = useState(false)

  const s = summary.data
  const tarjetas = useMemo(
    () =>
      s
        ? [
            { label: t('reports.cards.sold', { count: s.sold.cards }), value: Currency(s.sold.amount) },
            // «Usadas» = canjes del periodo, netos de reversos (C4 `redeemed.net`).
            { label: t('reports.cards.used', { count: s.redeemed.movements }), value: Currency(s.redeemed.net) },
            { label: t('reports.cards.cancelled', { count: s.cancelled.cards }), value: Currency(s.cancelled.amount) },
            { label: t('reports.cards.live', { count: s.liveBalance.cards }), value: Currency(s.liveBalance.amount) },
          ]
        : [],
    [s, t],
  )

  // Las ventas de tarjetas devueltas enteras salen con su cancelación (netean $0): el server las lista a propósito (nota 3).
  const pendientes = useMemo<PendingAccountingRow[]>(() => {
    const vistos = new Set<string>()
    const filas: PendingAccountingRow[] = []
    for (const p of pending.data?.pages ?? []) {
      for (const r of p.items) {
        if (vistos.has(r.paymentId)) continue
        vistos.add(r.paymentId)
        filas.push(r)
      }
    }
    return filas
  }, [pending.data])
  const paginasPendientes = pending.data?.pages
  const ultimaPendiente = paginasPendientes && paginasPendientes.length > 0 ? paginasPendientes[paginasPendientes.length - 1] : undefined

  const descargar = async () => {
    if (bajando) return
    setBajando(true)
    try {
      await downloadGiftCardBalancesCsv(venueId, `saldos-tarjetas-de-regalo-${hoyEn(venueTimezone)}.csv`)
    } catch (err) {
      toast({ title: t('reports.export.error'), description: avisoDeError(err, t), variant: 'destructive' })
    } finally {
      setBajando(false)
    }
  }

  return (
    <div className="space-y-8" data-tour="gift-cards-reports">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="gift-reports-from">{t('reports.from')}</Label>
            <Input id="gift-reports-from" type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-[170px]" data-tour="gift-cards-reports-from" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gift-reports-to">{t('reports.to')}</Label>
            <Input id="gift-reports-to" type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-[170px]" data-tour="gift-cards-reports-to" />
          </div>
        </div>
        {!rangoValido && (
          <p role="alert" className="text-sm text-destructive">
            {t('reports.rangeError')}
          </p>
        )}
        <h2 className="text-base font-semibold">{t('reports.summaryTitle')}</h2>
        <SummaryQueryBoundary
          isLoading={rangoValido && summary.isLoading}
          isError={summary.isError && !s}
          message={avisoDeError(summary.error, t, 'reports.summaryError')}
          retryLabel={t('reports.retry')}
          onRetry={() => void summary.refetch()}
        >
          {s && (
            <>
              <SummaryCards cards={tarjetas} />
              <p className="mt-2 text-sm text-muted-foreground">
                {t('reports.adjustments', {
                  up: Currency(s.adjustments.increments),
                  down: Currency(s.adjustments.decrements),
                })}
              </p>
            </>
          )}
        </SummaryQueryBoundary>
      </section>

      <section className="space-y-3" data-tour="gift-cards-aging">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('reports.aging.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('reports.aging.help')}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gift-reports-at">{t('reports.aging.at')}</Label>
            <Input id="gift-reports-at" type="date" value={al} onChange={e => setAl(e.target.value)} className="w-[170px]" />
          </div>
        </div>
        {al === '' ? (
          <p className="text-sm text-muted-foreground">{t('reports.aging.pickDate')}</p>
        ) : aging.isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : aging.isError && !aging.data ? (
          <ErrorConReintento texto={avisoDeError(aging.error, t, 'reports.aging.error')} onRetry={() => void aging.refetch()} />
        ) : (
          aging.data && (
            <div className="overflow-x-auto rounded-lg border border-input">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">{t('reports.aging.columns.age')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('reports.aging.columns.cards')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('reports.aging.columns.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Saldo y antigüedad al corte, sin columna de «vencido»: se retiró de la 1a (auditoría r1, C-4). */}
                  {aging.data.buckets.map(b => (
                    <tr key={b.bucket} className="border-b border-input last:border-0">
                      <td className="px-4 py-2">{t(`reports.aging.buckets.${b.bucket}`)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.cards}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Currency(b.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-medium">
                    <td className="px-4 py-2">{t('reports.aging.total')}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{aging.data.total.cards}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Currency(aging.data.total.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      <section className="space-y-3" data-tour="gift-cards-pending-accounting">
        <div>
          <h2 className="text-base font-semibold">{t('reports.pending.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('reports.pending.help')}</p>
        </div>
        {/* Con el rango inválido no se enseñan los pendientes del rango anterior (`keepPreviousData`). */}
        {!rangoValido ? null : pending.isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : pending.isError && pendientes.length === 0 ? (
          <ErrorConReintento texto={avisoDeError(pending.error, t, 'reports.pending.error')} onRetry={() => void pending.refetch()} />
        ) : pendientes.length === 0 ? (
          !pending.isPlaceholderData && <p className="text-sm text-muted-foreground">{t('reports.pending.empty')}</p>
        ) : (
          <>
            {/* El aviso al contador es del server (qué falta registrar a mano y qué ya está en libros) y lo escribe en español: con el
                panel en español se enseña tal cual; en otro idioma, su traducción fija (`reports.pending.notice`: si el server cambia su
                texto, se cambia también esa llave). */}
            {ultimaPendiente?.notice && (
              <Alert className="border-input bg-muted/40" data-tour="gift-cards-pending-notice">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">{esIdiomaEspanol() ? ultimaPendiente.notice : t('reports.pending.notice')}</AlertDescription>
              </Alert>
            )}
            {/* Mientras llega el rango nuevo (`keepPreviousData`), lo del rango anterior se ve atenuado y no se toca (M4). */}
            <div
              className={cn('rounded-lg border border-input transition-opacity', pending.isPlaceholderData && 'pointer-events-none opacity-60')}
              aria-busy={pending.isPlaceholderData}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label={t('reports.pending.title')}>
                  <thead>
                    <tr className="border-b border-input text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">{t('reports.pending.columns.date')}</th>
                      <th className="px-4 py-2 text-left font-medium">{t('reports.pending.columns.kind')}</th>
                      <th className="px-4 py-2 text-left font-medium">{t('reports.pending.columns.folio')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('reports.pending.columns.amount')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('reports.pending.columns.tip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map(r => (
                      <tr key={r.paymentId} className="border-b border-input last:border-0">
                        <td className="px-4 py-2">{formatDateTime(r.createdAt)}</td>
                        <td className="px-4 py-2">{t(`reports.pending.kind.${r.kind}`)}</td>
                        <td className="px-4 py-2">
                          <Link className="underline underline-offset-4 hover:text-foreground" to={`${fullBasePath}/orders/${r.order.id}`}>
                            {r.order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{monto(r.amount)}</td>
                        {/* La propina también salió del saldo (o regresó a él): campo del server, sin sumar en el panel (I3). */}
                        <td className="px-4 py-2 text-right tabular-nums">{r.tipAmount !== 0 ? monto(r.tipAmount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                {/* Totales POR TIPO, tal como los manda el server (D5 r1, I2): venta de tarjetas (pasivo) y pago con saldo (canje)
                    no se suman entre sí, porque su suma no es pasivo, ni ingreso, ni caja. */}
                {ultimaPendiente && (
                  <div className="space-y-0.5">
                    <p>{t('reports.pending.totals', { count: ultimaPendiente.total })}</p>
                    <ul className="space-y-0.5">
                      {TIPOS_DE_PENDIENTE.filter(k => ultimaPendiente.totals[k].count > 0).map(k => {
                        const x = ultimaPendiente.totals[k]
                        const valores = { kind: t(`reports.pending.kind.${k}`), n: x.count, amount: monto(x.amount) }
                        return (
                          <li key={k} className="tabular-nums">
                            {x.tipAmount !== 0
                              ? t('reports.pending.byKindWithTip', { ...valores, tip: monto(x.tipAmount) })
                              : t('reports.pending.byKind', valores)}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {pending.isFetchNextPageError && <span className="text-destructive">{t('reports.pending.loadMoreError')}</span>}
                  {pending.hasNextPage && (
                    <Button variant="outline" size="sm" onClick={() => void pending.fetchNextPage()} disabled={pending.isFetchingNextPage}>
                      {t('reports.pending.loadMore')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-input bg-card p-6">
        <div>
          <h2 className="text-base font-semibold">{t('reports.export.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('reports.export.help')}</p>
        </div>
        <Button onClick={() => void descargar()} disabled={bajando} data-tour="gift-cards-export">
          {bajando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          {t('reports.export.button')}
        </Button>
      </section>
    </div>
  )
}
