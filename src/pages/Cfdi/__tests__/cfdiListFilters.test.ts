/**
 * Testarudo, 24-sep-2026: «el sistema de filtrado de Facturas no sirve».
 *  - El selector pintaba «24 sep – 24 sep» y la lista no filtraba NADA (la etiqueta y el filtro eran dos
 *    estados distintos).
 *  - «Pendiente» y «Error» no existen en el servidor (400), y marcar dos opciones filtraba sólo una.
 * Estas pruebas fijan la lógica pura que ahora usa la pantalla.
 */
import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import {
  STATUS_GROUPS,
  estatusDelServidor,
  mesEnCurso,
  insigniaDeEstatus,
  sePuedeReenviar,
  sePuedeConsultarLaCancelacion,
  sePuedeTerminarLaSustitucion,
  recordarCancelacionEnDuda,
  conDudaConocida,
  olvidarCancelacionesEnDuda,
  VIGENCIA_DE_LA_DUDA_CONOCIDA_MS,
} from '../cfdiListFilters'

describe('estatusDelServidor — grupos de la pantalla → estatus reales', () => {
  it('cada grupo se traduce a estatus que el servidor SÍ conoce', () => {
    const validos = ['DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'STAMPING', 'STAMPED', 'STAMP_FAILED', 'CANCEL_REQUESTED', 'CANCELLED']
    for (const g of STATUS_GROUPS) for (const s of estatusDelServidor([g])) expect(validos).toContain(s)
  })

  it('varios grupos se suman (antes sólo contaba el último que marcabas)', () => {
    expect(estatusDelServidor(['STAMPED', 'CANCELLED'])).toEqual(['STAMPED', 'CANCELLED'])
    expect(estatusDelServidor(['FAILED'])).toEqual(['VALIDATION_FAILED', 'STAMP_FAILED'])
  })

  it('sin grupos ⇒ sin filtro', () => {
    expect(estatusDelServidor([])).toEqual([])
  })
})

describe('mesEnCurso — el rango por defecto (como Facturapi)', () => {
  it('va del día 1 del mes a hoy, en el huso del NEGOCIO', () => {
    const ahora = DateTime.fromISO('2026-09-24T20:30:00', { zone: 'America/Mexico_City' })
    const { from, to } = mesEnCurso('America/Mexico_City', ahora)
    expect(DateTime.fromJSDate(from).setZone('America/Mexico_City').toISODate()).toBe('2026-09-01')
    expect(DateTime.fromJSDate(to).setZone('America/Mexico_City').toISODate()).toBe('2026-09-24')
  })

  it('a las 23:30 de México (ya 25 en UTC) sigue siendo el 24', () => {
    const ahora = DateTime.fromISO('2026-09-24T23:30:00', { zone: 'America/Mexico_City' })
    const { to } = mesEnCurso('America/Mexico_City', ahora)
    expect(DateTime.fromJSDate(to).setZone('America/Mexico_City').toISODate()).toBe('2026-09-24')
  })
})

describe('insigniaDeEstatus — la lista no puede decir «Timbrada» de una factura que se está cancelando', () => {
  it('timbrada con la cancelación en trámite ⇒ «Cancelación en trámite»', () => {
    expect(insigniaDeEstatus({ status: 'STAMPED', cancelStatus: 'REQUESTED' }).clave).toBe('CANCEL_PENDING')
  })

  it('cancelada ⇒ «Cancelada» en rojo', () => {
    expect(insigniaDeEstatus({ status: 'CANCELLED', cancelStatus: 'CANCELLED' })).toEqual({ clave: 'CANCELLED', variante: 'destructive' })
  })

  it('timbrada y viva ⇒ «Timbrada»; la cancelación rechazada la deja viva', () => {
    expect(insigniaDeEstatus({ status: 'STAMPED', cancelStatus: null }).clave).toBe('STAMPED')
    expect(insigniaDeEstatus({ status: 'STAMPED', cancelStatus: 'REJECTED' }).clave).toBe('STAMPED')
  })

  it('los fallos de timbrado se ven como error', () => {
    expect(insigniaDeEstatus({ status: 'STAMP_FAILED', cancelStatus: null }).variante).toBe('destructive')
    expect(insigniaDeEstatus({ status: 'VALIDATION_FAILED', cancelStatus: null }).variante).toBe('destructive')
  })
})

// 🔴 H24 (Codex, ronda 2 del correo): una cancelación RECHAZADA deja la factura vigente; el botón no puede desaparecer ahí.
describe('sePuedeReenviar — «Reenviar por correo» en el menú de la factura', () => {
  it.each([
    ['timbrada', { status: 'STAMPED', cancelStatus: null }, true],
    ['timbrada con la cancelación rechazada (sigue vigente)', { status: 'STAMPED', cancelStatus: 'REJECTED' }, true],
    ['timbrada con la cancelación en trámite', { status: 'STAMPED', cancelStatus: 'REQUESTED' }, false],
    ['cancelada', { status: 'CANCELLED', cancelStatus: 'ACCEPTED' }, false],
    ['con error', { status: 'STAMP_FAILED', cancelStatus: null }, false],
  ])('%s', (_label, cfdi, esperado) => {
    expect(sePuedeReenviar(cfdi)).toBe(esperado)
  })
})

// ─── C2 · Tarea 10, ronda 1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('C2 · T10 ronda 1 (M6) — la insignia se elige por `estadoCancelacion` cuando viene', () => {
  const pedida = (estadoCancelacion: any) => ({ status: 'STAMPED', cancelStatus: 'REQUESTED', estadoCancelacion })
  it('🔴 enviándose o anotada ⇒ CANCEL_SENDING; en duda ⇒ CANCEL_IN_DOUBT; en trámite ⇒ CANCEL_PENDING', () => {
    expect(insigniaDeEstatus(pedida('ENVIANDO')).clave).toBe('CANCEL_SENDING')
    expect(insigniaDeEstatus(pedida('ANOTADA')).clave).toBe('CANCEL_SENDING')
    expect(insigniaDeEstatus(pedida('CANCELACION_EN_DUDA')).clave).toBe('CANCEL_IN_DOUBT')
    expect(insigniaDeEstatus(pedida('EN_TRAMITE')).clave).toBe('CANCEL_PENDING')
  })
  it('control — sin `estadoCancelacion` (servidor anterior) la de siempre; rechazada sigue «Timbrada»', () => {
    expect(insigniaDeEstatus({ status: 'STAMPED', cancelStatus: 'REQUESTED' }).clave).toBe('CANCEL_PENDING')
    expect(insigniaDeEstatus({ status: 'STAMPED', cancelStatus: 'REJECTED', estadoCancelacion: 'RECHAZADA' } as any).clave).toBe('STAMPED')
  })
})

