/**
 * Encargo 1afe04 (founder «A», 15-nov, como Toast): «Requiere aprobación» ya no es sólo de la cortesía. En un % o monto fijo
 * la casilla sale con su explicación y, prendida, avisa dónde deja de usarse ese descuento (TPV, ligas, tienda, automático, cliente).
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))

import { Form } from '@/components/ui/form'
import { WizardStep4Advanced } from '../WizardStep4Advanced'

function Paso4({ tipo, aprobacion = false }: { tipo: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMP'; aprobacion?: boolean }) {
  const form = useForm({
    defaultValues: {
      isAutomatic: false,
      priority: 0,
      isStackable: false,
      applyBeforeTax: true,
      requiresApproval: aprobacion,
      compReason: '',
      active: true,
    },
  })
  return (
    <Form {...form}>
      <WizardStep4Advanced form={form as any} discountType={tipo} />
    </Form>
  )
}

describe('Asistente de descuentos · «Requiere aprobación» en % y monto fijo', () => {
  it.each(['PERCENTAGE', 'FIXED_AMOUNT'] as const)('%s: sale la casilla con su explicación, apagada y sin aviso', tipo => {
    render(<Paso4 tipo={tipo} />)
    expect(screen.getByText('discounts.wizard.step4.approval')).toBeInTheDocument()
    expect(screen.getByText('discounts.wizard.hints.approval')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'discounts.form.fields.requiresApproval' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByTestId('aviso-aprobacion')).not.toBeInTheDocument()
  })

  it('al prenderla, avisa dónde deja de usarse el descuento', async () => {
    render(<Paso4 tipo="PERCENTAGE" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'discounts.form.fields.requiresApproval' }))
    })
    expect(screen.getByTestId('aviso-aprobacion')).toHaveTextContent('discounts.wizard.hints.approvalWarning')
  })

  it('un descuento que ya la tiene prendida (al editar) muestra el aviso', () => {
    render(<Paso4 tipo="FIXED_AMOUNT" aprobacion />)
    expect(screen.getByTestId('aviso-aprobacion')).toBeInTheDocument()
  })

  it('regresión: la cortesía conserva su propia tarjeta y no muestra la nueva', () => {
    render(<Paso4 tipo="COMP" />)
    expect(screen.getByText('discounts.wizard.step4.comp')).toBeInTheDocument()
    expect(screen.queryByText('discounts.wizard.step4.approval')).not.toBeInTheDocument()
  })
})
