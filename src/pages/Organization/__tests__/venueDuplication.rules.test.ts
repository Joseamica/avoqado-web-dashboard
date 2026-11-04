import { describe, expect, it } from 'vitest'
import { nombreChoca, normalizarNombreTienda, numeroDeTienda } from '@/pages/Organization/components/venueDuplication.rules'

// Copia de la regla del SERVIDOR (venueDuplication.rules.ts): mismos casos, mismo resultado.
describe('regla de nombre y número de la tienda duplicada', () => {
  it('normaliza acentos, espacios y mayúsculas', () => {
    expect(normalizarNombreTienda('  bae  Misión   san pedro ')).toBe('BAE MISION SAN PEDRO')
  })

  it('el número es el ÚLTIMO paréntesis numérico', () => {
    expect(numeroDeTienda('BAE X (12) (3952)')).toBe('3952')
    expect(numeroDeTienda('BAE Luis Pasteur')).toBeNull()
  })

  it('choca por número o por nombre normalizado; si no, no choca', () => {
    const existentes = ['BAE MISION SAN PEDRO (3952)', 'BAE Luis Pasteur']
    expect(nombreChoca('BAE OTRA (3952)', existentes)).toEqual({ choca: true, numero: '3952' })
    expect(nombreChoca('bae luis  pasteur', existentes)).toEqual({ choca: true, numero: null })
    expect(nombreChoca('BAE LOMAS 4 (4120)', existentes)).toEqual({ choca: false })
  })
})
