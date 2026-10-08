import { describe, expect, it } from 'vitest'
import { cuentaVacia, textoDeCuenta } from '../cuenta'

const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k)
const c = (cl: [number, string, number?], co: [number, string], pr: [number, string]) => ({
  clases: { n: cl[0], total: cl[1], pendientesDeValoracion: cl[2] ?? 0 },
  comisiones: { n: co[0], total: co[1] },
  propinas: { n: pr[0], total: pr[1] },
})

describe('textoDeCuenta (diseño r5.4: todo neto; un tipo en cero no se nombra)', () => {
  it('nombra sólo lo que tiene movimientos, con su total', () => {
    const s = textoDeCuenta(t, c([0, '0.00'], [41, '1230.00'], [0, '0.00']), 'es')
    expect(s).toBe('sedes.cuenta.comisiones:{"count":41,"total":"$1,230.00"}')
  })
  it('una devolución que anula su venta cuenta 2 movimientos y $0: se nombra (no está vacía)', () => {
    const x = c([0, '0.00'], [2, '0.00'], [0, '0.00'])
    expect(cuentaVacia(x)).toBe(false)
    expect(textoDeCuenta(t, x, 'es')).toBe('sedes.cuenta.comisiones:{"count":2,"total":"$0.00"}')
  })
  it('las clases que no se pueden valorar se dicen aparte, nunca como $0', () => {
    const s = textoDeCuenta(t, c([1, '500.00', 2], [0, '0.00'], [0, '0.00']), 'es')
    expect(s).toContain('sedes.cuenta.clases:{"count":1')
    expect(s).toContain('sedes.cuenta.sinValorar:{"count":2}')
  })
  it('sólo clases sin valorar: se dicen sin un «0 clases ($0.00)» delante', () => {
    const x = c([0, '0.00', 3], [0, '0.00'], [0, '0.00'])
    expect(cuentaVacia(x)).toBe(false)
    expect(textoDeCuenta(t, x, 'es')).toBe('sedes.cuenta.sinValorar:{"count":3}')
  })
  it('un neto negativo lleva el «−» de los ajustes, no el guion de Intl', () => {
    expect(textoDeCuenta(t, c([0, '0.00'], [0, '0.00'], [1, '-50.00']), 'es')).toBe('sedes.cuenta.propinas:{"count":1,"total":"−$50.00"}')
  })
  it('vacía de verdad: cero movimientos y cero sin valorar', () => {
    expect(cuentaVacia(c([0, '0.00'], [0, '0.00'], [0, '0.00']))).toBe(true)
  })
  it('varias partes se juntan como lista del idioma («a, b y c» / «a, b, and c»)', () => {
    const x = c([3, '1500.00'], [41, '1230.00'], [18, '540.00'])
    const corto = (k: string) => k.split('.').pop() as string
    expect(textoDeCuenta(corto, x, 'es')).toBe('clases, comisiones y propinas')
    expect(textoDeCuenta(corto, x, 'en')).toBe('clases, comisiones, and propinas')
  })
})
