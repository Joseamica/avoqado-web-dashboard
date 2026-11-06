/**
 * D14 (Codex r4 #3, 5-nov-2026): al editar, borrar «Usos totales» decía «Deja vacío para usos ilimitados» pero el límite viejo
 * se quedaba: el panel omitía el campo. Al editar, un límite vacío se manda como null (el SERVIDOR lo lee como «sin límite»);
 * al crear, se omite.
 */
import { describe, expect, it } from 'vitest'
import { limiteParaGuardar } from '../limitesDeUso'

describe('Límite de usos al guardar', () => {
  it('🔴 editar con el campo vacío: null (vuelve ilimitado)', () => {
    expect(limiteParaGuardar(undefined, true)).toBeNull()
    expect(limiteParaGuardar(null, true)).toBeNull()
  })
  it('crear con el campo vacío: se omite', () => {
    expect(limiteParaGuardar(undefined, false)).toBeUndefined()
  })
  it('con número, el número', () => {
    expect(limiteParaGuardar(5, true)).toBe(5)
    expect(limiteParaGuardar(5, false)).toBe(5)
  })
})
