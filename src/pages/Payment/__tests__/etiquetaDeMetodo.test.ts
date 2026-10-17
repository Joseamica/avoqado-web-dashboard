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
  ])('%s → %s (nunca «Tarjeta» genérica)', (metodo, llave) => {
    expect(etiquetaDeMetodo(metodo, t)).toBe(llave)
  })

  it('el valor viejo «CARD» sigue diciendo Tarjeta', () => {
    expect(etiquetaDeMetodo('CARD', t)).toBe('methods.card')
  })

  it('sin método no truena', () => {
    expect(etiquetaDeMetodo(undefined, t)).toBe('-')
  })

  it('todas las llaves existen en español y en inglés', () => {
    for (const metodo of ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 'BANK_TRANSFER', 'CRYPTOCURRENCY', 'OTHER', 'CARD']) {
      const llave = etiquetaDeMetodo(metodo, t).replace('methods.', '')
      expect((es.methods as Record<string, string>)[llave]).toBeTruthy()
      expect((en.methods as Record<string, string>)[llave]).toBeTruthy()
    }
  })
})
