import { describe, it, expect } from 'vitest'
import { motivoDelError } from '../motivoDelError'

const axiosErr = (data: unknown, message = 'Request failed with status code 400') => ({ message, response: { data } })

describe('motivoDelError', () => {
  it('gana message del servidor', () => {
    expect(motivoDelError(axiosErr({ message: 'Falta el nombre', error: 'otro' }), 'resp')).toBe('Falta el nombre')
  })
  it('si sólo hay error, usa error', () => {
    expect(motivoDelError(axiosErr({ error: 'Código inválido' }), 'resp')).toBe('Código inválido')
  })
  it('sin ninguno usa el respaldo', () => {
    expect(motivoDelError(axiosErr({}), 'No se pudo guardar')).toBe('No se pudo guardar')
  })
  it('sin respaldo usa err.message', () => {
    expect(motivoDelError(axiosErr({}))).toBe('Request failed with status code 400')
  })
  it('message vacío o en blanco cae a error', () => {
    expect(motivoDelError(axiosErr({ message: '  ', error: 'X' }))).toBe('X')
  })
  it('data que es texto o null', () => {
    expect(motivoDelError(axiosErr('<html>'), 'resp')).toBe('resp')
    expect(motivoDelError(axiosErr(null))).toBe('Request failed with status code 400')
  })
  it('error que no es de axios', () => {
    expect(motivoDelError(new Error('boom'))).toBe('boom')
    expect(motivoDelError('texto', 'resp')).toBe('resp')
    expect(motivoDelError(undefined)).toBe('Ocurrió un error inesperado')
    expect(motivoDelError(null, 'resp')).toBe('resp')
  })
})
