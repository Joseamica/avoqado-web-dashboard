import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))

import { Form } from '@/components/ui/form'
import type { ProductoConFamilia } from '@/features/product-variants/families'
import { WizardStep2Scope } from '../WizardStep2Scope'

const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
})

function Arnes({ products, scope = 'ITEM' }: { products: ProductoConFamilia[]; scope?: string }) {
  const form = useForm({ defaultValues: { scope, targetItemIds: [] as string[], buyItemIds: [] as string[], getItemIds: [] as string[] } })
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Form {...form}>
        <WizardStep2Scope form={form} products={products} categoryOptions={[]} customerGroupOptions={[]} />
      </Form>
      <output data-testid="ids">{JSON.stringify(form.watch(['targetItemIds', 'buyItemIds', 'getItemIds']))}</output>
    </MemoryRouter>
  )
}
const ids = () => JSON.parse(screen.getByTestId('ids').textContent!)
const abrir = (n = 0) => fireEvent.focus(screen.getAllByPlaceholderText('discounts.form.placeholders.selectProducts')[n])

describe('Descuento por producto con familias', () => {
  it('elegir «toda la familia» guarda los ids de todas sus variantes', () => {
    render(<Arnes products={[{ id: 'a', name: 'Agua' }, variante('v1', 'S', 0), variante('v2', 'M', 1)]} />)
    abrir()
    fireEvent.click(screen.getByText('selector.todaLaFamilia:Playera:2'))
    expect(ids()[0]).toEqual(['v1', 'v2'])
    expect(screen.getByText('Playera · S')).toBeInTheDocument()
  })

  it('🔴 sin familias el selector es el de siempre: un producto, su id y sin «toda la familia»', () => {
    render(
      <Arnes
        products={[
          { id: 'a', name: 'Agua' },
          { id: 'b', name: 'Café' },
        ]}
      />,
    )
    abrir()
    expect(screen.queryByText(/selector\.todaLaFamilia/)).not.toBeInTheDocument()
    expect(screen.queryByText('selector.sueltos')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Café'))
    expect(ids()[0]).toEqual(['b'])
  })

  it('2x1: «compra» y «lleva» también aceptan la familia', () => {
    render(<Arnes scope="QUANTITY" products={[variante('v1', 'S', 0), variante('v2', 'M', 1)]} />)
    abrir(1)
    fireEvent.click(screen.getByText('selector.todaLaFamilia:Playera:2'))
    expect(ids()[2]).toEqual(['v1', 'v2'])
  })
})
