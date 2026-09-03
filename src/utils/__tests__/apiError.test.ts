import { describe, expect, it } from 'vitest'
import { apiErrorDescription } from '../apiError'

// Caso real (2026-09-01): el server respondía el motivo exacto del 409 en
// { error: '...' }, el toast leía sólo data.message y el founder vio el
// genérico de axios «Request failed with status code 409» 7 veces seguidas.
describe('apiErrorDescription', () => {
  it('prefiere data.message cuando existe', () => {
    const err = { response: { data: { message: 'mensaje del server' } }, message: 'Request failed with status code 409' }
    expect(apiErrorDescription(err)).toBe('mensaje del server')
  })

  it('cae a data.error cuando el server responde { error } (contrato de los controladores CFDI)', () => {
    const err = {
      response: { data: { error: 'El emisor debe provisionarse antes de subir el CSD' } },
      message: 'Request failed with status code 409',
    }
    expect(apiErrorDescription(err)).toBe('El emisor debe provisionarse antes de subir el CSD')
  })

  it('cae al message de axios cuando el body no trae nada legible', () => {
    const err = { response: { data: {} }, message: 'Network Error' }
    expect(apiErrorDescription(err)).toBe('Network Error')
  })

  it('devuelve cadena vacía ante un error sin forma conocida', () => {
    expect(apiErrorDescription(undefined)).toBe('')
    expect(apiErrorDescription({})).toBe('')
  })
})
