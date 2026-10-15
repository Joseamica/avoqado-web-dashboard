import { describe, expect, it } from 'vitest'
import {
  agruparPorFamilia,
  expandirSeleccion,
  familiaDeIds,
  familiasDe,
  sugerenciasDeFamilia,
  valorDeFamilia,
  valoresDeVariante,
  variantesParaAgregar,
} from '@/features/product-variants/families'

const vo = (pairs: Array<[string, string, number, number]>) =>
  pairs.map(([name, value, namePosition, valuePosition]) => ({ name, value, namePosition, valuePosition }))
const p = (id: string, name: string, extra: object = {}) => ({ id, name, ...extra })
const variante = (id: string, talla: string, pos: number) =>
  p(id, `Playera · ${talla}`, { productGroupId: 'g1', productGroupName: 'Playera', productGroupImageUrl: 'img', variantOptions: vo([['Talla', talla, 0, pos]]) })

describe('agrupar una lista por familia', () => {
  it('🔴 sin familias devuelve la misma lista en el mismo orden (un negocio sin variantes no nota nada)', () => {
    const lista = [p('a', 'Agua'), p('b', 'Café'), p('c', 'Té')]
    expect(agruparPorFamilia(lista)).toEqual(lista.map(producto => ({ tipo: 'producto', producto })))
  })

  it('pone la familia donde aparece su primera variante y ordena sus variantes por la posición de los valores', () => {
    const lista = [p('a', 'Agua'), variante('v3', 'L', 2), p('b', 'Café'), variante('v1', 'S', 0), variante('v2', 'M', 1)]
    const r = agruparPorFamilia(lista)
    expect(r.map(x => (x.tipo === 'familia' ? `F:${x.familia.name}` : x.producto.id))).toEqual(['a', 'F:Playera', 'b'])
    const f = r[1].tipo === 'familia' ? r[1].familia : null
    expect(f?.variantes.map(v => v.id)).toEqual(['v1', 'v2', 'v3'])
    expect(f?.imageUrl).toBe('img')
  })

  it('valores de la variante en el orden de sus opciones', () => {
    expect(valoresDeVariante(p('x', 'n', { variantOptions: vo([['Color', 'Azul', 1, 0], ['Talla', 'M', 0, 1]]) }))).toBe('M · Azul')
    expect(valoresDeVariante(p('x', 'n'))).toBe('')
  })
})

describe('«toda la familia» en un selector múltiple', () => {
  it('expande la familia a sus variantes, conserva los sueltos y no repite', () => {
    const lista = [p('a', 'Agua'), variante('v1', 'S', 0), variante('v2', 'M', 1)]
    expect(expandirSeleccion([valorDeFamilia('g1'), 'a', 'v1'], lista)).toEqual(['v1', 'v2', 'a'])
    expect(expandirSeleccion(['a'], lista)).toEqual(['a'])
    expect(expandirSeleccion([valorDeFamilia('no-existe')], lista)).toEqual([])
  })

  it('familiasDe lista cada familia una vez con sus variantes', () => {
    const lista = [variante('v1', 'S', 0), p('a', 'Agua'), variante('v2', 'M', 1)]
    expect(familiasDe(lista).map(f => [f.groupId, f.variantes.length])).toEqual([['g1', 2]])
  })
})

describe('ayudantes de selectores', () => {
  const lista = [p('a', 'Agua'), variante('v1', 'S', 0), variante('v2', 'M', 1)]
  it('familiaDeIds reconoce cuando los ids son EXACTAMENTE todas las variantes de una familia', () => {
    expect(familiaDeIds(['v2', 'v1'], lista)).toBe('g1')
    expect(familiaDeIds(['v1'], lista)).toBeNull()
    expect(familiaDeIds(['v1', 'v2', 'a'], lista)).toBeNull()
  })
  it('variantesParaAgregar salta las que ya están', () => {
    expect(variantesParaAgregar(familiasDe(lista)[0], ['v1']).map(v => v.id)).toEqual(['v2'])
  })
  it('sugerenciasDeFamilia busca por nombre sin acentos ni mayúsculas y omite familias ya completas', () => {
    expect(sugerenciasDeFamilia('PLAYE', lista, []).map(f => f.groupId)).toEqual(['g1'])
    expect(sugerenciasDeFamilia('playe', lista, ['v1', 'v2'])).toEqual([])
    expect(sugerenciasDeFamilia('', lista, [])).toEqual([])
  })
})
