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

  it('con sinTarjeta: «Tu prueba de Pro termina el 15 de diciembre. Para seguir con Pro, pon tu tarjeta…»; sin él, los textos de hoy', () => {
    const { rerender } = render(
      <SetupDoneStep
        onFinish={() => {}}
        sinTarjeta
        planName="Pro"
        trialModality="RENEWS_AS_PRO"
        trialEndsAt="2026-12-15T18:00:00.000Z"
        tarjetaQueCobrara={null}
      />,
    )
    expect(
      screen.getByText(
        'Tu prueba de Pro termina el 15 de diciembre. Para seguir con Pro, pon tu tarjeta en «Tu plan»; si no, sigues en Gratis.',
      ),
    ).toBeInTheDocument()
    // La prueba sin tarjeta no «se renueva como Pro» sola: ese texto es de la prueba con tarjeta.
    expect(screen.queryByText(/se renueva como Pro/)).not.toBeInTheDocument()

    // Con una tarjeta que Stripe cobraría: ese día se cobra ESA tarjeta.
    rerender(
      <SetupDoneStep
        onFinish={() => {}}
        sinTarjeta
        planName="Premium"
        trialModality="RENEWS_AS_PRO"
        trialEndsAt="2026-12-15T18:00:00.000Z"
        tarjetaQueCobrara={{ brand: 'visa', last4: '4242' }}
      />,
    )
    expect(
      screen.getByText(
        'Tu prueba de Premium termina el 15 de diciembre; ese día se cobrará tu tarjeta ••••4242. Puedes quitarla en «Tu plan».',
      ),
    ).toBeInTheDocument()

    // Sin `sinTarjeta`: lo de hoy, aunque lleguen los campos nuevos.
    rerender(
      <SetupDoneStep
        onFinish={() => {}}
        trialModality="RENEWS_AS_PRO"
        trialEndsAt="2026-12-15T18:00:00.000Z"
        tarjetaQueCobrara={{ brand: 'visa', last4: '4242' }}
      />,
    )
    expect(screen.getByText('Tu prueba de Pro se renueva como Pro el 15 de diciembre.')).toBeInTheDocument()
    expect(screen.queryByText(/4242/)).not.toBeInTheDocument()
  })

  it('🔴 b2-r9 #7 (el caso de Codex): sinTarjeta con tarjetaQueCobrara ••••4242 y noHabraCobro true (cancelación programada, también tras recargar) → «… termina el 15 de diciembre; no se cobrará nada.», nunca «se cobrará tu tarjeta»', () => {
    const { rerender } = render(
      <SetupDoneStep
        onFinish={() => {}}
        sinTarjeta
        planName="Pro"
        trialModality="RENEWS_AS_PRO"
        trialEndsAt="2026-12-15T18:00:00.000Z"
        tarjetaQueCobrara={{ brand: 'visa', last4: '4242' }}
        noHabraCobro
      />,
    )
    expect(screen.getByText('Tu prueba de Pro termina el 15 de diciembre; no se cobrará nada.')).toBeInTheDocument()
    expect(screen.queryByText(/se cobrará tu tarjeta/)).not.toBeInTheDocument()

    // La misma regla con la modalidad ENDS_FREE (la cancelación que Stripe ya tiene programada), sin `noHabraCobro`.
    rerender(
      <SetupDoneStep
        onFinish={() => {}}
        sinTarjeta
        planName="Pro"
        trialModality="ENDS_FREE"
        trialEndsAt="2026-12-15T18:00:00.000Z"
        tarjetaQueCobrara={{ brand: 'visa', last4: '4242' }}
      />,
    )
    expect(screen.getByText('Tu prueba de Pro termina el 15 de diciembre; no se cobrará nada.')).toBeInTheDocument()
    expect(screen.queryByText(/se cobrará tu tarjeta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/contratar el Básico/)).not.toBeInTheDocument()
  })

  it('la prueba sin tarjeta que terminó antes de cerrar el alta: dice que el negocio quedó en Gratis y deja entrar', () => {
    const entrar = vi.fn()
    render(
      <SetupDoneStep
        onFinish={entrar}
        pruebaTerminada="Tu prueba terminó sin tarjeta y tu negocio quedó en Gratis. No se te cobró nada."
      />,
    )
    expect(screen.getByText('Tu prueba terminó sin tarjeta y tu negocio quedó en Gratis. No se te cobró nada.')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Entrar a Avoqado' }).click()
    expect(entrar).toHaveBeenCalledTimes(1)
  })
})
