import { describe, expect, it } from 'vitest'
import type {
  GiftCardActivityType,
  GiftCardCancelReason,
  GiftCardReason,
  GiftCardSettingsView,
} from '@/types/giftCard'
import {
  MINIMO_POR_SOBRE,
  MOTIVOS_POR_ACCION,
  NOTA_MAXIMA,
  TOPE_POR_TARJETA,
  accionesDisponibles,
  borradorDesde,
  estadoVisible,
  leerMonto,
  montoDelMovimiento,
  motivoSinVenta,
  signoDe,
  textoDelServidorConCodigo,
  ultimos4,
  validarAjuste,
  validarMotivoYNota,
  validarReglas,
  varianteDeEstado,
} from '../giftCardText'

const AHORA = new Date('2026-10-14T18:00:00.000Z')

describe('lo que se enseña de una tarjeta', () => {
  it('sólo los últimos 4 del código', () => {
    expect(ultimos4('4821')).toBe('•••• 4821')
  })
  it('una activa con la fecha pasada se lee «vencida» (la calcula el panel con `expiresAt`); las demás, su estado', () => {
    expect(estadoVisible({ status: 'ACTIVE', expiresAt: '2026-10-14T17:59:59.000Z' }, AHORA)).toBe('EXPIRED')
    expect(estadoVisible({ status: 'ACTIVE', expiresAt: '2026-10-14T18:00:00.000Z' }, AHORA)).toBe('EXPIRED')
    expect(estadoVisible({ status: 'ACTIVE', expiresAt: '2026-10-15T00:00:00.000Z' }, AHORA)).toBe('ACTIVE')
    expect(estadoVisible({ status: 'ACTIVE', expiresAt: null }, AHORA)).toBe('ACTIVE')
    expect(estadoVisible({ status: 'BLOCKED', expiresAt: '2026-10-01T00:00:00.000Z' }, AHORA)).toBe('BLOCKED')
  })
  it('cada estado tiene su variante del tema', () => {
    expect(varianteDeEstado('ACTIVE')).toBe('default')
    expect(varianteDeEstado('BLOCKED')).toBe('destructive')
    expect(varianteDeEstado('DEACTIVATED')).toBe('secondary')
    expect(varianteDeEstado('EXPIRED')).toBe('outline')
    expect(varianteDeEstado('PENDING')).toBe('outline')
  })
})

describe('la libreta', () => {
  it('suman: activar, reverso y ajuste a favor; restan: canje, ajuste en contra y cancelar; el resto no mueve dinero', () => {
    const suma: GiftCardActivityType[] = ['ACTIVATE', 'REDEEM_REVERSAL', 'ADJUST_INCREMENT']
    const resta: GiftCardActivityType[] = ['REDEEM', 'ADJUST_DECREMENT', 'DEACTIVATE']
    const nada: GiftCardActivityType[] = ['BLOCK', 'UNBLOCK', 'CLAIM', 'CODE_REPLACED']
    for (const t of suma) expect(signoDe(t)).toBe(1)
    for (const t of resta) expect(signoDe(t)).toBe(-1)
    for (const t of nada) expect(signoDe(t)).toBe(0)
  })
  it('el monto lleva su signo; un bloqueo o un monto cero se ve «—»', () => {
    expect(montoDelMovimiento('ACTIVATE', 500)).toMatch(/^\+\$500\.00$/)
    expect(montoDelMovimiento('REDEEM', 120.5)).toMatch(/^−\$120\.50$/)
    expect(montoDelMovimiento('BLOCK', 0)).toBe('—')
    expect(montoDelMovimiento('DEACTIVATE', 0)).toBe('—')
  })
})

