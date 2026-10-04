import { describe, expect, it } from 'vitest'
import { mensajeLegible, sinRespuesta, sumarMeses } from '../rangos'

describe('rangos', () => {
  it('suma y resta meses sin salirse del mes', () => {
    expect(sumarMeses('2026-10-04', -24)).toBe('2024-10-04')
    expect(sumarMeses('2026-10-04', 24)).toBe('2028-10-04')
    expect(sumarMeses('2026-10-04', -12)).toBe('2025-10-04')
    expect(sumarMeses('2026-03-31', -1)).toBe('2026-02-28')
    expect(sumarMeses('2028-02-29', -24)).toBe('2026-02-28')
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15')
  })
  it('el mensaje del server sin «Error de validación:» ni el nombre del campo', () => {
    expect(mensajeLegible({ response: { data: { message: 'Error de validación: amount: Máximo dos decimales' } } })).toBe(
      'Máximo dos decimales',
    )
    expect(
      mensajeLegible({
        response: { data: { message: 'Error de validación: amount: Monto demasiado grande, reason: Máximo 300 caracteres' } },
      }),
    ).toBe('Monto demasiado grande, Máximo 300 caracteres')
    expect(mensajeLegible({ response: { data: { message: 'Octubre ya se cerró: elige una fecha posterior' } } })).toBe(
      'Octubre ya se cerró: elige una fecha posterior',
    )
    expect(mensajeLegible({ response: { data: { message: 'Monto: no cambia' } } })).toBe('Monto: no cambia')
    expect(mensajeLegible(new Error('Network Error'))).toBeNull()
  })
  it('sin respuesta = la petición pudo aplicarse', () => {
    expect(sinRespuesta(new Error('Network Error'))).toBe(true)
    expect(sinRespuesta({ response: { status: 409 } })).toBe(false)
  })
})
