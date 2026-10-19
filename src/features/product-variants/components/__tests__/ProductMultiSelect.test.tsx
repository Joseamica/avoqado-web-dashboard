import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MultipleSelectorProps, Option } from '@/components/multi-selector'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))

// Se captura lo que recibe el MultipleSelector de siempre: la prueba mira sus props, no el DOM de cmdk.
const capturado: { props?: MultipleSelectorProps } = {}
vi.mock('@/components/multi-selector', () => ({
  default: (props: MultipleSelectorProps) => {
    capturado.props = props
    return null
  },
}))

import { ProductMultiSelect } from '../ProductMultiSelect'

const vo = (talla: string, pos: number) => [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }]
const p = (id: string, name: string) => ({ id, name })
const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: vo(talla, pos),
})

describe('ProductMultiSelect', () => {
  beforeEach(() => {
    capturado.props = undefined
  })

  it('🔴 sin familias pasa las mismas opciones { value, label }, en el mismo orden y sin grupos', () => {
    render(<ProductMultiSelect productos={[p('b', 'Café'), p('a', 'Agua')]} value={[]} onChange={vi.fn()} placeholder="Elige" />)
    expect(capturado.props?.options).toEqual([
      { value: 'b', label: 'Café' },
      { value: 'a', label: 'Agua' },
    ])
    expect(capturado.props?.groupBy).toBeUndefined()
    expect(capturado.props?.placeholder).toBe('Elige')
  })

  it('con una familia, cada opción lleva su grupo y la familia tiene su entrada «toda la familia»', () => {
    render(
      <ProductMultiSelect productos={[p('a', 'Agua'), variante('v2', 'M', 1), variante('v1', 'S', 0)]} value={[]} onChange={vi.fn()} />,
    )
    expect(capturado.props?.groupBy).toBe('grupo')
    expect(capturado.props?.options).toEqual([
      { value: 'a', label: 'Agua', grupo: 'selector.sueltos' },
      { value: 'familia:g1', label: 'selector.todaLaFamilia:Playera:2', grupo: 'Playera' },
      { value: 'v1', label: 'Playera · S', grupo: 'Playera' },
      { value: 'v2', label: 'Playera · M', grupo: 'Playera' },
    ])
  })

  it('elegir «toda la familia» guarda los ids de TODAS sus variantes', () => {
    const onChange = vi.fn()
    render(
      <ProductMultiSelect productos={[p('a', 'Agua'), variante('v1', 'S', 0), variante('v2', 'M', 1)]} value={['a']} onChange={onChange} />,
    )
    capturado.props?.onChange?.([
      { value: 'a', label: 'Agua' },
      { value: 'familia:g1', label: 'x' },
    ] as Option[])
    expect(onChange).toHaveBeenCalledWith(['a', 'v1', 'v2'])
  })

  it('un id guardado que ya no está en la lista sale con el id crudo, como hoy', () => {
    render(<ProductMultiSelect productos={[p('a', 'Agua')]} value={['a', 'borrado']} onChange={vi.fn()} />)
    expect(capturado.props?.value).toEqual([
      { value: 'a', label: 'Agua' },
      { value: 'borrado', label: 'borrado' },
    ])
  })

  it('una familia ya elegida completa no vuelve a ofrecer «toda la familia»', () => {
    render(<ProductMultiSelect productos={[variante('v1', 'S', 0), variante('v2', 'M', 1)]} value={['v1', 'v2']} onChange={vi.fn()} />)
    expect(capturado.props?.options?.map(o => o.value)).toEqual(['v1', 'v2'])
  })
})
