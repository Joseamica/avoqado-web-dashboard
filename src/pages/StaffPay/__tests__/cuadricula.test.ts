import { describe, expect, it } from 'vitest'
import { cuadriculaDesdeCeldas, celdasDesdeCuadricula, rellenarHaciaAbajo, simular, faltantes, redimensionar, ampliar } from '../cuadricula'

const PN_HC = [0, 430, 430, 430, 430, 460, 490, 530, 570, 610, 650]

describe('cuadrícula — feature nueva', () => {
  it('ida y vuelta entre celdas y cuadrícula', () => {
    const celdas = PN_HC.map((amount, count) => ({ payLevelId: 'hc', count, amount }))
    const c = cuadriculaDesdeCeldas(celdas, ['hc', 'coach'], 10)
    expect(c.hc[8]).toBe(570)
    expect(c.coach.every(v => v === undefined)).toBe(true)
    expect(celdasDesdeCuadricula(c)).toEqual(celdas)
  })
  it('rellenar hacia abajo copia el valor de la fila de origen', () => {
    const c = rellenarHaciaAbajo({ hc: [0, 430, undefined, undefined, undefined] }, 'hc', 1, 4)
    expect(c.hc).toEqual([0, 430, 430, 430, 430])
  })
  it('simular: 8 lugares Head Coach = $570; sobrecupo usa el techo', () => {
    const c = { hc: PN_HC }
    expect(simular(c, 'hc', 8, 10)).toEqual({ monto: 570, filaUsada: 8 })
    expect(simular(c, 'hc', 12, 10)).toEqual({ monto: 650, filaUsada: 10 })
  })
  it('faltantes cuenta celdas vacías de 0 a maxCount en todos los niveles', () => {
    expect(faltantes({ hc: PN_HC, coach: [0, 400] }, 10)).toBe(9)
  })
})

describe('cuadrícula — regresión', () => {
  it('una celda vacía en el techo NO baja de fila al simular', () => {
    expect(simular({ hc: [0, 100, undefined] }, 'hc', 5, 2)).toEqual({ monto: null, filaUsada: 2 })
  })
  it('bajar el techo recorta filas; subirlo agrega vacías', () => {
    expect(redimensionar({ hc: PN_HC }, 3).hc).toEqual([0, 430, 430, 430])
    expect(redimensionar({ hc: [0, 1] }, 3).hc).toEqual([0, 1, undefined, undefined])
  })
  it('ampliar NUNCA recorta: editar el techo 10 → 1 → 12 conserva los montos', () => {
    const c1 = ampliar({ hc: PN_HC }, 1)
    expect(c1.hc).toEqual(PN_HC)
    const c2 = ampliar(c1, 12)
    expect(c2.hc[8]).toBe(570)
    expect(c2.hc).toHaveLength(13)
  })
  it('celdasDesdeCuadricula con techo deja fuera las filas por encima del techo', () => {
    const celdas = celdasDesdeCuadricula({ hc: PN_HC }, 5)
    expect(celdas.every(c => c.count <= 5)).toBe(true)
    expect(celdas).toHaveLength(6)
  })
})
