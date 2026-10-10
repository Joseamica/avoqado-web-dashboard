/**
 * C1 · Tarea 13, ronda 1 (I4, I5, M2, M8) — el aviso de cada desenlace del disparo de la factura global, compartido por el botón de hoy,
 * el panel de periodos y la complementaria. Es la entrada principal del flujo «cuántas ventas no entraron»: el segundo aviso con el
 * resumen y «Ver cuáles».
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))
const m = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))

import { avisoDeError, rangoFiscal, totalExcluidas, useAvisoDeLaGlobal } from '../facturaGlobalUi'

const g = es.globalInvoice
const timbrada = {
  cfdi: {
    id: 'g1',
    uuid: 'U',
    serie: 'G',
    folio: '12',
    globalPeriod: { periodicidad: 'MENSUAL' as const, meses: '09', anio: 2026 },
    pdfUrl: null,
  },
}
const conError = (status: number | undefined, data?: unknown) =>
  status ? { response: { status, data }, message: `Request failed with status code ${status}` } : { message: 'Network Error' }

describe('avisoDeError (I4, I5)', () => {
  it('control — I5: el 409 del sello digital sigue siendo «CSD inactivo» con el texto del servidor', () => {
    const texto = 'El sello digital (CSD) del emisor no está activo.'
    expect(avisoDeError(traducir, conError(409, { error: texto, reason: 'CSD inactivo' }))).toEqual({
      title: g.toast.csdInactiveTitle,
      description: texto,
    })
  })
  it('control — el 409 «se está procesando» y el de la complementaria («Se está emitiendo») dicen «Se está emitiendo; intenta en un minuto»', () => {
    expect(
      avisoDeError(traducir, conError(409, { error: 'La factura de esta venta se está procesando; intenta de nuevo en unos minutos.' }))
        .title,
    ).toBe(g.periods.busy)
    expect(avisoDeError(traducir, conError(409, { error: 'Se está emitiendo; intenta en un minuto' })).title).toBe(g.periods.busy)
  })
  it('control — otro 409 («requiere revisión de soporte») lleva el título genérico y el texto del servidor', () => {
    const texto = 'La entrada fiscal de esta factura requiere revisión de soporte.'
    expect(avisoDeError(traducir, conError(409, { error: texto }))).toEqual({ title: g.toast.genericTitle, description: texto })
  })
  it('control — 422 con motivos, 502 del PAC, 404 y 400 con el texto del servidor', () => {
    expect(avisoDeError(traducir, conError(422, { error: 'No se pudo generar la factura global', reasons: ['uno', 'dos'] }))).toEqual({
      title: 'No se pudo generar la factura global',
      description: 'uno · dos',
    })
    expect(avisoDeError(traducir, conError(502, { error: 'El PAC rechazó…', message: 'CSD vencido' }))).toEqual({
      title: g.toast.pacRejectedTitle,
      description: 'CSD vencido',
    })
    expect(avisoDeError(traducir, conError(404, { error: 'Emisor fiscal no encontrado' }))).toEqual({
      title: g.toast.notFoundTitle,
      description: 'Emisor fiscal no encontrado',
    })
    expect(avisoDeError(traducir, conError(400, { error: 'Ese periodo ya no se emite desde aquí; pídelo a soporte.' }))).toEqual({
      title: g.toast.genericTitle,
      description: 'Ese periodo ya no se emite desde aquí; pídelo a soporte.',
    })
  })
  it.each([
    ['524 de Cloudflare', conError(524, 'error code: 524')],
    ['504 del proxy', conError(504, '<html>Gateway Timeout</html>')],
    ['502 sin cuerpo nuestro', conError(502, '<html>Bad gateway</html>')],
    ['sin respuesta (la red se cortó)', conError(undefined)],
  ])('🔴 I4 · %s: un aviso honesto en español («no sabemos si se emitió»), nunca «Request failed…» de axios', (_n, err) => {
    const aviso = avisoDeError(traducir, err)
    expect(aviso).toEqual({ title: g.toast.uncertainTitle, description: g.toast.uncertainDescription })
    expect(JSON.stringify(aviso)).not.toMatch(/Request failed|Network Error/)
  })
  it('🔴 I4 · un 500 sin texto del servidor usa el texto de la pantalla, nunca el de axios', () => {
    const aviso = avisoDeError(traducir, conError(500, '<html>oops</html>'))
    expect(aviso.title).toBe(g.toast.genericTitle)
    expect(aviso.description ?? '').not.toMatch(/Request failed/)
  })
})

describe('totalExcluidas (M2)', () => {
  it('control — suma los motivos', () => expect(totalExcluidas({ excluidas: { EFECTIVO: 2, PRODUCTO_POR_REVISAR: 1 } })).toBe(3))
  it('🔴 una entrada v1 manda `excluidas: {}` con el campo viejo > 0: cuenta el campo viejo', () =>
    expect(totalExcluidas({ excluidas: {}, excluidasPorIvaMixto: 3 })).toBe(3))
  it('control — sin `excluidas` (servidor viejo), el campo viejo', () => expect(totalExcluidas({ excluidasPorIvaMixto: 2 })).toBe(2))
})

describe('useAvisoDeLaGlobal (I5, M8)', () => {
  const aviso = () => renderHook(() => useAvisoDeLaGlobal()).result.current
  const segundo = () => m.toast.mock.calls.map(c => c[0]).find(a => a.title === traducir('globalInvoice.excluded.summary', { count: 2 }))

  it('control — I5: timbrada con `excluidas: { EFECTIVO: 2 }` ⇒ un segundo aviso con el resumen, y su «Ver cuáles» abre el listado', () => {
    const onVerExcluidas = vi.fn()
    aviso().avisarResultado({ ...timbrada, excluidas: { EFECTIVO: 2 } }, { onVerExcluidas })
    expect(m.toast).toHaveBeenCalledTimes(2)
    expect(m.toast.mock.calls[0][0]).toMatchObject({ title: traducir('globalInvoice.toast.stampedTitle', { folio: 'G-12' }) })
    const accion = segundo()?.action
    expect(accion?.props.children).toBe(g.excluded.see)
    accion.props.onClick()
    expect(onVerExcluidas).toHaveBeenCalledTimes(1)
  })

  it('🔴 «nada que facturar» con sólo el campo viejo (`excluidasPorIvaMixto: 2`) también lo ofrece', () => {
    aviso().avisarResultado(
      { status: 'NOTHING_TO_INVOICE', message: 'No hay tickets', excluidas: {}, excluidasPorIvaMixto: 2 },
      { onVerExcluidas: vi.fn() },
    )
    expect(segundo()).toBeDefined()
  })

  it('control — sin ventas fuera no hay segundo aviso', () => {
    aviso().avisarResultado({ ...timbrada, excluidas: {} }, { onVerExcluidas: vi.fn() })
    expect(m.toast).toHaveBeenCalledTimes(1)
  })

  it('🔴 M8 · un 422 que trae `excluidas` también ofrece «Ver cuáles» (es cuando más hace falta)', () => {
    const onVerExcluidas = vi.fn()
    aviso().avisarError(conError(422, { error: 'No se pudo generar la factura global', reasons: ['x'], excluidas: { NO_CUADRA: 2 } }), {
      onVerExcluidas,
    })
    expect(m.toast.mock.calls[0][0]).toMatchObject({ variant: 'destructive' })
    segundo()?.action.props.onClick()
    expect(onVerExcluidas).toHaveBeenCalledTimes(1)
  })

  it('🔴 ronda 2 · `yaTimbrada` se mira PRIMERO: el aviso dice que ya estaba timbrada (con el texto del servidor), nunca «timbrada» a secas', () => {
    const message = 'La factura global de este periodo ya estaba timbrada; no se emitió otra.'
    aviso().avisarResultado({ status: 'YA_TIMBRADA', yaTimbrada: true, message, excluidas: {}, cfdi: timbrada.cfdi })
    const primero = m.toast.mock.calls[0][0]
    expect(primero.title).toBe(traducir('globalInvoice.toast.alreadyStampedTitle', { folio: 'G-12' }))
    expect(primero.description).toContain(message)
    expect(JSON.stringify(m.toast.mock.calls)).not.toContain(traducir('globalInvoice.toast.stampedTitle', { folio: 'G-12' }))
  })

  it('🔴 ronda 2 · el resumen dice POR QUÉ, también `SIN_TERMINAL` (cobrada fuera de la terminal)', () => {
    aviso().avisarResultado({ ...timbrada, excluidas: { SIN_TERMINAL: 3, PRODUCTO_POR_REVISAR: 1 } }, { onVerExcluidas: vi.fn() })
    const resumen = m.toast.mock.calls.map(c => c[0]).find(a => a.title === traducir('globalInvoice.excluded.summary', { count: 4 }))
    expect(resumen?.description).toContain(
      traducir('globalInvoice.excluded.motiveItem', { label: g.excluded.motives.SIN_TERMINAL, count: 3 }),
    )
  })

  it('🔴 I3 · el periodo de un aviso emitido desde el panel se escribe en la zona fiscal', () => {
    aviso().avisarResultado(timbrada, { periodo: rangoFiscal('2026-10-04T06:00:00.000Z', '2026-10-05T06:00:00.000Z', 'es') })
    expect(m.toast.mock.calls[0][0].description).toMatch(/4 oct/)
  })
})

describe('rangoFiscal (I3)', () => {
  it('🔴 un día de CDMX es ese día, aunque el navegador o el negocio estén en otra zona', () => {
    expect(rangoFiscal('2026-10-04T06:00:00.000Z', '2026-10-05T06:00:00.000Z', 'es')).toMatch(/^4 oct\.? 2026$/)
  })
  it('🔴 un mes de CDMX es del 1 al último día', () => {
    expect(rangoFiscal('2026-09-01T06:00:00.000Z', '2026-10-01T06:00:00.000Z', 'es')).toMatch(/^1 sept?\.? 2026 – 30 sept?\.? 2026$/)
  })
})

// Ronda QA (hermanos): la global que quedó EN DUDA (el PAC no contestó claro) no es «El PAC rechazó el timbrado de la factura global» ni el
// error crudo («fetch failed»): el servidor manda `timbreEnDuda: true` en el 502 y el aviso lo dice así.
describe('avisoDeError — ronda QA (hermanos): timbre en duda', () => {
  it('🔴 502 con `timbreEnDuda` ⇒ «No hubo respuesta clara del PAC» y que no se vuelva a emitir, nunca «fetch failed»', () => {
    const aviso = avisoDeError(
      traducir,
      conError(502, { error: 'El PAC rechazó el timbrado de la factura global', message: 'fetch failed', timbreEnDuda: true }),
    )
    expect(aviso).toEqual({ title: g.toast.pacNoAnswerTitle, description: g.toast.pacNoAnswerDescription })
    expect(JSON.stringify(aviso)).not.toMatch(/fetch failed|rechaz/i)
  })
})
