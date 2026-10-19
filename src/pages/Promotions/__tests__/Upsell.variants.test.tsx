import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))
// El sustituto nativo de Select, pero con los encabezados visibles: cada grupo es un <optgroup> y su encabezado una
// <option disabled value="encabezado:…">, para poder decir bajo qué encabezado quedó cada producto.
vi.mock('@/components/ui/select', async () => {
  const { createElement } = await import('react')
  return {
    ...(await import('@/test/nativeSelectShim')),
    SelectGroup: ({ children }: { children?: ReactNode }) => createElement('optgroup', null, children),
    SelectLabel: ({ children }: { children?: ReactNode }) =>
      createElement('option', { disabled: true, value: `encabezado:${children}` }, children),
  }
})
vi.mock('@/services/menu.service', () => ({ getProducts: vi.fn() }))
vi.mock('@/services/upsell.service', () => ({ upsellService: { createRule: vi.fn() } }))

import { getProducts } from '@/services/menu.service'
import { upsellService } from '@/services/upsell.service'
import type { Product } from '@/types'
import { CreateRuleDialog } from '../Upsell'

const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
})

function abrir() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CreateRuleDialog venueId="ven1" open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  )
}
// Con el sustituto de Select, cada <Select> es un <select aria-label="select">: momento, disparador, sugerido (en ese orden).
const selects = () => screen.getAllByRole('combobox', { name: 'select' }) as HTMLSelectElement[]
const opciones = (s: HTMLSelectElement) =>
  within(s)
    .getAllByRole('option')
    .map(o => (o as HTMLOptionElement).value)
    .filter(v => !v.startsWith('encabezado:'))
/** El encabezado bajo el que quedó una opción (null si no está en un grupo). */
const encabezadoDe = (s: HTMLSelectElement, valor: string) =>
  s.querySelector(`option[value="${valor}"]`)?.closest('optgroup')?.querySelector('option[disabled]')?.textContent ?? null

describe('Upsell: disparador con «toda la familia»', () => {
  beforeEach(() => {
    vi.mocked(upsellService.createRule).mockResolvedValue({} as never)
  })

  it('elegir la familia como disparador guarda los ids de todas sus variantes', async () => {
    vi.mocked(getProducts).mockResolvedValue([{ id: 'a', name: 'Agua' }, variante('v1', 'S', 0), variante('v2', 'M', 1)] as Product[])
    const user = userEvent.setup()
    abrir()
    await waitFor(() => expect(selects()).toHaveLength(2))
    await user.selectOptions(selects()[0], 'PRODUCT')
    expect(opciones(selects()[1])).toEqual(['', 'a', 'familia:g1', 'v1', 'v2'])
    // El sugerido sigue siendo de UN producto: sin «toda la familia».
    expect(opciones(selects()[2])).toEqual(['', 'a', 'v1', 'v2'])
    await user.selectOptions(selects()[1], 'familia:g1')
    expect(selects()[1].value).toBe('familia:g1')
    await user.selectOptions(selects()[2], 'a')
    await user.click(screen.getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(upsellService.createRule).toHaveBeenCalled())
    expect(vi.mocked(upsellService.createRule).mock.calls[0][1]).toMatchObject({ triggerType: 'PRODUCT', triggerProductIds: ['v1', 'v2'] })
  })

  it('con familias, los productos sueltos van primero bajo su propio encabezado (no parecen de la familia anterior)', async () => {
    vi.mocked(getProducts).mockResolvedValue([variante('v1', 'S', 0), variante('v2', 'M', 1), { id: 'z', name: 'Zapato' }] as Product[])
    const user = userEvent.setup()
    abrir()
    await waitFor(() => expect(selects()).toHaveLength(2))
    await user.selectOptions(selects()[0], 'PRODUCT')
    for (const s of [selects()[1], selects()[2]]) {
      expect(encabezadoDe(s, 'z')).toBe('selector.sueltos')
      expect(encabezadoDe(s, 'v1')).toBe('Playera')
    }
    expect(opciones(selects()[1])).toEqual(['', 'z', 'familia:g1', 'v1', 'v2'])
    expect(opciones(selects()[2])).toEqual(['', 'z', 'v1', 'v2'])
  })

  it('🔴 sin familias el disparador es el de siempre: un producto por id', async () => {
    vi.mocked(getProducts).mockResolvedValue([
      { id: 'b', name: 'Café' },
      { id: 'a', name: 'Agua' },
    ] as Product[])
    const user = userEvent.setup()
    abrir()
    await waitFor(() => expect(selects()).toHaveLength(2))
    await user.selectOptions(selects()[0], 'PRODUCT')
    expect(opciones(selects()[1])).toEqual(['', 'b', 'a'])
    expect(selects()[1].querySelector('optgroup')).toBeNull()
    expect(selects()[2].querySelector('optgroup')).toBeNull()
    await user.selectOptions(selects()[1], 'a')
    await user.selectOptions(selects()[2], 'b')
    await user.click(screen.getByRole('button', { name: 'Crear' }))
    await waitFor(() => expect(upsellService.createRule).toHaveBeenCalled())
    expect(vi.mocked(upsellService.createRule).mock.calls[0][1]).toMatchObject({ triggerProductIds: ['a'] })
  })
})
