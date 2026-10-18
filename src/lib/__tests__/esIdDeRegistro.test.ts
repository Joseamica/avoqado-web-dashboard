import { describe, it, expect } from 'vitest'
import { esIdDeRegistro } from '../esIdDeRegistro'

describe('esIdDeRegistro (la miga de pan no enseña ids crudos)', () => {
  it('🔴 un cuid v1 y un uuid son ids', () => {
    expect(esIdDeRegistro('cmv8qwa5i0046walcl459zlnb')).toBe(true)
    expect(esIdDeRegistro('3f2b8c1e-9a4d-4e2f-8b7c-1d2e3f4a5b6c')).toBe(true)
  })
  it('control — rutas y slugs con palabras no son ids (se humanizan como antes)', () => {
    for (const s of ['payments', 'purchase-orders', 'cafe-testarudo', 'configuration', 'cuentas-por-cobrar-de-clientes', 'c123'])
      expect(esIdDeRegistro(s)).toBe(false)
  })
})