describe('montos tecleados', () => {
  it('acepta enteros, 2 decimales, comas de miles y el signo de pesos', () => {
    expect(leerMonto('150')).toBe(150)
    expect(leerMonto('150.5')).toBe(150.5)
    expect(leerMonto('1,500.00')).toBe(1500)
    expect(leerMonto('$500')).toBe(500)
  })
  it('rechaza vacío, letras, 3 decimales y negativos', () => {
    for (const malo of ['', 'abc', '1.234', '-5', '1e3']) expect(leerMonto(malo)).toBeNull()
  })
  it('🔴 la coma SÓLO separa miles en grupos de 3: «5,00» no son $500 (r1, I2; ante la duda, que corrija)', () => {
    for (const malo of ['5,00', '1,50', '150,50', '1,0,0', ',500', '1500,000', '1,500,00']) expect(leerMonto(malo)).toBeNull()
    expect(leerMonto('1,500')).toBe(1500)
    expect(leerMonto('1,500.50')).toBe(1500.5)
    expect(leerMonto('$ 1,500')).toBe(1500)
  })
  it('🔴 `$` sólo al inicio y espacios sólo en los extremos: «5 00» o «5$00» no son $500 (lote ⭐)', () => {
    for (const malo of ['5 00', '5$00', '$ 5 00', '500$', '$$500', '1 500.00']) expect(leerMonto(malo)).toBeNull()
    expect(leerMonto('$500')).toBe(500)
    expect(leerMonto(' 500 ')).toBe(500)
    expect(leerMonto('$1,500.50')).toBe(1500.5)
    expect(leerMonto('  $1,500.50  ')).toBe(1500.5)
  })
  it('«0» se lee 0: quien llama valida que sea positivo', () => {
    expect(leerMonto('0')).toBe(0)
  })
})

describe('validarAjuste', () => {
  const base = { direccion: 'INCREMENT' as const, cantidad: 100, saldo: 500, motivo: 'CASHIER_ERROR' as const, nota: 'Se cobró de menos' }
  it('pasa un ajuste completo', () => expect(validarAjuste(base)).toBeNull())
  it('monto vacío o cero', () => {
    expect(validarAjuste({ ...base, cantidad: null })?.key).toBe('actions.adjust.errors.amount')
    expect(validarAjuste({ ...base, cantidad: 0 })?.key).toBe('actions.adjust.errors.amount')
  })
  it('no se quita más del saldo (al centavo)', () => {
    expect(validarAjuste({ ...base, direccion: 'DECREMENT', cantidad: 500.01 })).toEqual({
      key: 'actions.adjust.errors.moreThanBalance',
      amount: 500,
    })
    expect(validarAjuste({ ...base, direccion: 'DECREMENT', cantidad: 500 })).toBeNull()
  })
  it(`ningún saldo pasa de ${TOPE_POR_TARJETA}`, () => {
    expect(validarAjuste({ ...base, saldo: 9900, cantidad: 100.01 })).toEqual({
      key: 'actions.adjust.errors.overCap',
      amount: TOPE_POR_TARJETA,
    })
    expect(validarAjuste({ ...base, saldo: 9900, cantidad: 100 })).toBeNull()
  })
  it('motivo obligatorio y nota de al menos 5 letras', () => {
    expect(validarAjuste({ ...base, motivo: '' })?.key).toBe('actions.errors.reason')
    expect(validarAjuste({ ...base, nota: ' ok ' })?.key).toBe('actions.adjust.errors.note')
  })
  it(`la nota no pasa de ${NOTA_MAXIMA} caracteres (sin contar espacios de las orillas, como el server) (r1, M5)`, () => {
    expect(validarAjuste({ ...base, nota: 'a'.repeat(NOTA_MAXIMA) })).toBeNull()
    expect(validarAjuste({ ...base, nota: `  ${'a'.repeat(NOTA_MAXIMA)}  ` })).toBeNull()
    expect(validarAjuste({ ...base, nota: 'a'.repeat(NOTA_MAXIMA + 1) })).toEqual({ key: 'actions.errors.noteTooLong' })
  })
})

