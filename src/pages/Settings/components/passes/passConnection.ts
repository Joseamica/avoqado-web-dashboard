import type { PassConnectionView } from '@/types/passes'

/**
 * ¿Queda algo vivo de esta conexión? ACTIVE; PAUSED; PENDING (un conectar a medias que ya reservó la sucursal, C5); o
 * REVOKED por un 401, que deja sucursal y credencial y se distingue por `lastError` —desconectar lo borra, pero deja
 * `externalPlaceName` (C1)—. Es exactamente lo que Desconectar puede soltar, y lo que la página usa para decidir si, sin
 * plan, se ve la tarjeta «pausada por el plan» (R62) o el paywall de siempre.
 */
export const passConnectionIsLive = (c: PassConnectionView): boolean =>
  c.status === 'ACTIVE' || c.status === 'PAUSED' || c.status === 'PENDING' || (c.status === 'REVOKED' && !!c.lastError)
