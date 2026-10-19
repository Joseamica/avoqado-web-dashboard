import { describe, expect, it } from 'vitest'
import { apiErrorDescription, mensajeDelServidor4xx } from '../apiError'

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

// 17-oct: los toasts de la configuración de la organización muestran el motivo del 403 («Sólo el dueño de la
// organización puede…») en vez del genérico. Sólo para 4xx y sólo `message`.
describe('mensajeDelServidor4xx', () => {
  it('un 4xx con `message` → ese texto', () => {
    expect(mensajeDelServidor4xx({ response: { status: 403, data: { message: 'Sólo el dueño…', code: 'ORG_OWNER_REQUIRED' } } })).toBe(
      'Sólo el dueño…',
    )
  })

  it('un 5xx, aunque traiga `message`, no sale al usuario', () => {
    expect(mensajeDelServidor4xx({ response: { status: 500, data: { message: 'Cannot read properties of undefined' } } })).toBeUndefined()
  })

  it('un 4xx que sólo trae un código en `error` (no un texto para personas) → nada', () => {
    expect(mensajeDelServidor4xx({ response: { status: 403, data: { error: 'forbidden' } } })).toBeUndefined()
  })

  it('sin respuesta (red) o con `message` vacío → nada', () => {
    expect(mensajeDelServidor4xx(new Error('Network Error'))).toBeUndefined()
    expect(mensajeDelServidor4xx({ response: { status: 400, data: { message: '  ' } } })).toBeUndefined()
    expect(mensajeDelServidor4xx(undefined)).toBeUndefined()
  })
})
