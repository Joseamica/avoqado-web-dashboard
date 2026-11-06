/**
 * D14 (grabando los tutoriales, 5-nov-2026): con el alcance «Categorías» y ninguna categoría elegida, «Siguiente» avanzaba
 * y el descuento se guardaba con la lista vacía. Ahora el paso no se valida y dice qué falta.
 */
import { act, render, screen } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { Form } from '@/components/ui/form'
import { WizardStep2Scope } from '../WizardStep2Scope'

let formulario: UseFormReturn<any>
function Arnes({ scope, categorias = [], permitirSinCategorias }: { scope: string; categorias?: string[]; permitirSinCategorias?: boolean }) {
  const form = useForm({ defaultValues: { scope, targetItemIds: [], targetCategoryIds: categorias, buyItemIds: [], getItemIds: [] } })
  formulario = form
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Form {...form}>
        <WizardStep2Scope
          form={form}
          products={[]}
          categoryOptions={[{ value: 'cat-pan', label: 'Pan dulce' }]}
          customerGroupOptions={[]}
          permitirSinCategorias={permitirSinCategorias}
        />
      </Form>
    </MemoryRouter>
  )
}

describe('Paso 2 del descuento · «Categorías»', () => {
  it('🔴 sin ninguna categoría el paso NO es válido y dice qué falta', async () => {
    render(<Arnes scope="CATEGORY" />)
    let valido = true
    await act(async () => {
      valido = await formulario.trigger()
    })
    expect(valido).toBe(false)
    expect(screen.getByText('discounts.form.validation.categoriesRequired')).toBeInTheDocument()
  })

  it('con una categoría elegida el paso es válido', async () => {
    render(<Arnes scope="CATEGORY" categorias={['cat-pan']} />)
    let valido = false
    await act(async () => {
      valido = await formulario.trigger()
    })
    expect(valido).toBe(true)
  })

  it('si cambia a «Orden completa», la regla de categorías ya no estorba', async () => {
    render(<Arnes scope="CATEGORY" />)
    act(() => formulario.setValue('scope', 'ORDER'))
    let valido = false
    await act(async () => {
      valido = await formulario.trigger()
    })
    expect(formulario.getValues('scope')).toBe('ORDER')
    expect(valido).toBe(true)
  })

  it('🔴 un descuento VIEJO que ya era «Categorías» sin categorías se puede seguir editando (p. ej. para apagarlo; Codex r3 #2)', async () => {
    render(<Arnes scope="CATEGORY" permitirSinCategorias />)
    let valido = false
    await act(async () => {
      valido = await formulario.trigger()
    })
    expect(valido).toBe(true)
  })
})
