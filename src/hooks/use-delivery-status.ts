/**
 * useDeliveryStatus — resuelve cuál de los 4 estados de delivery pintar para un venue.
 *
 * Combina el gate de tier (`useVenueTier().hasFeatureAccess('DELIVERY_CHANNELS')`) con los datos de
 * activación del backend (`getChannels` / `getActivationRequest`, `delivery.service.ts`) para decidir
 * entre:
 *   - LOCKED  — el venue no tiene el feature PREMIUM `DELIVERY_CHANNELS`.
 *   - TEASER  — tiene el feature, pero no ha activado nada (sin canal ACTIVE, sin solicitud viva).
 *   - PENDING — tiene el feature y una solicitud de activación viva, pero aún ningún canal ACTIVE.
 *   - LIVE    — tiene ≥1 canal ACTIVE. Gana sobre PENDING aunque exista una solicitud (ya activo).
 *
 * `enabled: !!venueId && hasFeature` evita pegarle al API de activación cuando el venue no tiene el
 * feature — evita un 403 innecesario contra `/api/v1/delivery-channels/...` (mismo patrón que el
 * "superadmin loading" de `.claude/rules/critical-warnings.md`: gatear la query, no solo la UI).
 */
import { useQuery } from '@tanstack/react-query'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { getChannels, getActivationRequest } from '@/services/delivery.service'
import type { DeliveryChannelLink, DeliveryActivationRequest } from '@/types/delivery'

export type DeliveryState = 'LOCKED' | 'TEASER' | 'PENDING' | 'LIVE'

export interface DeliveryStatus {
  state: DeliveryState
  channels: DeliveryChannelLink[]
  activationRequest: DeliveryActivationRequest | null
  isLoading: boolean
}

export function useDeliveryStatus(venueId: string | undefined): DeliveryStatus {
  const { hasFeatureAccess, isLoading: tierLoading } = useVenueTier()
  const hasFeature = hasFeatureAccess('DELIVERY_CHANNELS')
  // `!tierLoading` es OBLIGATORIO: useVenueTier hace fail-open mientras carga (hasFeatureAccess()
  // devuelve true para TODOS los venues hasta que el tier asienta — use-tier-feature-access.ts:95).
  // Sin descontarlo, un venue LOCKED dispararía getChannels/getActivationRequest durante el cold-load
  // → 403 (el backend las gatea con checkFeatureAccess). Con `!tierLoading`, no se pega al API hasta
  // que el tier resuelve; ya resuelto, un venue sin feature tiene hasFeature=false y sigue sin pegar.
  const enabled = !!venueId && hasFeature && !tierLoading

  const { data: channels = [], isLoading: chLoading } = useQuery({
    queryKey: ['deliveryChannels', venueId],
    queryFn: () => getChannels(venueId!),
    enabled,
    staleTime: 60_000,
  })
  const { data: activationRequest = null, isLoading: reqLoading } = useQuery({
    queryKey: ['deliveryActivation', venueId],
    queryFn: () => getActivationRequest(venueId!),
    enabled,
    staleTime: 60_000,
  })

  // While disabled (no feature / no venueId) the channel/activation queries never run, so their
  // isLoading must not hold the overall isLoading true — only the tier check gates that path.
  const isLoading = tierLoading || (enabled && (chLoading || reqLoading))
  const hasActive = channels.some(channel => channel.status === 'ACTIVE')

  const state: DeliveryState = !hasFeature ? 'LOCKED' : hasActive ? 'LIVE' : activationRequest ? 'PENDING' : 'TEASER'

  return { state, channels, activationRequest, isLoading }
}
