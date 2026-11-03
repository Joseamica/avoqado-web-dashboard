import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'

// «Pedidos recientes» del cliente pinta el estado con esta llave (D6, 24-oct: salía «COMPLETED» crudo).
// Cada valor de OrderStatus del SERVIDOR (schema.prisma) necesita su texto en los dos idiomas.
const ESTADOS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'DELETED']

describe('estado del pedido en el detalle del cliente', () => {
  it.each(['es', 'en'])('cada estado tiene texto en %s', lng => {
    for (const s of ESTADOS) {
      const texto = i18n.t(`orders:detail.statuses.${s}`, { lng })
      expect(texto, s).not.toBe(`detail.statuses.${s}`)
      expect(texto, s).not.toBe(s)
    }
  })

  it('COMPLETED dice «Completado» en español', () => {
    expect(i18n.t('orders:detail.statuses.COMPLETED', { lng: 'es' })).toBe('Completado')
  })
})