describe('C2 · T10 ronda 1 (I-1) — «Consultar estado» con CUALQUIER cancelación pedida (ya no puede enviar nada)', () => {
  it('🔴 REQUESTED en cualquier estado fino (también enviándose o anotada, y sin estado fino)', () => {
    for (const e of ['ANOTADA', 'ENVIANDO', 'CANCELACION_EN_DUDA', 'EN_TRAMITE', undefined, null])
      expect([e, sePuedeConsultarLaCancelacion({ status: 'STAMPED', cancelStatus: 'REQUESTED', estadoCancelacion: e as any })]).toEqual([
        e,
        true,
      ])
  })
  it('control — sin cancelación pedida, rechazada o cancelada, no', () => {
    expect(sePuedeConsultarLaCancelacion({ status: 'STAMPED', cancelStatus: null })).toBe(false)
    expect(sePuedeConsultarLaCancelacion({ status: 'STAMPED', cancelStatus: 'REJECTED' })).toBe(false)
    expect(sePuedeConsultarLaCancelacion({ status: 'CANCELLED', cancelStatus: 'ACCEPTED' })).toBe(false)
  })
})

describe('C2 · T10 ronda 1 (I-2) — «Terminar la sustitución»', () => {
  const sub = (status: string) => [{ id: 's', status }]
  it('🔴 la original timbrada, sin cancelación viva y con una sustituta TIMBRADA', () => {
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: null, replacedBy: sub('STAMPED') })).toBe(true)
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: 'REJECTED', replacedBy: sub('STAMPED') })).toBe(true)
  })
  it('control — con la sustituta sin timbrar, con la cancelación viva, cancelada o sin sustituta, no', () => {
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: null, replacedBy: sub('STAMPING') })).toBe(false)
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: 'REQUESTED', replacedBy: sub('STAMPED') })).toBe(false)
    expect(sePuedeTerminarLaSustitucion({ status: 'CANCELLED', cancelStatus: 'ACCEPTED', replacedBy: sub('STAMPED') })).toBe(false)
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: null })).toBe(false)
    expect(sePuedeTerminarLaSustitucion({ status: 'STAMPED', cancelStatus: null, replacedBy: [] })).toBe(false)
  })
})

