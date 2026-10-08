import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getVenueFeatures, type VenueFeatureStatus } from '@/services/features.service'
import { hybridBilling, type FeatureGridOffer } from '@/services/hybridBilling.service'

interface FeaturePrice {
  /** Precio mensual de contratar SÓLO esta función; null si no se vende suelta o no se pudo leer. */
  price: number | null
  /** Si este usuario puede VER precios (`billing:subscriptions:read`). */
  canSeePrices: boolean
  /**
   * Si este usuario puede CONTRATAR (`billing:subscriptions:manage`). Es otro permiso: leer la
   * facturación no es poder comprar, y el backend le negaría la compra (Codex, 21-sep).
   */
  canPurchase: boolean
}

/**
 * Precio SUELTO de una función, para el cartel del paywall.
 *
 * 🔴 Sólo lo pide quien puede ver facturación, y es deliberado, no una omisión: el precio y los
 * ids de Stripe viven detrás de `billing:subscriptions:read` a propósito — bajar ese dato a todos
 * los roles filtraría lo que paga el negocio a cajeros y meseros (decisión del 13-jun-2026 al
 * arreglar el paywall falso de los sub-ADMIN; ver memoria
 * `reference-gating-data-must-be-readable-by-all-roles`). Quien no puede contratar tampoco
 * necesita el número: ve a quién pedírselo, que es lo que manda la regla «apagado se VE y se
 * EXPLICA».
 *
 * Reusa la queryKey de Ajustes → Suscripciones, así que para un ADMIN que ya pasó por ahí no
 * cuesta una petición nueva.
 */
export function useFeaturePrice(featureCode: string, opciones?: { enabled?: boolean }): FeaturePrice {
  const { can } = useAccess()
  const { venueId } = useCurrentVenue()
  const canSeePrices = can('billing:subscriptions:read')
  const canPurchase = can('billing:subscriptions:manage')

  const { data } = useQuery<VenueFeatureStatus>({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId as string),
    // 🔴 `enabled` con `opciones.enabled`: el gate se monta en ~60 pantallas y la mayoría de las
    // veces DEJA PASAR. Sin esta condición, cada pantalla del dashboard pediría el catálogo de
    // facturación aunque nunca se dibuje el cartel.
    enabled: (opciones?.enabled ?? true) && canSeePrices && Boolean(venueId),
    staleTime: 5 * 60_000,
  })

  // Un paywall nunca puede tumbar la pantalla que está protegiendo: una respuesta sin `availableFeatures` o con algo que no
  // es arreglo (contrato viejo, respuesta parcial, un mock) sale sin precio. `?.` no basta: `'x'?.find` también truena (E6a-fix F4).
  const funciones = Array.isArray(data?.availableFeatures) ? data.availableFeatures : []
  const suelta = funciones.find(f => f.code === featureCode)
  // 🔴 Estar en `availableFeatures` NO es venderse suelta: sin precio de Stripe la compra no existe
  // (el seed de CFDI trae `monthlyPrice: 0` y ningún `stripePriceId`). Anunciarla sería prometer
  // «contrátala sola por $0» sobre algo que no se puede comprar (Codex, 21-sep).
  const vendible = suelta?.stripePriceId && suelta.monthlyPrice > 0
  // Las funciones nuevas (SERVICE_PAY, AGGREGATOR_PASSES) no tienen fila `Feature`: su precio suelto lo publica superadmin
  // en la lista comercial y llega por el feature-grid (misma llave y mismo permiso que Ajustes → Suscripciones). Sólo se
  // pide cuando la tabla `Feature` no trajo un precio vendible.
  const { data: grid } = useQuery({
    queryKey: ['featureGrid', venueId],
    queryFn: () => hybridBilling.featureGrid(venueId as string),
    enabled: (opciones?.enabled ?? true) && canSeePrices && Boolean(venueId) && !!data && !vendible,
    staleTime: 5 * 60_000,
  })
  // «Contrátala sola» = una oferta de funciones que trae SÓLO ésta; una de varias funciones es otro precio. `?.` y arreglos
  // comprobados en todo: un paywall nunca tumba la pantalla que protege.
  const sola = (o?: FeatureGridOffer | null) =>
    o && o.kind === 'FEATURES' && o.includedFeatureCodes?.length === 1 && o.includedFeatureCodes[0] === featureCode ? o : null
  const entradas = Array.isArray(grid?.entries) ? grid.entries : []
  const entrada = entradas.find(e => e.featureCode === featureCode)
  const deLaLista = sola(entrada?.offer) ?? sola(entrada?.listOffer)
  const precio = vendible ? suelta.monthlyPrice : (deLaLista?.price ?? null)
  return { price: precio, canSeePrices, canPurchase }
}
