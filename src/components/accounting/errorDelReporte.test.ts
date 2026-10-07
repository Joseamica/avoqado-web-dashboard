import { describe, expect, it } from 'vitest'

import { codigoDelReporte, mensajeDelReporte, reintentarReporte } from './errorDelReporte'

/** Un error como lo deja axios con la respuesta del servidor (`app.ts`: `{ message, code }`). */
const deAxios = (code?: string, message = 'El periodo es muy grande para calcularlo de una vez; elige un rango más corto.') => ({
  response: { data: { message, code } },
})

/** Un error de axios cuando el proxy corta la petición: trae el estado HTTP y un cuerpo que no es nuestro (HTML de Cloudflare). */
const deConEstado = (status: number) => ({ response: { status, data: '<html>error code: ' + status + '</html>' } })

describe('errorDelReporte (bloque B4b · respuesta 14; fallo 7 de la ronda 6; Codex r5 R5-8)', () => {
  it('🔴 reconoce los dos códigos del servidor y nada más', () => {
    expect(codigoDelReporte(deAxios('REPORT_TOO_LARGE'))).toBe('REPORT_TOO_LARGE')
    expect(codigoDelReporte(deAxios('REPORT_TIMEOUT'))).toBe('REPORT_TIMEOUT')
    expect(codigoDelReporte(deAxios('TERMINAL_BUSY'))).toBeNull()
    expect(codigoDelReporte(new Error('Network Error'))).toBeNull()
    expect(codigoDelReporte(null)).toBeNull()
  })

  it('🔴 el mensaje del servidor sólo para esos dos códigos; para lo demás, el genérico de la pantalla (undefined)', () => {
    expect(mensajeDelReporte(deAxios('REPORT_TIMEOUT'))).toBe(
      'El periodo es muy grande para calcularlo de una vez; elige un rango más corto.',
    )
    expect(mensajeDelReporte(deAxios('OTRO', 'algo interno'))).toBeUndefined()
    expect(mensajeDelReporte(deAxios('REPORT_TOO_LARGE', '  '))).toBeUndefined()
  })

  it('🔴 el reintento: nunca para esos dos códigos; para lo demás, las veces de siempre', () => {
    expect(reintentarReporte(1)(0, deAxios('REPORT_TIMEOUT'))).toBe(false)
    expect(reintentarReporte(3)(0, deAxios('REPORT_TOO_LARGE'))).toBe(false)
    expect(reintentarReporte(1)(0, new Error('Network Error'))).toBe(true)
    expect(reintentarReporte(1)(1, new Error('Network Error'))).toBe(false)
    expect(reintentarReporte(3)(2, deAxios('OTRO'))).toBe(true)
  })

  it('🔴 T7-I1 · el corte del proxy (524 de Cloudflare, 504) no se reintenta: repetir una consulta pesada no la arregla', () => {
    expect(reintentarReporte(3)(0, deConEstado(524))).toBe(false)
    expect(reintentarReporte(3)(0, deConEstado(504))).toBe(false)
    expect(reintentarReporte(1)(0, deConEstado(524))).toBe(false)
  })

  it('control — T7-I1 · un 500 (o un error sin respuesta) se reintenta como siempre, y un 524 con código del servidor tampoco', () => {
    expect(reintentarReporte(3)(0, deConEstado(500))).toBe(true)
    expect(reintentarReporte(3)(2, deConEstado(500))).toBe(true)
    expect(reintentarReporte(3)(3, deConEstado(500))).toBe(false) // se acabaron las veces
    expect(reintentarReporte(1)(0, new Error('Network Error'))).toBe(true)
    expect(reintentarReporte(3)(0, { response: { status: 503, data: { code: 'REPORT_TIMEOUT' } } })).toBe(false)
  })

  it('control — T7-I1 · lo demás del error genérico no cambia: un 524 no trae código ni mensaje del servidor', () => {
    expect(codigoDelReporte(deConEstado(524))).toBeNull()
    expect(mensajeDelReporte(deConEstado(524))).toBeUndefined()
  })
})
