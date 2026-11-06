/**
 * D14 v2 (5-nov-2026): lo que manda el panel al guardar un descuento o cupón.
 */
import { describe, expect, it } from 'vitest'
import { categoriasParaGuardar, limiteParaGuardar } from '../paraGuardar'

describe('Límite de usos al guardar', () => {
  it('🔴 Codex r4 #3: editar con el campo vacío manda null (vuelve ilimitado)', () => {
    expect(limiteParaGuardar(undefined, true)).toBeNull()
    expect(limiteParaGuardar(null, true)).toBeNull()
  })
  it('crear con el campo vacío: se omite', () => {
    expect(limiteParaGuardar(undefined, false)).toBeUndefined()
  })
  it('🔴 un 0 se manda tal cual (antes `0 || undefined` lo volvía «ilimitado» sin decirlo); lo decide el SERVIDOR', () => {
    expect(limiteParaGuardar(0, false)).toBe(0)
    expect(limiteParaGuardar(0, true)).toBe(0)
    expect(limiteParaGuardar(5, true)).toBe(5)
  })
})

describe('Categorías al guardar', () => {
  it('🔴 «Categorías» sin elegir manda [] (el SERVIDOR responde; un viejo vacío se conserva)', () => {
    expect(categoriasParaGuardar('CATEGORY', [])).toEqual([])
    expect(categoriasParaGuardar('CATEGORY', undefined)).toEqual([])
  })
  it('acepta opciones del selector o ids', () => {
    expect(categoriasParaGuardar('CATEGORY', [{ value: 'c1', label: 'Pan' }, 'c2'])).toEqual(['c1', 'c2'])
  })
  it('otro alcance no manda la lista', () => {
    expect(categoriasParaGuardar('ORDER', ['c1'])).toBeUndefined()
  })
})
