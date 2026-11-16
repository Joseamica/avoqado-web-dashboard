import { describe, expect, it } from 'vitest'
import { textoDeLlegadas } from '../textoDeLlegadas'
import es from '@/locales/es/staffPay.json'

// Traductor mínimo con los textos REALES en español (plural _one/_other e interpolación), sin montar i18next.
const t = (k: string, o: Record<string, unknown> = {}) => {
  const [grupo, clave] = k.split('.')
  const g = (es as unknown as Record<string, Record<string, string>>)[grupo]
  const n = typeof o.count === 'number' ? (o.count === 1 ? '_one' : '_other') : ''
  const texto = g[clave + n] ?? g[clave] ?? k
  return texto.replace(/{{(\w+)}}/g, (_, v) => String(o[v] ?? ''))
}

describe('textoDeLlegadas — asistencia verificada (16-nov-2026)', () => {
  it('dice cómo llegó cada lugar y quién marcó a mano; lo que vale 0 no se dice', () => {
    expect(textoDeLlegadas(t, { qr: 6, phone: 1, staff: 1, list: 0, pass: 0, sinMetodo: 0, aMano: ['Ana P.'] })).toBe(
      '6 con celular, 1 con teléfono, 1 a mano por Ana P.',
    )
  })
  it('con «Corregir conteo» rotula lo registrado y a cuánto se corrigió el pago', () => {
    expect(textoDeLlegadas(t, { qr: 0, phone: 3, staff: 0, list: 0, pass: 0, sinMetodo: 0, corregidoA: 1 })).toBe(
      'llegadas registradas: 3 con teléfono · pago corregido a mano a 1 lugar',
    )
  })
  it('la lista de una app vieja dice con la sesión de quién se tocó (Codex r3 #7)', () => {
    expect(textoDeLlegadas(t, { qr: 0, phone: 0, staff: 0, list: 2, pass: 0, sinMetodo: 0, desdeLaLista: ['Ana P.'] })).toBe(
      '2 desde la lista (sesión de Ana P.)',
    )
  })
  it('sin desglose (server previo) no dice nada', () => {
    expect(textoDeLlegadas(t, null)).toBeNull()
    expect(textoDeLlegadas(t, { qr: 0, phone: 0, staff: 0, list: 0, pass: 0, sinMetodo: 0 })).toBeNull()
  })
})
