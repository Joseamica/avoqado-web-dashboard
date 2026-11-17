import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: (k: string, o?: any) => (o?.defaultValue ?? k).replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? '')),
  }),
}))
import { SetupDoneStep } from '../steps/SetupDoneStep'

describe('SetupDoneStep — modalidad REAL de la prueba', () => {
  it('ENDS_FREE: dice que termina sin cobro y que ese día podrá contratar el Básico (fecha en hora de México)', () => {
    // 01-dic 03:00 UTC = 30-nov en México
    render(<SetupDoneStep onFinish={() => {}} trialModality="ENDS_FREE" trialEndsAt="2026-12-01T03:00:00.000Z" />)
    expect(
      screen.getByText(/Tu prueba de Pro termina el 30 de noviembre sin cobro\. Ese día podrás contratar el Básico\./),
    ).toBeInTheDocument()
    expect(screen.getByText('Cámbialo en «Tu plan»')).toBeInTheDocument()
  })

  it('RENEWS_AS_PRO: dice que se renueva como Pro', () => {
    render(<SetupDoneStep onFinish={() => {}} trialModality="RENEWS_AS_PRO" trialEndsAt="2026-12-15T18:00:00.000Z" />)
    expect(screen.getByText('Tu prueba de Pro se renueva como Pro el 15 de diciembre.')).toBeInTheDocument()
  })

  it('sin modalidad o sin fecha: la pantalla de siempre, sin renglón de prueba', () => {
    const { rerender } = render(<SetupDoneStep onFinish={() => {}} />)
    expect(screen.queryByTestId('done-trial')).not.toBeInTheDocument()
    rerender(<SetupDoneStep onFinish={() => {}} trialModality="ENDS_FREE" />)
    expect(screen.queryByTestId('done-trial')).not.toBeInTheDocument()
    expect(screen.getByText('Todo listo')).toBeInTheDocument()
  })
})
