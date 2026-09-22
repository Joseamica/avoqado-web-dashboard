import { describe, expect, it } from 'vitest'
import es from '@/locales/es/inventory.json'
import en from '@/locales/en/inventory.json'
import { WASTE_REASONS } from '@/lib/inventory-constants'
import {
  WASTE_REASON_CODES,
  SUMMARY_LOSS_ACTION_REASON,
  buildWasteAdjustment,
  formatWasteQuantity,
  initialWasteKeyState,
  isAmbiguousWasteFailure,
  isWasteReasonCode,
  keyForSubmission,
  newWasteKey,
  previewAfterWaste,
  readWasteSummary,
  wasteErrorKey,
  wasteFingerprint,
  wasteReasonLabelKey,
} from './inventoryWaste'

// El MISMO patrón que exige el servidor (avoqado-server/src/services/shared/wasteKey.ts).
const SERVER_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('códigos de motivo — espejo EXACTO del servidor', () => {
  it('son los 21 del servidor, en su orden (avoqado-server/src/services/shared/wasteReasons.ts)', () => {
    expect([...WASTE_REASON_CODES]).toEqual([
      'EXPIRED',
      'SPOILED',
      'CONTAMINATED',
      'DEFECTIVE',
      'OVERPRODUCTION',
      'PREP_ERROR',
      'BURNT',
      'UNDERCOOKED',
      'DROPPED',
      'CUSTOMER_RETURN',
      'WRONG_ORDER',
      'CUSTOMER_CHANGE',
      'TESTING',
      'STAFF_MEAL',
      'PROMOTION',
      'DONATION',
      'THEFT',
      'MISSING',
      'PEST_DAMAGE',
      'OTHER',
      'UNSPECIFIED',
    ])
  })

  it('el selector del dashboard ofrece los 20 elegibles y NUNCA UNSPECIFIED', () => {
    expect(Object.keys(WASTE_REASONS)).toEqual(WASTE_REASON_CODES.filter(c => c !== 'UNSPECIFIED'))
  })

  it('cada código tiene etiqueta en español e inglés (también UNSPECIFIED, que sólo se muestra)', () => {
    for (const code of WASTE_REASON_CODES) {
      expect((es.waste.reasons as Record<string, { label?: string }>)[code]?.label, `es ${code}`).toBeTruthy()
      expect((en.waste.reasons as Record<string, { label?: string }>)[code]?.label, `en ${code}`).toBeTruthy()
    }
  })

  it('isWasteReasonCode no acepta propiedades heredadas ni texto libre', () => {
    expect(isWasteReasonCode('EXPIRED')).toBe(true)
    expect(isWasteReasonCode('toString')).toBe(false)
    expect(isWasteReasonCode('Expired')).toBe(false)
    expect(isWasteReasonCode(null)).toBe(false)
  })

  it('la etiqueta se resuelve por código; un código desconocido no inventa etiqueta', () => {
    expect(wasteReasonLabelKey('EXPIRED')).toBe('waste.reasons.EXPIRED.label')
    expect(wasteReasonLabelKey('UNSPECIFIED')).toBe('waste.reasons.UNSPECIFIED.label')
    expect(wasteReasonLabelKey('NOPE')).toBeNull()
    expect(wasteReasonLabelKey(null)).toBeNull()
  })

  it('el editor rápido del Resumen mapea Daño/Robo/Pérdida a códigos reales', () => {
    expect(SUMMARY_LOSS_ACTION_REASON).toEqual({ DAMAGE: 'DEFECTIVE', THEFT: 'THEFT', LOSS: 'MISSING' })
  })
})

describe('previewAfterWaste — lo que hará el servidor (D4)', () => {
  it('con existencia suficiente descuenta todo', () => {
    expect(previewAfterWaste(10, 3)).toEqual({ newStock: 7, deducted: 3, unrecorded: 0 })
  })
  it('con menos existencia que merma: queda en 0 y el resto es «sin existencia»', () => {
    expect(previewAfterWaste(2, 5)).toEqual({ newStock: 0, deducted: 2, unrecorded: 3 })
  })
  it('sin existencia no descuenta nada', () => {
    expect(previewAfterWaste(0, 4)).toEqual({ newStock: 0, deducted: 0, unrecorded: 4 })
  })
  it('una existencia negativa NO se toca (nunca baja más)', () => {
    expect(previewAfterWaste(-3, 2)).toEqual({ newStock: -3, deducted: 0, unrecorded: 2 })
  })
  it('no arrastra basura de punto flotante', () => {
    expect(previewAfterWaste(2.3, 2.1)).toEqual({ newStock: 0.2, deducted: 2.1, unrecorded: 0 })
  })
  it('una cantidad vacía o inválida no mueve nada', () => {
    expect(previewAfterWaste(5, 0)).toEqual({ newStock: 5, deducted: 0, unrecorded: 0 })
    expect(previewAfterWaste(5, Number.NaN)).toEqual({ newStock: 5, deducted: 0, unrecorded: 0 })
  })
})

