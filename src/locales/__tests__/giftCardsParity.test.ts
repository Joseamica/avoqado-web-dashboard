/**
 * Paridad es ↔ en del namespace `giftCards` (T7: la regla de ESLint de i18n corre con `validateAgainstJson: false` y no ve
 * llaves faltantes). fr no se agrega: el francés dejó de soportarse (founder, 28-sep-2026).
 */
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/giftCards.json'
import en from '@/locales/en/giftCards.json'

const leaves = (value: unknown, prefix = ''): string[] =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
const at = (source: unknown, path: string) => path.split('.').reduce((node: any, key) => node?.[key], source)

describe('giftCards translations', () => {
  it('es y en tienen exactamente las mismas llaves', () => {
    expect(leaves(en).sort()).toEqual(leaves(es).sort())
  })

  it('ningún texto vacío', () => {
    for (const source of [es, en])
      for (const key of leaves(source)) {
        const value = at(source, key)
        expect(typeof value === 'string' && value.trim().length > 0, `${key} vacío`).toBe(true)
      }
  })

  it('cada estado, movimiento, motivo y entrega que manda el server tiene su texto', () => {
    const tiene = (grupo: string, codigos: string[]) => {
      for (const c of codigos) expect(at(es, `${grupo}.${c}`), `${grupo}.${c}`).toBeTruthy()
    }
    tiene('status', ['PENDING', 'ACTIVE', 'BLOCKED', 'DEACTIVATED', 'EXPIRED'])
    tiene('activity', [
      'ACTIVATE',
      'REDEEM',
      'REDEEM_REVERSAL',
      'ADJUST_INCREMENT',
      'ADJUST_DECREMENT',
      'BLOCK',
      'UNBLOCK',
      'DEACTIVATE',
      'CLAIM',
      'CODE_REPLACED',
    ])
    tiene('reason', [
      'SUSPICIOUS_ACTIVITY',
      'CASHIER_ERROR',
      'CUSTOMER_REQUEST',
      'LOST_CARD',
      'SALE_CANCELLED',
      'ONLINE_REVOCATION',
      'CHARGEBACK',
      'CANCEL_IN_PROGRESS',
      'OTHER',
    ])
    tiene('delivery', ['WHATSAPP', 'EMAIL', 'PRINTED', 'CUSTOMER_CARD', 'HANDED_TO_BUYER'])
    tiene('deliveryStatus', ['PENDING', 'SENT', 'FAILED'])
    tiene('notice', ['DISABLED', 'NOT_IN_PLAN', 'KEYS_MISSING'])
    // Los `kind` de C4 tal cual (F3: sin traducir a otros códigos en el panel).
    tiene('reports.pending.kind', ['VENTA_DE_TARJETAS', 'COBRO_CON_SALDO', 'REVERSO_DE_SALDO', 'CANCELACION_DE_VENTA'])
    tiene('reports.aging.buckets', ['0-30', '31-90', '91-180', '181-365', '366+'])
    tiene('settings.rules.validityOption', ['none', '12', '24', '36', '60'])
    // Por qué no se puede cancelar la venta (C4 `cancel.reason`) y los dos casos con `reason: null`.
    tiene('actions.cancelSale.blocker', ['NOT_PAID', 'NOT_SAME_DAY', 'ALREADY_USED', 'ALREADY_CANCELLED', 'BLOCKED_OTHER', 'GENERIC'])
  })
})