describe('validarMotivoYNota (bloquear y desbloquear)', () => {
  it('motivo obligatorio; nota sólo con «Otro motivo»', () => {
    expect(validarMotivoYNota({ motivo: '', nota: '' })?.key).toBe('actions.errors.reason')
    expect(validarMotivoYNota({ motivo: 'SUSPICIOUS_ACTIVITY', nota: '' })).toBeNull()
    expect(validarMotivoYNota({ motivo: 'OTHER', nota: 'no' })?.key).toBe('actions.errors.noteForOther')
    expect(validarMotivoYNota({ motivo: 'OTHER', nota: 'Lo pidió el banco' })).toBeNull()
  })
  it(`con cualquier motivo, la nota no pasa de ${NOTA_MAXIMA} caracteres (r1, M5)`, () => {
    expect(validarMotivoYNota({ motivo: 'SUSPICIOUS_ACTIVITY', nota: 'a'.repeat(NOTA_MAXIMA) })).toBeNull()
    expect(validarMotivoYNota({ motivo: 'SUSPICIOUS_ACTIVITY', nota: 'a'.repeat(NOTA_MAXIMA + 1) })).toEqual({
      key: 'actions.errors.noteTooLong',
    })
    expect(validarMotivoYNota({ motivo: 'OTHER', nota: 'a'.repeat(NOTA_MAXIMA + 1) })?.key).toBe('actions.errors.noteTooLong')
  })
  it('cada acción ofrece «Otro motivo» y nunca los motivos que pone el sistema', () => {
    for (const lista of Object.values(MOTIVOS_POR_ACCION)) {
      expect(lista).toContain('OTHER')
      expect(lista).not.toContain('CANCEL_IN_PROGRESS')
      expect(lista).not.toContain('SALE_CANCELLED')
    }
  })
})

describe('accionesDisponibles', () => {
  /** Lo que lee la función del detalle de C4: estado, `cancel` y `currentBlock` del server (nunca la libreta paginada). */
  type Entrada = Parameters<typeof accionesDisponibles>[0]
  /** `cancel` tal cual lo manda el server (C4, mismo predicado que iniciarCancelacionDeVenta). */
  const cancel = (allowed: boolean, reason: GiftCardCancelReason | null = null, message: string | null = null) => ({
    allowed,
    reason,
    message,
  })
  const bloqueo = (reason: GiftCardReason) => ({ reason, note: null, at: '2026-10-12T10:00:00.000Z' })
  const d = (over: Partial<Entrada> = {}): Entrada => ({
    status: 'ACTIVE',
    canReplaceCode: true,
    cancel: cancel(true),
    currentBlock: null,
    order: { id: 'o1', orderNumber: 'A-1' },
    ...over,
  })

  it('activa: ajustar, bloquear, reponer y cancelar la venta', () => {
    expect(accionesDisponibles(d())).toEqual({
      ajustar: true,
      bloquear: true,
      desbloquear: false,
      reponer: true,
      cancelarVenta: true,
      ventaEnCancelacion: false,
    })
  })
  it('bloqueada por el gerente (`currentBlock` del server): ajustar y desbloquear', () => {
    const a = accionesDisponibles(d({ status: 'BLOCKED', currentBlock: bloqueo('SUSPICIOUS_ACTIVITY'), cancel: cancel(false) }))
    expect(a).toMatchObject({ ajustar: true, bloquear: false, desbloquear: true, cancelarVenta: false })
  })
  it('en cancelación: nada más que seguir o detener la cancelación', () => {
    const a = accionesDisponibles(
      d({ status: 'BLOCKED', currentBlock: bloqueo('CANCEL_IN_PROGRESS'), cancel: cancel(false, 'IN_PROGRESS') }),
    )
    expect(a).toEqual({
      ajustar: false,
      bloquear: false,
      desbloquear: false,
      reponer: false,
      cancelarVenta: false,
      ventaEnCancelacion: true,
    })
  })
  it('🔴 `cancel.reason = IN_PROGRESS` basta para protegerla (auditoría r1, D-2): nunca ajustar, desbloquear ni reponer', () => {
    const a = accionesDisponibles(d({ status: 'BLOCKED', currentBlock: null, cancel: cancel(false, 'IN_PROGRESS') }))
    expect(a).toEqual({
      ajustar: false,
      bloquear: false,
      desbloquear: false,
      reponer: false,
      cancelarVenta: false,
      ventaEnCancelacion: true,
    })
  })
  it('cancelada: ninguna', () => {
    const a = accionesDisponibles(d({ status: 'DEACTIVATED', canReplaceCode: false, cancel: cancel(false, 'ALREADY_CANCELLED') }))
    expect(Object.values(a).every(v => v === false)).toBe(true)
  })
  it('🔴 «Cancelar venta» sigue lo que dice el server: otro día o ya usada ⇒ no se ofrece', () => {
    expect(accionesDisponibles(d({ cancel: cancel(false, 'NOT_SAME_DAY') })).cancelarVenta).toBe(false)
    expect(accionesDisponibles(d({ cancel: cancel(false, 'ALREADY_USED') })).cancelarVenta).toBe(false)
  })
})

