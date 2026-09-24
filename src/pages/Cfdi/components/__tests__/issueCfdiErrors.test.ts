/**
 * /full-testing 24-sep-2026:
 *  - El aviso «Esta venta ya tiene factura…» trae la instrucción completa (cancela la FT-901 / Corregir
 *    importe) y se iba en 5 s: no da tiempo de leerlo.
 *  - Una venta de OTRO negocio mostraba el título «No se pudo determinar quién factura», que habla del emisor.
 */
import { describe, it, expect } from 'vitest'
import es from '@/locales/es/cfdi.json'
import { avisoDeErrorAlFacturar, DURACION_AVISO_LARGO_MS } from '../issueCfdiErrors'

const t = (key: string) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  return typeof raw === 'string' ? raw : key
}

describe('avisoDeErrorAlFacturar', () => {
  it('409 ya tiene factura ⇒ título propio y se queda en pantalla el tiempo largo', () => {
    const a = avisoDeErrorAlFacturar(409, { code: 'CFDI_ALREADY_ISSUED', error: 'Esta venta ya tiene la factura FT-901 vigente…' }, t)
    expect(a.title).toBe(es.issueDialog.errors.alreadyIssued)
    expect(a.description).toMatch(/FT-901/)
    expect(a.duration).toBe(DURACION_AVISO_LARGO_MS)
    expect(DURACION_AVISO_LARGO_MS).toBeGreaterThanOrEqual(12000)
  })

  it('409 cancelación en trámite ⇒ título propio y tiempo largo', () => {
    const a = avisoDeErrorAlFacturar(409, { code: 'CFDI_CANCEL_PENDING', error: 'sigue en trámite' }, t)
    expect(a.title).toBe(es.issueDialog.errors.cancelPending)
    expect(a.duration).toBe(DURACION_AVISO_LARGO_MS)
  })

  it('404 venta de otro negocio ⇒ «no existe o no es de este negocio», sin hablar de emisores', () => {
    const a = avisoDeErrorAlFacturar(404, { code: 'ORDER_NOT_FOUND', error: 'Esta venta no existe o no es de este negocio.' }, t)
    expect(a.title).toBe(es.issueDialog.errors.orderNotFound)
    expect(a.title).not.toMatch(/factura esta venta|emisor/i)
  })

  it('404 sin emisor ⇒ el título de siempre, con el tiempo largo (trae instrucciones)', () => {
    const a = avisoDeErrorAlFacturar(404, { code: 'CFDI_NO_EMISOR', error: 'No se pudo determinar…' }, t)
    expect(a.title).toBe(es.issueDialog.errors.notFound)
    expect(a.duration).toBe(DURACION_AVISO_LARGO_MS)
  })

  it('REGRESIÓN: 409 genérico («en proceso») conserva su título y la duración normal', () => {
    const a = avisoDeErrorAlFacturar(409, { error: 'CFDI en proceso para esta orden' }, t)
    expect(a.title).toBe(es.issueDialog.errors.conflict)
    expect(a.duration).toBeUndefined()
  })
})
