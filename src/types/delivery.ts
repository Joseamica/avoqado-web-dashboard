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
  /**
   * ¿Está el menú al día en el proveedor?
   *  · MANUAL          — el dueño apagó el auto-sync y lo mantiene a mano.
   *  · NUNCA_PUBLICADO — 🚨 el que hay que ver: el proveedor está vendiendo otra carta, o
   *                      ninguna, y nadie se entera hasta que un cliente se queja.
   *  · AL_DIA          — publicado.
   */
  menuSyncStatus?: 'MANUAL' | 'NUNCA_PUBLICADO' | 'AL_DIA'
  /**
   * La tasa de inyección: el número con el que el proveedor decide REVOCAR el acceso
   * (Uber exige 99.9%, revoca por debajo de 99%).
   *
   * `porcentaje: null` con `estado: SIN_DATOS` significa que aún no llegan pedidos — NO que
   * la tasa sea 0.
   */
  injectionRate?: {
    recibidos: number
    aceptados: number
    porcentaje: number | null
    estado: 'SIN_DATOS' | 'OK' | 'ALERTA' | 'CRITICO'
  } | null
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
