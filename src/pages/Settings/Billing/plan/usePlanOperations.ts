// src/pages/Settings/Billing/plan/usePlanOperations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { saveHybridAttempt } from '@/lib/hybridIntent'
import {
  applyRetentionOffer,
  createPlanCheckoutSession,
  downgradeVenueToFree,
  getBillingPortalUrl,
  getDowngradePreview,
  reactivateVenuePlan,
  type CancellationInput,
} from '@/services/features.service'
import { hybridBilling, type HybridQuoteBody } from '@/services/hybridBilling.service'
import type { DependencyIssue } from './planActions'

type ServerFailure = { response?: { status?: number; data?: { message?: string; code?: string; details?: unknown } } }
export const serverCode = (value: unknown) => (value as ServerFailure)?.response?.data?.code
/** The first issue of a HYBRID_DEPENDENCY_TERM refusal (spec §4.2 rule 4): the unit that brings the dependency. */
export const dependencyIssue = (value: unknown): DependencyIssue | undefined => {
  const details = (value as ServerFailure)?.response?.data?.details
  return serverCode(value) === 'HYBRID_DEPENDENCY_TERM' && Array.isArray(details) ? details[0] : undefined
}
/**
 * B2: los 503 que el SERVIDOR escribe para el dueño, en español (la página de la tarjeta no abrió, la oferta no se pudo leer). Los
 * demás 5xx son internos.
 */
const MENSAJES_PARA_EL_DUENO = ['PORTAL_NOT_CONFIGURED', 'PLAN_NOT_CONFIGURED']
/** A refusal (4xx) is written for the owner; a server failure (5xx) is internal and often English, so ours is shown. */
export const serverMessage = (value: unknown, fallback: string) => {
  const response = (value as ServerFailure)?.response
  if ((response?.status ?? 0) >= 500 && !MENSAJES_PARA_EL_DUENO.includes(response?.data?.code ?? '')) return fallback
  return response?.data?.message ?? fallback
}

const REFRESH = [
  'venuePlan',
  'featureGrid',
  'venueFeatures',
  'seatStatus',
  'hybrid-contracts',
  'hybrid-replacements',
  'user-access',
  'team-members',
]

/** Every write the Plan page makes, each mapped to ONE server operation (spec §4.1). */
export function usePlanOperations(venueId: string, openCheckout: () => void) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const client = useQueryClient()
  const refresh = () => Promise.all(REFRESH.map(key => client.invalidateQueries({ queryKey: [key, venueId] })))
  const failToast = (fallback: string) => (value: unknown) => toast({ title: serverMessage(value, t(fallback)), variant: 'destructive' })

  const classicCheckout = useMutation({
    mutationFn: async ({
      tier,
      interval,
      primerCobroAnunciado,
      quoteToken,
      acceptanceId,
    }: {
      tier: 'PRO' | 'PREMIUM'
      interval: 'monthly' | 'annual'
      /** D3: quedarse con el plan de una prueba regalada (hoy $0): la fecha del primer cobro que se mostró. */
      primerCobroAnunciado?: string
      /** B2: el comprobante de la opción que «Tu plan» cotizó con una versión del editor. */
      quoteToken?: string
      /** B2 (b2-r7 #4): la compra que se aceptó al convertir la demo. */
      acceptanceId?: string
    }) => {
      const opciones = {
        ...(primerCobroAnunciado ? { primerCobroAnunciado } : {}),
        ...(quoteToken ? { quoteToken } : {}),
        ...(acceptanceId ? { acceptanceId } : {}),
      }
      // Sin nada de eso, la llamada de siempre: sólo «quedarse», el comprobante o la aceptación agregan algo.
      const url = Object.keys(opciones).length
        ? await createPlanCheckoutSession(venueId, tier, interval, opciones)
        : await createPlanCheckoutSession(venueId, tier, interval)
      // No url means no checkout: fail loudly (the page shows it) instead of navigating to "undefined".
      if (!url) throw new Error('Plan checkout returned no url')
      return url
    },
    onSuccess: (url: string) => {
      window.location.href = url
    },
  })
  const hybridQuote = useMutation({
    mutationFn: async (body: HybridQuoteBody) => {
      const purchase = await hybridBilling.quote(venueId, body)
      // Durable BEFORE the checkout opens: it recovers this exact quote, with consent, payment and a lost answer.
      saveHybridAttempt(venueId, { id: purchase.id, clientKey: crypto.randomUUID() })
      return purchase
    },
    onSuccess: () => openCheckout(),
  })
  const preview = useMutation({ mutationFn: () => getDowngradePreview(venueId) })
  const downgrade = useMutation({
    mutationFn: ({ keep, input }: { keep: string[]; input: CancellationInput }) => downgradeVenueToFree(venueId, keep, input),
    onSuccess: async () => {
      await refresh()
      toast({ title: t('plan.downgrade.scheduledToast') })
    },
    onError: failToast('plan.downgrade.errorToast'),
  })
  const cancelContract = useMutation({
    mutationFn: ({ contractId, revision, input }: { contractId: string; revision: number; input: CancellationInput }) =>
      hybridBilling.cancelContract(venueId, contractId, revision, input),
    onSuccess: async () => {
      await refresh()
      toast({ title: t('plan.page.contractCancelled') })
    },
    onError: failToast('hybrid.error'),
  })
  const reactivate = useMutation({
    mutationFn: () => reactivateVenuePlan(venueId),
    onSuccess: async () => {
      await refresh()
      toast({ title: t('currentPlan.toast.reactivateSuccess') })
    },
    onError: failToast('currentPlan.toast.error'),
  })
  const portal = useMutation({
    mutationFn: async () => {
      const { url } = await getBillingPortalUrl(venueId)
      // No link means no portal: say so (onError) instead of a button that silently does nothing.
      if (!url) throw new Error('Billing portal returned no url')
      return url
    },
    onSuccess: (url: string) => {
      window.location.href = url
    },
    onError: failToast('currentPlan.toast.error'),
  })
  // B2 (§17): «Poner mi tarjeta» de la prueba sin tarjeta es el portal de Stripe en el flujo de la tarjeta, nunca un formulario propio
  // ni un SetupIntent. Vuelve a esta misma página con `?portal=tarjeta`, que dice qué quedó. Quien llama muestra su error.
  const cardPortal = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}${window.location.pathname}?portal=tarjeta`
      const { url } = await getBillingPortalUrl(venueId, { flujo: 'PONER_TARJETA', returnUrl })
      if (!url) throw new Error('Billing portal returned no url')
      return url
    },
    onSuccess: (url: string) => {
      window.location.assign(url)
    },
  })
  const offer = useMutation({
    mutationFn: (kind: 'discount' | 'pause') => applyRetentionOffer(venueId, kind),
    onSuccess: async (_, kind) => {
      await refresh()
      toast({ title: t(kind === 'pause' ? 'plan.cancel.offer.pauseSuccess' : 'plan.cancel.offer.discountSuccess') })
    },
    onError: failToast('plan.cancel.offer.error'),
  })
  return { classicCheckout, hybridQuote, preview, downgrade, cancelContract, reactivate, portal, cardPortal, offer }
}
