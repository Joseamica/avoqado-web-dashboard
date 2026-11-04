import { describe, expect, it } from 'vitest'
import { conteoParaExportar } from '../conteoParaExportar'

describe('conteoParaExportar', () => {
  it('prefiere el total del servidor sobre las filas cargadas', () => {
    expect(conteoParaExportar(100, 7689)).toBe(7689)
  })
  it('si el total es 0 o desconocido, usa las filas cargadas', () => {
    expect(conteoParaExportar(100, 0)).toBe(100)
  })
})