const SETTINGS: GiftCardSettingsView = {
  enabled: true,
  suggestedAmounts: [500, 1000, 2000],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 69999.99,
  llavesConfiguradas: true,
  hasCards: false,
  updatedAt: null,
}

describe('motivoSinVenta («apagado se ve y se explica»)', () => {
  const plan = { resolved: true, hasAccess: true }
  it('prendido, con plan y llaves: se vende (sin aviso)', () => {
    expect(motivoSinVenta(SETTINGS, plan)).toBeNull()
  })
  it('apagado gana sobre todo lo demás', () => {
    expect(motivoSinVenta({ ...SETTINGS, enabled: false, llavesConfiguradas: false }, { resolved: true, hasAccess: false })).toBe(
      'DISABLED',
    )
  })
  it('sin llaves del server: lo dice', () => {
    expect(motivoSinVenta({ ...SETTINGS, llavesConfiguradas: false }, plan)).toBe('KEYS_MISSING')
  })
  it('sin el plan COMPROBADO: lo dice; con el plan sin comprobar no se adivina', () => {
    expect(motivoSinVenta(SETTINGS, { resolved: true, hasAccess: false })).toBe('NOT_IN_PLAN')
    expect(motivoSinVenta(SETTINGS, { resolved: false, hasAccess: true })).toBeNull()
  })
})

describe('reglas de venta (Configuración)', () => {
  const settings = SETTINGS
  it('el borrador sale de lo guardado (números del server), sin ceros de más', () => {
    expect(borradorDesde(settings)).toEqual({ sugeridos: ['500', '1000', '2000'], minimo: '100', maximo: '10000', vigencia: 'none' })
    expect(borradorDesde({ ...settings, suggestedAmounts: [750.5], validityMonths: 24 })).toEqual({
      sugeridos: ['750.5', '', ''],
      minimo: '100',
      maximo: '10000',
      vigencia: '24',
    })
  })
  it('lo válido sale ordenado, sin repetidos y con la vigencia como número', () => {
    const r = validarReglas({ sugeridos: ['2000', '500', '500'], minimo: '200', maximo: '5000', vigencia: '12' })
    expect(r).toEqual({ ok: true, input: { suggestedAmounts: [500, 2000], minAmount: 200, maxAmount: 5000, validityMonths: 12 } })
  })
  it(`respeta el piso (${MINIMO_POR_SOBRE}) y el techo legal (${TOPE_POR_TARJETA}) de cada tarjeta`, () => {
    expect(validarReglas({ sugeridos: ['500', '', ''], minimo: '99.99', maximo: '1000', vigencia: 'none' })).toEqual({
      ok: false,
      error: { key: 'settings.rules.errors.minTooLow', amount: 100 },
    })
    expect(validarReglas({ sugeridos: ['500', '', ''], minimo: '100', maximo: '10000.01', vigencia: 'none' })).toEqual({
      ok: false,
      error: { key: 'settings.rules.errors.maxTooHigh', amount: 10000 },
    })
  })
  it('errores de captura en orden: mínimo, máximo, mínimo > máximo, sugeridos', () => {
    const v = (b: Partial<{ sugeridos: [string, string, string]; minimo: string; maximo: string }>) =>
      validarReglas({ sugeridos: ['500', '', ''], minimo: '100', maximo: '1000', vigencia: 'none', ...b })
    expect(v({ minimo: '' })).toMatchObject({ ok: false, error: { key: 'settings.rules.errors.minInvalid' } })
    expect(v({ maximo: 'mil' })).toMatchObject({ ok: false, error: { key: 'settings.rules.errors.maxInvalid' } })
    expect(v({ minimo: '2000' })).toMatchObject({ ok: false, error: { key: 'settings.rules.errors.minAboveMax' } })
    expect(v({ sugeridos: ['', '', ''] })).toMatchObject({ ok: false, error: { key: 'settings.rules.errors.suggestedRequired' } })
    expect(v({ sugeridos: ['5x', '', ''] })).toMatchObject({ ok: false, error: { key: 'settings.rules.errors.suggestedInvalid' } })
    expect(v({ sugeridos: ['1500', '', ''] })).toEqual({
      ok: false,
      error: { key: 'settings.rules.errors.suggestedOutOfRange', min: 100, max: 1000 },
    })
  })
})

