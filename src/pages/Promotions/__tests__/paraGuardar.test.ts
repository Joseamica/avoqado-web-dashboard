/**
 * D14 v2 (5-nov-2026): lo que manda el panel al guardar un descuento o cupón.
 */
import { describe, expect, it } from 'vitest'
import { categoriasParaGuardar, limiteParaGuardar, siCambio } from '../paraGuardar'

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

describe('Al editar, sólo lo que cambió (Codex D14 v2 r1 #1)', () => {
	it('🔴 un límite sin tocar no se manda: no pisa el que otra persona guardó en medio', () => {
		expect(siCambio(limiteParaGuardar(undefined, true), null)).toBeUndefined() // abierto sin límite, sigue vacío
		expect(siCambio(limiteParaGuardar(undefined, true), undefined)).toBeUndefined()
		expect(siCambio(0, 0)).toBeUndefined()
	})
	it('lo que sí cambió se manda (vaciar = null, nuevo número)', () => {
		expect(siCambio(limiteParaGuardar(undefined, true), 5)).toBeNull()
		expect(siCambio(3, 5)).toBe(3)
		expect(siCambio(0, 5)).toBe(0)
	})
	it('categorías: mismo conjunto no se manda; otro sí', () => {
		expect(siCambio(['b', 'a'], ['a', 'b'])).toBeUndefined()
		expect(siCambio([], [])).toBeUndefined()
		expect(siCambio([], ['a'])).toEqual([])
		expect(siCambio(['c'], ['a'])).toEqual(['c'])
	})
})
