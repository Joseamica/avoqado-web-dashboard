/**
 * D14 (Codex r1 #3, 5-nov-2026): «Usos totales» y «Usos por cliente» dejaban escribir 0. El SERVIDOR exige 1 o más (y el
 * asistente convertía el 0 en «ilimitado» sin decirlo). Ahora el campo pide 1 o más, o vacío para ilimitado.
 */
import { act, render, screen } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { Form } from '@/components/ui/form'
import { WizardStep3Rules } from '../WizardStep3Rules'

let formulario: UseFormReturn<any>
function Arnes({ usos }: { usos?: number }) {
  const form = useForm({ defaultValues: { maxTotalUses: usos, maxUsesPerCustomer: usos, daysOfWeek: [], validFrom: '', validUntil: '', timeFrom: '', timeUntil: '' } })
  formulario = form
  return (
    <Form {...form}>
      <WizardStep3Rules form={form} dayOptions={[]} />
    </Form>
  )
}

describe('Paso 3 del descuento · límites de uso', () => {
  it('🔴 0 usos no es válido y dice qué poner', async () => {
    render(<Arnes usos={0} />)
    let valido = true
    await act(async () => {
      valido = await formulario.trigger(['maxTotalUses', 'maxUsesPerCustomer'])
    })
    expect(valido).toBe(false)
    expect(screen.getAllByText('discounts.form.validation.usesMin')).toHaveLength(2)
  })

  it('vacío (ilimitado) y 1 o más sí', async () => {
    for (const usos of [undefined, 1, 25]) {
      const { unmount } = render(<Arnes usos={usos} />)
      let valido = false
      await act(async () => {
        valido = await formulario.trigger(['maxTotalUses', 'maxUsesPerCustomer'])
      })
      expect(valido).toBe(true)
      unmount()
    }
  })
})
