/**
 * BuyTpvStep — V2 wizard Step 9 (optional).
 *
 * View A: no order yet (catalog summary + CTA + skip link)
 * View B: order exists (chip with order details + "Terminar onboarding →")
 *
 * The actual purchase happens inside the existing TerminalPurchaseWizard
 * (FullScreenModal overlay). When `from="setup"`:
 *   - Card payments: Stripe Checkout's success_url routes back here via
 *     `/setup?tpv_status=success&orderId=X#step-8` (handled in SetupWizard).
 *   - SPEI payments: TerminalPurchaseWizard fires `onComplete(orderId)` and
 *     we transition this step to View B + persist tpvOrderId in step9.
 *
 * **Central invariant**: "Terminar onboarding →" is ALWAYS enabled regardless
 * of order state. Buying a TPV is optional and the user can complete onboarding
 * with a pending SPEI, a paid order, a shipped order, or a rejected order.
 *
 * Spec: ../../../../avoqado-server/docs/superpowers/specs/2026-05-29-onboarding-tpv-purchase-design.md
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { MapPin, ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TPV_CATALOG, formatMxnCents } from '@/config/tpvCatalog'
import { tpvOrderService } from '@/services/tpvOrder.service'
import { TerminalPurchaseWizard } from '@/pages/Tpv/components/purchase-wizard/TerminalPurchaseWizard'
import type { StepProps } from '../types'

interface BuyTpvStepProps extends StepProps {
  /** Provisional venue created by the backend's ensureVenueForOnboarding. */
  venueId?: string
  /**
   * Pre-existing TPV order id resolved from step9_tpvPurchase or the most-recent
   * fallback. When present, View B is rendered immediately on mount.
   */
  tpvOrderId?: string | null
}

// Catalog summary shown in View A. Mirrors the 3 active models in
// `tpvCatalog.ts`. Kept inline (not iterated from TPV_CATALOG.entries) so the
// order is deterministic and the marketing message stays human-curated.
const CATALOG_SUMMARY = [
  { key: 'PAX_A910S', label: 'PAX A910S' },
  { key: 'NEXGO_N62', label: 'NexGo N62' },
  { key: 'NEXGO_N86', label: 'NexGo N86' },
] as const

// Map raw payment+fulfillment status into a short human label + help text.
// Both fields live on TerminalOrder (paymentStatus, fulfillmentStatus). The
// "shown" state is derived from whichever signal is most informative for the
// user right now — payment first (until PAID), then fulfillment.
function deriveOrderState(order: { paymentStatus: string; fulfillmentStatus: string }, t: any) {
  // Payment hasn't completed yet — paymentStatus is the leading signal.
  if (order.paymentStatus === 'AWAITING_PROOF') {
    return {
      label: t('step9.state.awaitingSpei', { defaultValue: 'Esperando comprobante SPEI' }),
      help: t('step9.help.awaitingSpei', {
        defaultValue: 'Sube tu comprobante desde TPV → Pedidos cuando estés listo.',
      }),
      isTerminal: false,
    }
  }
  if (order.paymentStatus === 'PROOF_UPLOADED') {
    return {
      label: t('step9.state.speiReceived', { defaultValue: 'Comprobante recibido — revisando' }),
      help: t('step9.help.speiReceived', {
        defaultValue: 'Te notificaremos por correo cuando lo aprobemos.',
      }),
      isTerminal: false,
    }
  }
  if (
    order.paymentStatus === 'REJECTED' ||
    order.paymentStatus === 'EXPIRED' ||
    order.paymentStatus === 'REFUNDED' ||
    order.fulfillmentStatus === 'CANCELLED'
  ) {
    return {
      label: t('step9.state.rejected', { defaultValue: 'Pedido cancelado' }),
      help: t('step9.help.rejected', {
        defaultValue: 'Puedes intentar de nuevo o saltar este paso.',
      }),
      isTerminal: true,
    }
  }
  // Paid — fulfillmentStatus drives the message.
  if (order.fulfillmentStatus === 'NEW' || order.fulfillmentStatus === 'AWAITING_SERIALS') {
    return {
      label: t('step9.state.paid', { defaultValue: 'Pago confirmado' }),
      help: t('step9.help.paid', {
        defaultValue: 'Asignaremos tu terminal en las próximas horas.',
      }),
      isTerminal: false,
    }
  }
  if (order.fulfillmentStatus === 'SERIALS_ASSIGNED' || order.fulfillmentStatus === 'SHIPPED') {
    return {
      label: t('step9.state.shipped', { defaultValue: 'Tu terminal está en camino' }),
      help: t('step9.help.shipped', {
        defaultValue: 'Te enviamos los detalles de envío al correo.',
      }),
      isTerminal: false,
    }
  }
  if (order.fulfillmentStatus === 'DELIVERED') {
    return {
      label: t('step9.state.delivered', { defaultValue: 'Entregada' }),
      help: t('step9.help.delivered', {
        defaultValue: 'Empieza a cobrar desde TPV → Equipos.',
      }),
      isTerminal: false,
    }
  }
  // Fallback for unknown combinations.
  return {
    label: t('step9.state.paid', { defaultValue: 'Pago confirmado' }),
    help: '',
    isTerminal: false,
  }
}

