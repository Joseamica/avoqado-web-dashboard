import { describe, expect, it } from 'vitest'
import es from '@/locales/es/payment.json'
import en from '@/locales/en/payment.json'
import { etiquetaDeMetodo } from '../etiquetaDeMetodo'

// 16-oct: los cobros de Mercado Pago ya se guardan con su tipo real (SPEI = BANK_TRANSFER, OXXO = OTHER, saldo MP =
// DIGITAL_WALLET). El filtro de la lista los llamaba «Tarjeta» y el panel de detalle mostraba `BANK_TRANSFER` literal.
const t = (llave: string) => llave

describe('etiquetaDeMetodo — una sola traducción para la tabla, los filtros y el detalle', () => {
  it.each([
    ['CASH', 'methods.cash'],
    ['CREDIT_CARD', 'methods.creditCard'],
    ['DEBIT_CARD', 'methods.debitCard'],
    ['DIGITAL_WALLET', 'methods.digitalWallet'],
    ['BANK_TRANSFER', 'methods.bankTransfer'],
    ['CRYPTOCURRENCY', 'methods.cryptocurrency'],
    ['OTHER', 'methods.other'],
    ['STORE_CREDIT', 'methods.storeCredit'],
  ])('%s → %s (nunca «Tarjeta» genérica)', (metodo, llave) => {
    expect(etiquetaDeMetodo(metodo, t)).toBe(llave)
  })

  it('el valor viejo «CARD» sigue diciendo Tarjeta', () => {
    expect(etiquetaDeMetodo('CARD', t)).toBe('methods.card')
  })

  it('OTHER con tenderSystemKind STORE_CREDIT dice «Saldo a favor»; sin el campo (servidor viejo) o con otro valor sigue «Otro»', () => {
    expect(etiquetaDeMetodo('OTHER', t, 'STORE_CREDIT')).toBe('methods.storeCredit')
    expect(etiquetaDeMetodo('OTHER', t)).toBe('methods.other')
    expect(etiquetaDeMetodo('OTHER', t, null)).toBe('methods.other')
    expect(etiquetaDeMetodo('OTHER', t, 'GIFT_CARD')).toBe('methods.other')
  })

  it('sin método no truena', () => {
    expect(etiquetaDeMetodo(undefined, t)).toBe('-')
  })

  it('todas las llaves existen en español y en inglés', () => {
    for (const metodo of ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 'BANK_TRANSFER', 'CRYPTOCURRENCY', 'OTHER', 'STORE_CREDIT', 'CARD']) {
      const llave = etiquetaDeMetodo(metodo, t).replace('methods.', '')
      expect((es.methods as Record<string, string>)[llave]).toBeTruthy()
      expect((en.methods as Record<string, string>)[llave]).toBeTruthy()
    }
  })
})
