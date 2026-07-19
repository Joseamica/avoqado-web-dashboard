/**
 * Delivery channels — activación y gestión de canales (Deliverect, Uber Eats, Rappi, DiDi Food).
 * Espejo 1:1 de los modelos del backend (avoqado-server prisma/schema.prisma:
 * DeliveryChannelLink, DeliveryActivationRequest) y de `deliverySummary.service.ts`
 * (src/services/delivery-channels/core/). Consumidos por delivery.service.ts y, en tasks
 * posteriores, por useDeliveryStatus y la página de Delivery.
 */

/** DELIVERECT = integración vía agregador. Los demás son integración directa (futuro). */
export type DeliveryProvider = 'DELIVERECT' | 'UBER_EATS' | 'RAPPI' | 'DIDI_FOOD'

export type DeliveryChannelStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'DISABLED'

/** Un canal de delivery vinculado a un venue (sin `webhookSecret` — el backend lo excluye siempre). */
export interface DeliveryChannelLink {
  id: string
  venueId: string
  provider: DeliveryProvider
  status: DeliveryChannelStatus
  orderAcceptanceMode: 'AUTO' | 'MANUAL'
  autoSyncMenu: boolean
  lastMenuSyncAt: string | null
  externalLocationId: string
}

export type DeliveryActivationStatus = 'PENDING' | 'CONTACTED' | 'CONNECTED' | 'DISMISSED'

/** Solicitud del dueño para activar delivery (self-serve, ops la procesa manualmente). */
export interface DeliveryActivationRequest {
  id: string
  venueId: string
  status: DeliveryActivationStatus
  requestedChannels: string[]
  note: string | null
  createdAt: string
}

/** Pedidos e ingreso (PESOS, 1:1) de HOY (venue-local) agrupados por canal. */
export interface DeliverySummary {
  channels: Array<{ channel: string; orders: number; totalPesos: number }>
  generatedAt: string
}
