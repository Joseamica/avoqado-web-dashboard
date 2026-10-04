import type { PassConnectionView, PassIntegrationsOverview } from '@/types/passes'

/**
 * ¿Queda algo vivo de esta conexión? ACTIVE; PAUSED; PENDING (un conectar a medias que ya reservó la sucursal, C5); o
 * REVOKED por un 401, que deja sucursal y credencial y se distingue por `lastError` —desconectar lo borra, pero deja
 * `externalPlaceName` (C1)—. Es exactamente lo que Desconectar puede soltar, y lo que la página usa para decidir si, sin
 * plan, se ve la tarjeta «pausada por el plan» (R62) o el paywall de siempre.
 */
export const passConnectionIsLive = (c: PassConnectionView): boolean =>
  c.status === 'ACTIVE' || c.status === 'PAUSED' || c.status === 'PENDING' || (c.status === 'REVOKED' && !!c.lastError)

/**
 * Pausa suave (R62): el plan ya no incluye pases (lo dice el server) pero queda una conexión viva. Las visitas que siguen
 * llegando se ven y se resuelven sin el plan (D1, C1 del server): son cobrables hasta que venza su plazo.
 */
export const passesPlanPaused = (overview: PassIntegrationsOverview | undefined): boolean =>
  overview?.planActive === false && overview.connections.some(passConnectionIsLive)
