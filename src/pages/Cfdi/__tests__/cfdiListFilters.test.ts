/**
 * Testarudo, 24-sep-2026: «el sistema de filtrado de Facturas no sirve».
 *  - El selector pintaba «24 sep – 24 sep» y la lista no filtraba NADA (la etiqueta y el filtro eran dos
 *    estados distintos).
 *  - «Pendiente» y «Error» no existen en el servidor (400), y marcar dos opciones filtraba sólo una.
 * Estas pruebas fijan la lógica pura que ahora usa la pantalla.
 */
import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { STATUS_GROUPS, estatusDelServidor, mesEnCurso, insigniaDeEstatus } from '../cfdiListFilters'

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
