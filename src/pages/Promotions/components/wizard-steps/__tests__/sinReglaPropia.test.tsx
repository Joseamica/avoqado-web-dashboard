/**
 * D14 v2 (5-nov-2026): el asistente no repite la regla de «Categorías» ni de límites; la decide el SERVIDOR frente a lo
 * guardado. Así uno viejo «Categorías» sin categorías o con un límite en 0 se puede editar y apagar sin cambiarlo
 * (Codex r3 #2 y r5 #3: las reglas propias del panel lo bloqueaban).
 */
import { act, render } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { Form } from '@/components/ui/form'
import { WizardStep2Scope } from '../WizardStep2Scope'
import { WizardStep3Rules } from '../WizardStep3Rules'

let formulario: UseFormReturn<any>
function Paso2() {
  const form = useForm({ defaultValues: { scope: 'CATEGORY', targetItemIds: [], targetCategoryIds: [], buyItemIds: [], getItemIds: [] } })
  formulario = form
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Form {...form}>
        <WizardStep2Scope form={form} products={[]} categoryOptions={[{ value: 'c1', label: 'Pan' }]} customerGroupOptions={[]} />
      </Form>
    </MemoryRouter>
  )
}
function Paso3() {
  const form = useForm({
    defaultValues: { maxTotalUses: 0, maxUsesPerCustomer: 0, daysOfWeek: [], validFrom: '', validUntil: '', timeFrom: '', timeUntil: '' },
  })
  formulario = form
  return (
    <Form {...form}>
      <WizardStep3Rules form={form} dayOptions={[]} />
    </Form>
  )
}

describe('Asistente de descuentos · sin regla propia', () => {
  it('🔴 r3 #2: «Categorías» sin categorías (uno viejo) deja avanzar el paso 2', async () => {
    render(<Paso2 />)
    let valido = false
    await act(async () => {
      valido = await formulario.trigger()
    })
    expect(valido).toBe(true)
  })

  it('🔴 r5 #3: un límite viejo en 0 deja avanzar el paso 3', async () => {
    render(<Paso3 />)
    let valido = false
    await act(async () => {
      valido = await formulario.trigger(['maxTotalUses', 'maxUsesPerCustomer'])
    })
    expect(valido).toBe(true)
  })
})
