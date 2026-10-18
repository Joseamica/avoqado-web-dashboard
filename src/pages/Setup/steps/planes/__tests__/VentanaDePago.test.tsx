/**
 * Ventana para pagar del alta (D4): centrada en computadora, hoja pegada abajo en celular.
 *
 * 🔴 La ventana de 3D Secure de Stripe se monta FUERA de esta ventana. Por eso es `modal={false}`:
 * el `body` no puede quedar con `pointer-events: none` ni el foco atrapado, o el cliente no puede
 * tocar ni teclear el reto de su banco. Se prueba con las cadenas REALES de `setup.json`.
 */
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState, type ComponentProps } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import esCommon from '@/locales/es/common.json'
import esSetup from '@/locales/es/setup.json'

import { VentanaDePago } from '../VentanaDePago'

const celular = vi.hoisted(() => ({ valor: false }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => celular.valor }))

const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'es',
    fallbackLng: false,
    ns: ['setup', 'common'],
    defaultNS: 'setup',
    resources: { es: { setup: esSetup, common: esCommon } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  celular.valor = false
})

// Mediodía en CDMX: el día no cambia por zona horaria.
const PRIMER_COBRO = { fecha: new Date('2026-11-16T18:00:00Z'), texto: '$999 + IVA = $1,158.84' }

type Props = Partial<ComponentProps<typeof VentanaDePago>>

function Ventana(props: Props) {
  return (
    <I18nextProvider i18n={i18n}>
      <VentanaDePago
        abierta
        onCerrar={() => {}}
        puedeCerrar
        titulo="Empieza tu prueba de Pro"
        subtitulo="30 días gratis. Cancela antes y no se te cobra."
        hoyPagasCents={0}
        primerCobro={PRIMER_COBRO}
        legal="Al empezar aceptas el cobro."
        {...props}
      >
        <button type="button">Empezar mis 30 días gratis</button>
      </VentanaDePago>
    </I18nextProvider>
  )
}

/** Como la pantalla real: un botón abre la ventana y `onCerrar` la cierra. */
function ConBotonQueAbre({ puedeCerrar = true }: { puedeCerrar?: boolean }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <I18nextProvider i18n={i18n}>
      <button type="button" onClick={() => setAbierta(true)}>
        Elegir Pro
      </button>
      <VentanaDePago
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        puedeCerrar={puedeCerrar}
        titulo="Empieza tu prueba de Pro"
        subtitulo="30 días gratis."
        hoyPagasCents={0}
        legal="Legal"
      >
        <input aria-label="Tarjeta" />
      </VentanaDePago>
    </I18nextProvider>
  )
}

describe('VentanaDePago', () => {
  it('muestra título, «Hoy pagas $0.00», «Primer cobro: 16 de noviembre», el formulario y el legal', () => {
    render(<Ventana />)
    const ventana = screen.getByRole('dialog', { name: 'Empieza tu prueba de Pro' })
    expect(ventana).toHaveAccessibleDescription('30 días gratis. Cancela antes y no se te cobra.')
    expect(screen.getByText('Hoy pagas')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('Primer cobro: 16 de noviembre')).toBeInTheDocument()
    expect(screen.getByText('$999 + IVA = $1,158.84')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' })).toBeInTheDocument()
    expect(screen.getByText('Al empezar aceptas el cobro.')).toBeInTheDocument()
  })

  it('sin primer cobro no pinta la línea', () => {
    render(<Ventana primerCobro={undefined} hoyPagasCents={1000} />)
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.queryByText(/Primer cobro/)).not.toBeInTheDocument()
  })

  it('Esc con puedeCerrar llama onCerrar', async () => {
    const onCerrar = vi.fn()
    render(<Ventana onCerrar={onCerrar} />)
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('la X con puedeCerrar llama onCerrar', async () => {
    const onCerrar = vi.fn()
    render(<Ventana onCerrar={onCerrar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('clic en el fondo nunca cierra', async () => {
    const onCerrar = vi.fn()
    render(<Ventana onCerrar={onCerrar} />)
    await userEvent.click(screen.getByTestId('fondo-ventana-de-pago'))
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('con un cobro en vuelo (puedeCerrar=false): Esc no cierra y la X está deshabilitada', async () => {
    const onCerrar = vi.fn()
    render(<Ventana onCerrar={onCerrar} puedeCerrar={false} />)
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
  })

  it('🔴 no bloquea lo de fuera: el body NO queda con pointer-events: none (3D Secure de Stripe)', () => {
    render(<Ventana />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('tras cerrar con Esc, el foco vuelve al botón que la abrió', async () => {
    render(<ConBotonQueAbre />)
    const abrir = screen.getByRole('button', { name: 'Elegir Pro' })
    await userEvent.click(abrir)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(abrir).toHaveFocus())
  })

  it('tras cerrar con la X, el foco vuelve al botón que la abrió', async () => {
    render(<ConBotonQueAbre />)
    const abrir = screen.getByRole('button', { name: 'Elegir Pro' })
    await userEvent.click(abrir)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(abrir).toHaveFocus())
  })

  it('en computadora va centrada; en celular, pegada abajo (bottom-0)', () => {
    const { unmount } = render(<Ventana />)
    expect(screen.getByRole('dialog')).toHaveClass('max-w-lg')
    expect(screen.getByRole('dialog')).not.toHaveClass('bottom-0')
    unmount()

    celular.valor = true
    render(<Ventana />)
    expect(screen.getByRole('dialog')).toHaveClass('bottom-0', 'max-h-[90dvh]', 'overflow-y-auto')
  })
})
