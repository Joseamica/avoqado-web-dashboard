/**
 * Las 3 tarjetas del paso de planes del alta (D3): Pro, Premium y Enterprise.
 *
 * Se prueban con las cadenas REALES de `setup.json` (una llave que falta pintaría «plans.x» en
 * pantalla) y con montos que llegan ya hechos del servidor: la tarjeta sólo los formatea.
 */
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import enSetup from '@/locales/en/setup.json'
import esSetup from '@/locales/es/setup.json'

import type { LaunchOfferView, PlanQuote } from '../../../launchOffer.types'
import { TarjetasDePlanes } from '../TarjetasDePlanes'

const celular = vi.hoisted(() => ({ valor: false }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => celular.valor }))

const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'es',
    fallbackLng: false,
    ns: ['setup'],
    defaultNS: 'setup',
    resources: { es: { setup: esSetup }, en: { setup: enSetup } },
    interpolation: { escapeValue: false },
  })
})

const cotizacion: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: { monthlyCents: 115884, annualCents: 1158840, monthlyNetCents: 99900, annualNetCents: 999000, intro: null },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, monthlyNetCents: 169900, annualNetCents: 1699000, intro: null },
  },
}

function ofertaDe(planTier: 'PRO' | 'PREMIUM'): LaunchOfferView {
  return {
    code: 'ANUNCIO',
    slug: 'anuncio',
    offerVersion: 1,
    vertical: 'ALL',
    planTier,
    planName: planTier === 'PRO' ? 'Pro' : 'Premium',
    available: true,
    currency: 'MXN',
    ivaIncluded: true,
    requiresCard: true,
    promo: { monthlyCents: 1000, months: 3, subtotalCents: 862, ivaCents: 138, periodTotalCents: 3000 },
    renewal: { monthlyCents: 115884, subtotalCents: 99900, ivaCents: 15984 },
    firstChargeCents: 1000,
    validUntil: '2026-12-31T00:00:00.000Z',
    limited: true,
    copy: { headline: null, subheadline: null, bullets: ['Viñeta A', 'Viñeta B'] },
  }
}

function pinta(props: Partial<React.ComponentProps<typeof TarjetasDePlanes>> = {}) {
  const onElegir = vi.fn()
  const vista = render(
    <I18nextProvider i18n={i18n}>
      <TarjetasDePlanes oferta={null} planQuote={cotizacion} bloqueado={false} onElegir={onElegir} {...props} />
    </I18nextProvider>,
  )
  return { onElegir, ...vista }
}

const tarjeta = (plan: 'PRO' | 'PREMIUM' | 'ENTERPRISE') => document.querySelector<HTMLElement>(`[data-plan="${plan}"]`)!

beforeEach(() => {
  celular.valor = false
})

describe('TarjetasDePlanes sin campaña', () => {
  it('muestra Pro, Premium y Enterprise, «Recomendado», los precios del servidor y los 4 beneficios de Pro', () => {
    pinta()
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Premium' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument()
    expect(screen.getByText('Recomendado')).toBeInTheDocument()
    expect(screen.getAllByText('30 días gratis')).toHaveLength(2)
    expect(screen.getByText(/Luego \$999\.00 \+ IVA = \$1,158\.84 al mes/)).toBeInTheDocument()
    expect(screen.getByText(/Luego \$1,699\.00 \+ IVA = \$1,970\.84 al mes/)).toBeInTheDocument()
    for (const beneficio of [
      'Cobra con tarjeta y efectivo',
      'Mesas y usuarios ilimitados',
      'Corte y arqueo de caja',
      'Lealtad, promociones y reservas',
    ]) {
      expect(within(tarjeta('PRO')).getByText(beneficio)).toBeInTheDocument()
    }
    expect(within(tarjeta('PRO')).getByText('Para vender y cuadrar tu caja')).toBeInTheDocument()
    expect(within(tarjeta('PREMIUM')).getByText('Para facturar y controlar tu inventario')).toBeInTheDocument()
    expect(within(tarjeta('ENTERPRISE')).getByText('Para cadenas y franquicias')).toBeInTheDocument()
    expect(within(tarjeta('ENTERPRISE')).getByText('A la medida')).toBeInTheDocument()
    expect(within(tarjeta('ENTERPRISE')).getByText('Precio por volumen')).toBeInTheDocument()
  })

  it('Gratis no aparece en ningún lado', () => {
    pinta()
    expect(screen.queryByText(/Gratis/)).not.toBeInTheDocument()
  })

  it('«Recomendado», el borde fuerte y el botón negro son de Pro; los demás botones van de contorno', () => {
    pinta()
    expect(within(tarjeta('PRO')).getByText('Recomendado')).toBeInTheDocument()
    expect(tarjeta('PRO').className).toContain('border-primary')
    expect(tarjeta('PREMIUM').className).not.toContain('border-primary')
    expect(screen.getByRole('button', { name: 'Elegir Pro' }).className).toContain('bg-primary')
    expect(screen.getByRole('button', { name: 'Elegir Premium' }).className).toContain('border-input')
    expect(screen.getByRole('button', { name: 'Hablar con ventas' }).className).toContain('border-input')
  })

  it('«Elegir Premium» avisa PREMIUM; «Elegir Pro», PRO', async () => {
    const { onElegir } = pinta()
    await userEvent.click(screen.getByRole('button', { name: 'Elegir Premium' }))
    expect(onElegir).toHaveBeenLastCalledWith('PREMIUM')
    await userEvent.click(screen.getByRole('button', { name: 'Elegir Pro' }))
    expect(onElegir).toHaveBeenLastCalledWith('PRO')
  })

  it('«Hablar con ventas» abre WhatsApp de ventas y no elige plan', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { onElegir } = pinta()
    await userEvent.click(screen.getByRole('button', { name: 'Hablar con ventas' }))
    expect(abrir).toHaveBeenCalledTimes(1)
    const [url, destino, rasgos] = abrir.mock.calls[0]
    expect(String(url)).toContain('https://wa.me/')
    expect(decodeURIComponent(String(url))).toContain('Hola, me interesa el plan Enterprise de Avoqado para mi negocio.')
    expect(destino).toBe('_blank')
    expect(rasgos).toBe('noopener,noreferrer')
    expect(onElegir).not.toHaveBeenCalled()
    abrir.mockRestore()
  })

  it('🔴 sin precio neto del servidor dice «con IVA» y no lo deriva', () => {
    const sinNeto: PlanQuote = {
      ...cotizacion,
      tiers: {
        PRO: { monthlyCents: 115884, annualCents: 1158840, intro: null },
        PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
      },
    }
    pinta({ planQuote: sinNeto })
    expect(screen.getByText(/Luego \$1,158\.84 con IVA al mes/)).toBeInTheDocument()
    expect(screen.queryByText(/\+ IVA =/)).not.toBeInTheDocument()
  })

  it('sin cotización no inventa un precio: deja «30 días gratis» y los botones siguen funcionando', async () => {
    const { onElegir } = pinta({ planQuote: null })
    expect(screen.queryByText(/Luego/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Elegir Pro' }))
    expect(onElegir).toHaveBeenCalledWith('PRO')
  })

  it('con el cobro bloqueado los 3 botones quedan apagados', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { onElegir } = pinta({ bloqueado: true })
    const botones = screen.getAllByRole('button')
    expect(botones).toHaveLength(3)
    for (const b of botones) expect(b).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Hablar con ventas' }))
    expect(abrir).not.toHaveBeenCalled()
    expect(onElegir).not.toHaveBeenCalled()
    abrir.mockRestore()
  })
})

