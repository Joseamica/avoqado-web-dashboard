import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))

import { Form } from '@/components/ui/form'
import type { ProductoConFamilia } from '@/features/product-variants/families'
import { DiscountFormFields } from '../DiscountFormFields'

const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
})
const productos: ProductoConFamilia[] = [{ id: 'a', name: 'Agua' }, variante('v1', 'S', 0), variante('v2', 'M', 1)]

function Arnes({ inicial = [] }: { inicial?: unknown[] }) {
  const form = useForm({ defaultValues: { type: 'PERCENTAGE', scope: 'ITEM', targetItemIds: inicial } })
  return (
    <>
      <Form {...form}>
        <DiscountFormFields form={form} products={productos} categoryOptions={[]} customerGroupOptions={[]} dayOptions={[]} />
      </Form>
      <output data-testid="valor">{JSON.stringify(form.watch('targetItemIds'))}</output>
    </>
  )
}
const valor = () => JSON.parse(screen.getByTestId('valor').textContent!)
const abrir = () => fireEvent.focus(screen.getByPlaceholderText('discounts.form.placeholders.selectProducts'))

describe('Formulario viejo de descuento con familias', () => {
  it('elegir «toda la familia» guarda las variantes con la forma de siempre ({ value, label })', () => {
    render(<Arnes />)
    abrir()
    fireEvent.click(screen.getByText('selector.todaLaFamilia:Playera:2'))
    expect(valor()).toEqual([
      { value: 'v1', label: 'Playera · S' },
      { value: 'v2', label: 'Playera · M' },
    ])
  })

  it('un descuento guardado (ids) muestra el nombre y al agregar otro producto no se rompe', () => {
    render(<Arnes inicial={['a']} />)
    expect(screen.getByText('Agua')).toBeInTheDocument()
    abrir()
    fireEvent.click(screen.getByText('Playera · M'))
    expect(valor()).toEqual([
      { value: 'a', label: 'Agua' },
      { value: 'v2', label: 'Playera · M' },
    ])
    expect(screen.getByText('Agua')).toBeInTheDocument()
  })
})
