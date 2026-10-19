import { describe, expect, it } from 'vitest'
import { codigoDelError, esCandadoDeVariantes, mensajeDeVariantes } from '@/features/product-variants/errors'

const t = ((k: string) => `[${k}]`) as never
const resp = (status: number, data: unknown) => ({ response: { status, data } })

describe('errores de variantes', () => {
  it('el 403 del plan (inglés, sin code) se reconoce por featureCode y se traduce', () => {
    const e = resp(403, { error: 'Feature not available', message: 'This venue does not…', featureCode: 'PRODUCT_VARIANTS', subscriptionRequired: true })
    expect(esCandadoDeVariantes(e)).toBe(true)
    expect(mensajeDeVariantes(e, t)).toBe('[variants:errors.planRequired]')
  })

  it('el candado vencido o suspendido también cuenta como plan', () => {
    expect(esCandadoDeVariantes(resp(403, { featureCode: 'PRODUCT_VARIANTS', trialExpired: true }))).toBe(true)
    expect(esCandadoDeVariantes(resp(403, { featureCode: 'CFDI', subscriptionRequired: true }))).toBe(false)
  })

  it('un 403 de permiso nunca se muestra en inglés', () => {
    expect(mensajeDeVariantes(resp(403, { error: 'Forbidden', message: "Permission 'menu:update' required" }), t)).toBe('[variants:errors.noPermission]')
  })

  it('los demás errores muestran el texto del server; sin respuesta = sin conexión', () => {
    const e = resp(409, { message: 'Ya existe la familia «Playera». Ábrela para agregarle variantes.', code: 'PRODUCT_GROUP_NAME_TAKEN' })
    expect(mensajeDeVariantes(e, t)).toBe('Ya existe la familia «Playera». Ábrela para agregarle variantes.')
    expect(codigoDelError(e)).toBe('PRODUCT_GROUP_NAME_TAKEN')
    expect(mensajeDeVariantes(new Error('Network Error'), t)).toBe('[variants:errors.network]')
    expect(mensajeDeVariantes(resp(502, '<html>'), t)).toBe('[variants:errors.generic]')
  })
})