describe('TarjetasDePlanes con campaña', () => {
  it('la oferta PRO va en la tarjeta Pro con sus viñetas, sin «Recomendado», y Premium dice «sin la oferta»', () => {
    pinta({ oferta: ofertaDe('PRO') })
    const pro = tarjeta('PRO')
    expect(within(pro).getByText('Oferta de tu anuncio')).toBeInTheDocument()
    expect(within(pro).getByText('$10.00 al mes por 3 meses')).toBeInTheDocument()
    expect(within(pro).getByText(/Después \$999\.00 \+ IVA = \$1,158\.84 al mes/)).toBeInTheDocument()
    expect(within(pro).getByText('Viñeta A')).toBeInTheDocument()
    expect(within(pro).getByText('Viñeta B')).toBeInTheDocument()
    expect(within(pro).queryByText('Cobra con tarjeta y efectivo')).not.toBeInTheDocument()
    expect(screen.queryByText('Recomendado')).not.toBeInTheDocument()
    expect(within(pro).getByRole('button', { name: 'Elegir Pro por $10.00' }).className).toContain('bg-primary')
    expect(within(tarjeta('PREMIUM')).getByText(/sin la oferta/)).toBeInTheDocument()
    expect(within(tarjeta('PREMIUM')).queryByText('Oferta de tu anuncio')).not.toBeInTheDocument()
  })

  it('🔴 la oferta PREMIUM va en la tarjeta Premium, y en celular Premium es la primera del DOM', () => {
    celular.valor = true
    pinta({ oferta: ofertaDe('PREMIUM') })
    expect(within(tarjeta('PREMIUM')).getByText('Oferta de tu anuncio')).toBeInTheDocument()
    expect(within(tarjeta('PREMIUM')).getByRole('button', { name: 'Elegir Premium por $10.00' }).className).toContain('bg-primary')
    expect(within(tarjeta('PRO')).getByText(/sin la oferta/)).toBeInTheDocument()
    expect(within(tarjeta('PRO')).queryByText('Oferta de tu anuncio')).not.toBeInTheDocument()
    const orden = Array.from(document.querySelectorAll('[data-plan]')).map(n => n.getAttribute('data-plan'))
    expect(orden).toEqual(['PREMIUM', 'PRO', 'ENTERPRISE'])
  })

  it('en computadora el orden no cambia aunque la oferta sea de Premium', () => {
    pinta({ oferta: ofertaDe('PREMIUM') })
    const orden = Array.from(document.querySelectorAll('[data-plan]')).map(n => n.getAttribute('data-plan'))
    expect(orden).toEqual(['PRO', 'PREMIUM', 'ENTERPRISE'])
  })

  it('en celular sin campaña Pro sigue primero', () => {
    celular.valor = true
    pinta()
    const orden = Array.from(document.querySelectorAll('[data-plan]')).map(n => n.getAttribute('data-plan'))
    expect(orden).toEqual(['PRO', 'PREMIUM', 'ENTERPRISE'])
  })

  it('«Elegir Pro por $10.00» avisa PRO', async () => {
    const { onElegir } = pinta({ oferta: ofertaDe('PRO') })
    await userEvent.click(screen.getByRole('button', { name: 'Elegir Pro por $10.00' }))
    expect(onElegir).toHaveBeenCalledWith('PRO')
  })

  it('una campaña sin viñetas propias no deja la tarjeta vacía: usa los beneficios del plan', () => {
    const oferta = ofertaDe('PRO')
    oferta.copy.bullets = []
    pinta({ oferta })
    expect(within(tarjeta('PRO')).getByText('Cobra con tarjeta y efectivo')).toBeInTheDocument()
  })
})