// C2 · ronda QA (D6): un `STAMP_FAILED` que se envió y no tuvo respuesta clara (`timbreEnDuda`) no es «Rechazada por el SAT».
describe('C2 · ronda QA (D6) — la insignia de un timbre en duda', () => {
  it('🔴 `timbreEnDuda` ⇒ STAMP_IN_DOUBT (gris), nunca «rechazada»', () => {
    expect(insigniaDeEstatus({ status: 'STAMP_FAILED', timbreEnDuda: true })).toEqual({ clave: 'STAMP_IN_DOUBT', variante: 'secondary' })
  })
  it('control — sin el campo (rechazo, o servidor viejo) ⇒ STAMP_FAILED en rojo, como antes', () => {
    expect(insigniaDeEstatus({ status: 'STAMP_FAILED' })).toEqual({ clave: 'STAMP_FAILED', variante: 'destructive' })
  })
})

// C2 · ronda QA (D4): tras una respuesta `enDuda`, la pestaña no dice «enviando» de ESA factura durante la ventana del reloj del servidor.
describe('C2 · ronda QA (D4) — la duda que esta pestaña ya conoce', () => {
  const T0 = 1_000_000
  const fila = (id: string, estadoCancelacion: any) => ({ id, estadoCancelacion })
  it('🔴 recordada ⇒ ENVIANDO/ANOTADA de ESA factura se leen CANCELACION_EN_DUDA dentro de la ventana; otra factura no cambia', () => {
    olvidarCancelacionesEnDuda()
    recordarCancelacionEnDuda('a', T0)
    expect(conDudaConocida(fila('a', 'ENVIANDO'), T0 + 30_000).estadoCancelacion).toBe('CANCELACION_EN_DUDA')
    expect(conDudaConocida(fila('a', 'ANOTADA'), T0 + 30_000).estadoCancelacion).toBe('CANCELACION_EN_DUDA')
    expect(conDudaConocida(fila('b', 'ENVIANDO'), T0 + 30_000).estadoCancelacion).toBe('ENVIANDO')
  })
  it('control — lo que el servidor ya sabe manda (acuse, rechazo, cancelada); pasada la ventana, lo del servidor', () => {
    olvidarCancelacionesEnDuda()
    recordarCancelacionEnDuda('a', T0)
    for (const e of ['EN_TRAMITE', 'RECHAZADA', 'CANCELADA', 'CANCELACION_EN_DUDA', null] as const)
      expect([e, conDudaConocida(fila('a', e), T0 + 30_000).estadoCancelacion]).toEqual([e, e])
    expect(conDudaConocida(fila('a', 'ENVIANDO'), T0 + VIGENCIA_DE_LA_DUDA_CONOCIDA_MS + 1).estadoCancelacion).toBe('ENVIANDO')
  })
})