export function BuyTpvStep({ onNext, venueId, tpvOrderId }: BuyTpvStepProps) {
  const { t } = useTranslation('setup')
  const [wizardOpen, setWizardOpen] = useState(false)

  // Resolve the order to show. Priority:
  //   1. `tpvOrderId` from props (step9 or URL hydration) → fetch by ID.
  //   2. No ID but venue exists → query latest order as fallback (covers the
  //      "user came back days later" case). The backend's resolveTpvPurchase
  //      already does this server-side, but we also do it client-side so the
  //      UI hydrates even if the backend payload missed it.
  //   3. No venueId → can't query; render View A.
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['tpv-order-onboarding', venueId, tpvOrderId],
    queryFn: async () => {
      if (!venueId) return null
      if (tpvOrderId) {
        return tpvOrderService.getById(venueId, tpvOrderId).catch(() => null)
      }
      const list = await tpvOrderService.listForVenue(venueId)
      return list[0] ?? null
    },
    enabled: Boolean(venueId),
    // The order's status can change mid-onboarding (e.g. SPEI gets approved).
    // Refetch when window regains focus so the user sees the latest state.
    refetchOnWindowFocus: true,
  })

  const handleSkip = () =>
    onNext({
      tpvPurchase: {
        tpvOrderId: null,
        skipped: true,
        lastUpdatedAt: new Date().toISOString(),
      },
    })

  const handleFinish = () =>
    onNext({
      tpvPurchase: {
        tpvOrderId: order?.id ?? null,
        skipped: false,
        lastUpdatedAt: new Date().toISOString(),
      },
    })

  // SPEI completion from the embedded wizard. Card flow doesn't reach here
  // (Stripe redirect takes over before onComplete fires); on return, the
  // URL params drive hydration in SetupWizard, not this callback.
  const handleWizardComplete = (result: { orderId: string; paymentMethod: 'CARD_STRIPE' | 'SPEI' }) => {
    setWizardOpen(false)
    onNext({
      tpvPurchase: {
        tpvOrderId: result.orderId,
        skipped: false,
        lastUpdatedAt: new Date().toISOString(),
      },
    })
  }

  // Loading: brief skeleton so we don't flash View A then flip to View B.
  if (orderLoading && venueId) {
    return (
      <div className="flex flex-col gap-8 max-w-2xl mx-auto">
        <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
        <div className="h-32 w-full bg-muted/60 rounded-2xl animate-pulse" />
      </div>
    )
  }

  // -------- View B: order exists --------
  if (order) {
    const stateMsg = deriveOrderState(order, t)
    const itemsLabel = order.items
      .map(item => `${item.quantity}× ${TPV_CATALOG[item.catalogKey]?.name ?? item.productName}`)
      .join(', ')

    return (
      <div className="flex flex-col gap-8 max-w-2xl mx-auto">
        <header>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            ✓ {t('step9.orderCreated', { defaultValue: 'Pedido' })} {order.orderNumber}
          </h1>
        </header>

        <Card className="p-6 flex flex-col gap-4 border-input">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {t('step9.product', { defaultValue: 'Producto:' })}
            </span>
            <span>{itemsLabel}</span>
            <span className="text-muted-foreground">
              {t('step9.total', { defaultValue: 'Total:' })}
            </span>
            <span>
              {formatMxnCents(order.totalCents)} {t('step9.includeTax', { defaultValue: '(con IVA)' })}
            </span>
            <span className="text-muted-foreground">
              {t('step9.state.label', { defaultValue: 'Estado:' })}
            </span>
            <span className="font-medium">{stateMsg.label}</span>
            <span className="text-muted-foreground">
              {t('step9.shippingTo', { defaultValue: 'Envío a:' })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {[order.shippingAddress, order.shippingCity, order.shippingState].filter(Boolean).join(', ')}
            </span>
          </div>
          {stateMsg.help && <p className="text-xs text-muted-foreground">{stateMsg.help}</p>}
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-input">
          {stateMsg.isTerminal && venueId && (
            <Button
              variant="outline"
              onClick={() => setWizardOpen(true)}
              className="rounded-full"
              data-tour="onboarding-tpv-retry"
            >
              {t('step9.retry', { defaultValue: 'Intentar de nuevo' })}
            </Button>
          )}
          {/* CENTRAL INVARIANT: this button is ALWAYS enabled regardless of
              order state. Buying a TPV is optional; the merchant can finish
              onboarding with a pending SPEI, a paid order, a shipped order,
              or even a rejected order. */}
          <Button
            onClick={handleFinish}
            className="rounded-full sm:ml-auto"
            data-tour="onboarding-tpv-finish"
          >
            {t('step9.finish', { defaultValue: 'Terminar onboarding →' })}
          </Button>
        </div>

        {venueId && (
          <TerminalPurchaseWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            from="setup"
            onComplete={handleWizardComplete}
          />
        )}
      </div>
    )
  }

  // -------- View A: no order yet --------
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {t('step9.title', { defaultValue: 'Compra tu terminal de pago (opcional)' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('step9.subtitle', {
            defaultValue: 'Cobra presencial con una terminal física. SIM con internet 4G incluida, sin costo adicional.',
          })}
        </p>
      </header>

      <Card className="p-6 flex flex-col gap-4 border-input">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium text-sm">
            {t('step9.catalogHeading', { defaultValue: 'Modelos disponibles' })}
          </p>
        </div>
        <ul className="text-sm space-y-1.5">
          {CATALOG_SUMMARY.map(m => {
            const entry = TPV_CATALOG[m.key]
            return (
              <li key={m.key} className="flex justify-between">
                <span>• {m.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMxnCents(entry.unitPriceCents)} {t('step9.plusIVA', { defaultValue: '+ IVA' })}
                </span>
              </li>
            )
          })}
        </ul>
        <Button
          onClick={() => setWizardOpen(true)}
          disabled={!venueId}
          className="rounded-full mt-2"
          data-tour="onboarding-tpv-open-wizard"
        >
          {t('step9.openWizard', { defaultValue: 'Ver catálogo y comprar →' })}
        </Button>
        {!venueId && (
          <p className="text-xs text-muted-foreground">
            {t('step9.venueNotReady', {
              defaultValue: 'Completa los pasos anteriores para habilitar la compra.',
            })}
          </p>
        )}
      </Card>

      <div className="pt-4 border-t border-input">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:underline"
          data-tour="onboarding-tpv-skip"
        >
          {t('step9.skip', { defaultValue: 'Saltar por ahora →' })}
        </button>
      </div>

      {venueId && (
        <TerminalPurchaseWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          from="setup"
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  )
}
