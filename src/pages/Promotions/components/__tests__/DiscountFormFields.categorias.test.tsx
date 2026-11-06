/**
 * D14 (5-nov-2026): el formulario de descuento de una sola página (el que se abre desde «Crear cupón») también dejaba
 * guardar «Categorías» sin ninguna categoría.
 */
import { act, render, screen } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { Form } from '@/components/ui/form'
import { DiscountFormFields } from '../DiscountFormFields'

let formulario: UseFormReturn<any>
function Arnes({ categorias = [] }: { categorias?: unknown[] }) {
  const form = useForm({ defaultValues: { name: 'Martes de pan', type: 'PERCENTAGE', value: 10, scope: 'CATEGORY', targetCategoryIds: categorias } })
  formulario = form
  return (
    <Form {...form}>
      <DiscountFormFields form={form} products={[]} categoryOptions={[{ value: 'cat-pan', label: 'Pan dulce' }]} customerGroupOptions={[]} dayOptions={[]} />
    </Form>
  )
}

describe('Formulario de descuento · «Categorías»', () => {
  it('🔴 sin ninguna categoría no se puede guardar y dice qué falta', async () => {
    render(<Arnes />)
    let valido = true
    await act(async () => {
      valido = await formulario.trigger('targetCategoryIds')
    })
    expect(valido).toBe(false)
    expect(screen.getByText('discounts.form.validation.categoriesRequired')).toBeInTheDocument()
  })

  it('con una categoría sí', async () => {
    render(<Arnes categorias={[{ value: 'cat-pan', label: 'Pan dulce' }]} />)
    let valido = false
    await act(async () => {
      valido = await formulario.trigger('targetCategoryIds')
    })
    expect(valido).toBe(true)
  })
})
