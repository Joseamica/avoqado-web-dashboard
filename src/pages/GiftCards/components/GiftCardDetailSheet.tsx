import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useGiftCardDetail } from '@/hooks/use-gift-cards'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import type { GiftCardActivityRow, GiftCardDetail } from '@/types/giftCard'
import { estadoVisible, montoDelMovimiento, notaVisible, avisoDeError, ultimos4, varianteDeEstado } from '../giftCardText'
import { GiftCardDelivery } from './GiftCardDelivery'
import { GiftCardManagerActions } from './GiftCardManagerActions'

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

/** Un renglón de la libreta tal como lo manda C4. `venta` = la cuenta que vendió ESTA tarjeta: su folio sólo se enseña en el
 *  renglón de esa cuenta (un canje en otra cuenta no trae su folio en la libreta). */
function Movimiento({ m, venta }: { m: GiftCardActivityRow; venta: GiftCardDetail['order'] }) {
  const { t } = useTranslation('giftCards')
  const { formatDateTime } = useVenueDateTime()
  const folio = venta && m.orderId === venta.id ? venta.orderNumber : null
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{t(`activity.${m.type}`)}</p>
        <p className="text-xs text-muted-foreground">
          {m.staff ? t('detail.whenBy', { date: formatDateTime(m.createdAt), name: m.staff.name }) : formatDateTime(m.createdAt)}
        </p>
        {m.reason && <p className="text-xs text-foreground">{t(`reason.${m.reason}`)}</p>}
        {m.note && <p className="break-words text-xs text-muted-foreground">{t('detail.note', { note: notaVisible(m.note, t) })}</p>}
        {folio && <p className="text-xs text-muted-foreground">{t('detail.inOrder', { folio })}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">{montoDelMovimiento(m.type, m.amount)}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{t('detail.balanceAfter', { amount: Currency(m.balanceAfter) })}</p>
      </div>
    </li>
  )
}

/**
 * Detalle de UNA tarjeta, de sólo lectura (un Sheet es válido para detalle; crear/editar va en FullScreenModal). Todo lo
 * que dice sale del server, con la forma de C4 tal cual (F3): el saldo, lo usado y el total de movimientos nunca se suman
 * en el navegador (la libreta viene paginada y la suma de lo cargado mentiría con «Ver más» pendiente), y el motivo del
 * bloqueo sale de `currentBlock` (auditoría r1, D-2), nunca de la libreta paginada. Del código sólo los últimos 4 (spec §4.1).
 * Con la tarjeta ya cargada, una relectura fallida (TanStack v5 conserva `data` y prende `isError`) NO la tapa: se avisa en
 * línea. Un error sin `code` enseña el texto genérico (notas 10 y 12 del coordinador), nunca el `message` crudo.
 */
