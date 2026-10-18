import type { TFunction } from 'i18next'

import { formatMXN } from './formatMXN'

/**
 * El precio de un plan como lo ve el cliente: con el neto si el servidor lo mandó
 * («$999.00 + IVA = $1,158.84») y, si no, sólo el total («$1,158.84 con IVA»).
 *
 * 🔴 Sólo formatea centavos que ya vienen del servidor; no suma, no divide ni redondea. El neto
 * es opcional porque un servidor viejo no lo publica: sin él NO se deriva dividiendo entre 1.16.
 */
export function textoDePrecio(t: TFunction, brutoCents: number, netoCents?: number): string {
  const gross = formatMXN(brutoCents)
  if (netoCents == null) return t('plans.grossWithIva', { gross })
  return t('plans.netPlusIva', { net: formatMXN(netoCents), gross })
}
