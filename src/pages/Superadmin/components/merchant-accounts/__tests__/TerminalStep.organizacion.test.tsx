/**
 * A3 (13-nov-2026): el paso «Terminales» del Wizard de Pagos listaba las terminales de TODA la plataforma y avisaba que borraría
 * asignaciones «huérfanas» de otras organizaciones (que «Guardar» nunca toca). Ahora lista y avisa con las de la organización,
 * las mismas que concilia el guardado.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TerminalStep } from '../wizard-steps/TerminalStep'

const estado = {
  merchants: { primary: { mode: 'existing', merchantId: 'acc-1', merchant: { displayName: 'Cuenta 1' } }, secondary: null, tertiary: null },
  terminalAssignments: {},
} as any

const terminal = (id: string, serialNumber: string, assignedMerchantIds: string[]) =>
  ({ id, name: `PAX ${id}`, serialNumber, type: 'TPV_ANDROID', brand: 'PAX', model: 'A910S', assignedMerchantIds }) as any

describe('TerminalStep · sólo las terminales de la organización', () => {
  it('lista y avisa sólo con las que recibe (las del resumen de la organización)', () => {
    render(
      <TerminalStep
        state={estado}
        dispatch={() => {}}
        terminals={[terminal('t1', 'SERIE-1', ['acc-1']), terminal('t2', 'SERIE-2', ['acc-de-antes'])]}
      />,
    )
    expect(screen.getByText('PAX t1')).toBeInTheDocument()
    expect(screen.getByText('PAX t2')).toBeInTheDocument()
    expect(screen.getByText('Asignaciones huérfanas detectadas')).toBeInTheDocument()
    expect(screen.getAllByText('SERIE-2')).toHaveLength(1)
    expect(screen.queryByText('SERIE-1', { selector: '.font-mono.text-amber-600' })).not.toBeInTheDocument()
  })

  it('mientras el resumen carga, dice que está cargando', () => {
    render(<TerminalStep state={estado} dispatch={() => {}} terminals={undefined} />)
    expect(screen.getByText('Cargando terminales...')).toBeInTheDocument()
  })
})