export function GiftCardDetailSheet({ venueId, giftCardId, onClose }: { venueId: string; giftCardId: string; onClose: () => void }) {
  const { t } = useTranslation('giftCards')
  const { fullBasePath } = useCurrentVenue()
  const { formatDateTime, formatDate } = useVenueDateTime()
  const q = useGiftCardDetail(venueId, giftCardId)
  // La tarjeta, su venta, `cancel` y `currentBlock` salen de la PRIMERA página; las demás sólo traen más libreta.
  const primera = q.data?.pages[0]
  const card = primera
  const sale = primera?.order ?? null
  const movimientos = useMemo(() => {
    const vistos = new Set<string>()
    const filas: GiftCardActivityRow[] = []
    for (const p of q.data?.pages ?? []) {
      for (const m of p.activities.items) {
        if (vistos.has(m.id)) continue
        vistos.add(m.id)
        filas.push(m)
      }
    }
    return filas
  }, [q.data])
  const paginas = q.data?.pages
  const totalMovimientos = paginas && paginas.length > 0 ? paginas[paginas.length - 1].activities.total : 0
  const estado = card ? estadoVisible(card) : null

  return (
    <Sheet open onOpenChange={abierta => !abierta && onClose()}>
      <SheetContent hasTitle className="w-full overflow-y-auto sm:max-w-2xl" data-tour="gift-card-detail">
        <SheetHeader>
          <SheetTitle>{card ? t('detail.title', { last4: ultimos4(card.last4) }) : t('detail.loadingTitle')}</SheetTitle>
          <SheetDescription>{t('detail.subtitle')}</SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <div className="mt-6 space-y-3" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !card ? (
          q.isError && (
            <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">{t('detail.loadError')}</p>
                  <p className="text-muted-foreground">{avisoDeError(q.error, t)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void q.refetch()}>
                {t('detail.retry')}
              </Button>
            </div>
          )
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-input bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('detail.balance')}</p>
                  <p className="text-3xl font-semibold tabular-nums" data-tour="gift-card-detail-balance">
                    {Currency(card.balance)}
                  </p>
                  {/* Monto inicial y saldo actual, nada más: «lo usado» no lo manda el server (decisión 1 del coordinador). */}
                  <p className="mt-1 text-xs text-muted-foreground">{t('detail.ofInitial', { amount: Currency(card.initialAmount) })}</p>
                </div>
                {estado && <Badge variant={varianteDeEstado(estado)}>{t(`status.${estado}`)}</Badge>}
              </div>
              {/* El bloqueo VIGENTE lo manda el server (`currentBlock`, una consulta propia): aunque su BLOCK ya no esté en la
                  primera página de la libreta, el motivo se ve. */}
              {card.status === 'BLOCKED' && card.currentBlock?.reason && (
                <p className="mt-3 text-sm text-muted-foreground" data-tour="gift-card-blocked-reason">
                  {t('detail.blockedBecause', { reason: t(`reason.${card.currentBlock.reason}`) })}
                </p>
              )}
            </section>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dato label={t('detail.facts.soldAt')} value={formatDateTime(card.activatedAt ?? card.createdAt)} />
              <Dato label={t('detail.facts.expiresAt')} value={card.expiresAt ? formatDate(card.expiresAt) : t('list.noExpiry')} />
              <Dato label={t('detail.facts.recipient')} value={card.recipientName ?? t('list.noName')} />
              <Dato label={t('detail.facts.purchaser')} value={card.purchaserName ?? t('list.noName')} />
              <Dato label={t('detail.facts.customer')} value={card.customer?.name ?? t('detail.facts.notSaved')} />
              {/* 1b (E14): con `entrega` (S7), WhatsApp y correo dicen «canal · estado»: la 1b ya los envía de verdad. Los demás
                  canales —y un server sin S7, donde todo nace PENDING y nada lo mueve— sólo el canal: ahí el estado mentiría. */}
              <Dato
                label={t('detail.facts.delivery')}
                value={
                  card.storeCredit
                    ? t('detail.storeCreditOf', { name: card.storeCredit.customerName })
                    : card.entrega && (card.entrega.channel === 'WHATSAPP' || card.entrega.channel === 'EMAIL')
                    ? t('detail.facts.deliveryValue', {
                        channel: t(`delivery.${card.entrega.channel}`),
                        status: t(`deliveryStatus.${card.entrega.status}`),
                      })
                    : t(`delivery.${card.deliveryChannel}`)
                }
              />
              <Dato
                label={t('detail.facts.folio')}
                value={
                  sale ? (
                    <Link className="underline underline-offset-4 hover:text-foreground" to={`${fullBasePath}/orders/${sale.id}`}>
                      {sale.orderNumber}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              {/* Sin vigencia: «Sin vencimiento» a secas (el «(recomendado)» de Configuración no describe una tarjeta vendida). */}
              <Dato
                label={t('detail.facts.validity')}
                value={card.validityMonths == null ? t('list.noExpiry') : t(`settings.rules.validityOption.${String(card.validityMonths)}`)}
              />
            </dl>

            {/* 1b (E14, E15): cómo va la entrega (giftCards:read) y «Reenviar» / «Cambiar destino» (giftCards:manage adentro). */}
            {primera && <GiftCardDelivery venueId={venueId} detail={primera} />}

            {/* Sólo con giftCards:manage (PermissionGate adentro); el server vuelve a pedirlo. */}
            {primera && <GiftCardManagerActions venueId={venueId} detail={primera} />}

            <section>
              <h3 className="text-sm font-semibold">{t('detail.history')}</h3>
              <p className="text-xs text-muted-foreground">{t('detail.historyCount', { count: totalMovimientos })}</p>
              <ul className="mt-2 divide-y divide-input" data-tour="gift-card-history">
                {movimientos.map(m => (
                  <Movimiento key={m.id} m={m} venta={sale} />
                ))}
              </ul>
              {q.isError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {t('detail.loadMoreError')}
                </p>
              )}
              {q.hasNextPage && (
                <Button
                  variant="outline"
                  className="mt-3 w-full cursor-pointer"
                  disabled={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                  data-tour="gift-card-history-more"
                >
                  {q.isFetchingNextPage && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {t('detail.loadMore')}
                </Button>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