describe('textoDelServidorConCodigo (nota 10: sin `code`, nunca el texto crudo)', () => {
  const conCuerpo = (status: number, data: unknown) => Object.assign(new Error(String(status)), { response: { status, data } })
  it('🔴 el cuerpo REAL del candado de plan (`error` = el código) enseña el `message` en español, nunca el código (r1, I1)', () => {
    // giftCardsPlan.middleware.ts (`reescribirNegativa`) responde las tres llaves; `error` trae el código, no un texto.
    const err = conCuerpo(403, {
      error: 'GIFT_CARDS_NOT_IN_PLAN',
      code: 'GIFT_CARDS_NOT_IN_PLAN',
      message: 'Tu plan no incluye vender tarjetas de regalo.',
    })
    expect(textoDelServidorConCodigo(err)).toBe('Tu plan no incluye vender tarjetas de regalo.')
  })
  it('un GiftCardError (`{ message, code }`, app.ts) enseña su message', () => {
    const err = conCuerpo(409, { message: 'Una de las tarjetas de esta venta está bloqueada por otro motivo.', code: 'GIFT_CARD_BLOCKED' })
    expect(textoDelServidorConCodigo(err)).toBe('Una de las tarjetas de esta venta está bloqueada por otro motivo.')
  })
  it('con `code` y sólo `error` (sin message): nada, nunca el código', () => {
    expect(textoDelServidorConCodigo(conCuerpo(403, { error: 'GIFT_CARDS_NOT_IN_PLAN', code: 'GIFT_CARDS_NOT_IN_PLAN' }))).toBeUndefined()
  })
  it('sin `code` (401/500 de checkFeatureAccess, en inglés), un 502 en HTML o sin respuesta: nada (la pantalla pone el genérico)', () => {
    expect(textoDelServidorConCodigo(conCuerpo(401, { error: 'Unauthorized', message: 'No venue context found' }))).toBeUndefined()
    expect(
      textoDelServidorConCodigo(conCuerpo(500, { error: 'Internal server error', message: 'Failed to verify feature access' })),
    ).toBeUndefined()
    expect(textoDelServidorConCodigo(conCuerpo(502, '<html>Bad Gateway</html>'))).toBeUndefined()
    expect(textoDelServidorConCodigo(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))).toBeUndefined()
    expect(textoDelServidorConCodigo(null)).toBeUndefined()
  })
  it('con `code` pero sin texto: nada', () => {
    expect(textoDelServidorConCodigo(conCuerpo(409, { code: 'GIFT_CARD_BLOCKED', message: '  ' }))).toBeUndefined()
  })
})