describe('folio — mismo contenido, mismo folio', () => {
  let n = 0
  const fakeKey = () => `key-${++n}`

  it('newWasteKey produce un UUID que el servidor acepta', () => {
    expect(newWasteKey()).toMatch(SERVER_KEY_PATTERN)
  })

  it('el primer envío conserva el folio inicial; repetir lo mismo lo reusa', () => {
    const inicial = initialWasteKeyState(fakeKey)
    const primero = keyForSubmission(inicial, 'A', fakeKey)
    const reintento = keyForSubmission(primero, 'A', fakeKey)
    expect(primero.key).toBe(inicial.key)
    expect(reintento.key).toBe(inicial.key)
  })

  it('cambiar el contenido estrena folio (con el viejo el servidor respondería IDEMPOTENCY_KEY_REUSED)', () => {
    const primero = keyForSubmission(initialWasteKeyState(fakeKey), 'A', fakeKey)
    const cambiado = keyForSubmission(primero, 'B', fakeKey)
    expect(cambiado.key).not.toBe(primero.key)
    expect(cambiado.fingerprint).toBe('B')
  })

  it('la huella cambia con cantidad, motivo, nota o referencia, y no con espacios de la nota', () => {
    const base = { quantity: 3, reasonCode: 'EXPIRED' as const, note: 'caja', reference: 'R1' }
    const h = wasteFingerprint('rm1', base)
    expect(wasteFingerprint('rm1', { ...base, note: '  caja  ' })).toBe(h)
    expect(wasteFingerprint('rm1', { ...base, quantity: -3 })).toBe(h)
    expect(wasteFingerprint('rm1', { ...base, quantity: 4 })).not.toBe(h)
    expect(wasteFingerprint('rm1', { ...base, reasonCode: 'SPOILED' })).not.toBe(h)
    expect(wasteFingerprint('rm1', { ...base, note: 'otra' })).not.toBe(h)
    expect(wasteFingerprint('rm1', { ...base, reference: 'R2' })).not.toBe(h)
    expect(wasteFingerprint('rm2', base)).not.toBe(h)
  })
})

describe('buildWasteAdjustment — el cuerpo que va al servidor', () => {
  it('cantidad NEGATIVA, código, folio, y la nota en reason (nunca la etiqueta)', () => {
    expect(buildWasteAdjustment('SPOILAGE', { quantity: 3, reasonCode: 'EXPIRED', note: ' caja golpeada ' }, 'k1')).toEqual({
      type: 'SPOILAGE',
      quantity: -3,
      reasonCode: 'EXPIRED',
      idempotencyKey: 'k1',
      reason: 'caja golpeada',
    })
  })
  it('sin nota no manda reason; con referencia la conserva', () => {
    expect(buildWasteAdjustment('LOSS', { quantity: -2, reasonCode: 'DROPPED', note: '   ', reference: ' F-12 ' }, 'k2')).toEqual({
      type: 'LOSS',
      quantity: -2,
      reasonCode: 'DROPPED',
      idempotencyKey: 'k2',
      reference: 'F-12',
    })
  })
})

describe('readWasteSummary — el `waste` de la respuesta', () => {
  it('lee el resumen del servidor', () => {
    const body = { success: true, data: {}, waste: { reportId: 'r1', declared: '5', deducted: '2', unrecorded: '3' } }
    expect(readWasteSummary(body)).toEqual({ reportId: 'r1', declared: '5', deducted: '2', unrecorded: '3' })
  })
  it('un servidor viejo (sin waste) o una forma rara dan null', () => {
    expect(readWasteSummary({ success: true, data: {} })).toBeNull()
    expect(readWasteSummary({ waste: { reportId: 'r1' } })).toBeNull()
    expect(readWasteSummary(null)).toBeNull()
  })
})

describe('errores', () => {
  it('sin respuesta o 5xx es ambiguo (pudo haberse aplicado); 4xx no', () => {
    expect(isAmbiguousWasteFailure({ message: 'Network Error' })).toBe(true)
    expect(isAmbiguousWasteFailure({ response: { status: 503 } })).toBe(true)
    expect(isAmbiguousWasteFailure({ response: { status: 409 } })).toBe(false)
    expect(isAmbiguousWasteFailure({ response: { status: 400 } })).toBe(false)
  })
  it('los códigos del servidor tienen texto propio; lo demás usa el mensaje del servidor', () => {
    const conCodigo = (code: string, status = 409) => ({ response: { status, data: { code } } })
    expect(wasteErrorKey(conCodigo('WASTE_VOIDED'))).toBe('waste.errors.voided')
    expect(wasteErrorKey(conCodigo('IDEMPOTENCY_KEY_REUSED'))).toBe('waste.errors.keyReused')
    expect(wasteErrorKey(conCodigo('WASTE_RETRYABLE_CONFLICT'))).toBe('waste.errors.retryable')
    expect(wasteErrorKey(conCodigo('QUANTITY_TOO_LARGE', 422))).toBe('waste.errors.tooLarge')
    expect(wasteErrorKey({ message: 'Network Error' })).toBe('waste.errors.ambiguous')
    expect(wasteErrorKey({ response: { status: 404, data: { message: 'Raw material with ID x not found' } } })).toBeNull()
  })
})

describe('formatWasteQuantity', () => {
  it('hasta 3 decimales, con el formato del idioma', () => {
    expect(formatWasteQuantity('2.5', 'es-MX')).toBe('2.5')
    expect(formatWasteQuantity('1234.1234', 'es-MX')).toBe('1,234.123')
    expect(formatWasteQuantity(3, 'es-MX')).toBe('3')
  })
  it('vacío es una raya, nunca 0', () => {
    expect(formatWasteQuantity(null, 'es-MX')).toBe('—')
    expect(formatWasteQuantity('', 'es-MX')).toBe('—')
  })
})
