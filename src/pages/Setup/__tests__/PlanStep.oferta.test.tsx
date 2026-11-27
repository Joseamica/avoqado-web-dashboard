/**
 * PlanStep (alta larga y corta) con la versión del editor (B4, Task 8, A20).
 *
 * 🔴 Con `quote.oferta` el paso lee SU versión: los nombres, los días y los montos salen de la cotización; el «3 meses a $599»
 * de hoy sólo existe sin versión (la dirección «B»: el cupón de introducción sigue en el código, pero con una versión no viene).
 * Sin versión, el texto de hoy, tal cual.
 */
import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()

vi.mock('@/services/setup.service', () => ({ setupService: { planSetupIntent: (...a: unknown[]) => planSetupIntent(...a) } }))
vi.mock('@/services/hybridBilling.service', () => ({ getPublicBasicPlan: () => Promise.resolve(null) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({}),
}))
vi.mock('@/components/billing/PlanPicker', () => ({
  PlanPicker: ({ onSelectTier, promoNotes, preciosSinIva, fueraDeVenta }: any) => (
    <div
      data-testid="plan-picker"
      data-promo={promoNotes?.PRO ?? ''}
      data-precios={JSON.stringify(preciosSinIva ?? null)}
      data-fuera={JSON.stringify(fueraDeVenta ?? null)}
    >
      <button onClick={() => onSelectTier('PRO', 'monthly')}>elegir-pro</button>
    </div>
  ),
}))
vi.mock('@/components/billing/FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => null }))
vi.mock('@/components/billing/HybridOnboardingButton', () => ({ HybridOnboardingButton: () => null }))
vi.mock('@/components/billing/PlanComparison', () => ({ PlanComparison: () => null }))
// Español real de billing para los nombres; el resto, su `defaultValue` (como las demás pruebas del paso).
const t = (k: string, o?: any) => {
  const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
  return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})

import { PlanStep } from '../steps/PlanStep'
import { OFERTA_CARGANDO, OFERTA_SIN_DATO, OFERTA_V1, OFERTA_V2_PLUS, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'
import type { OfertaDelAlta, OpcionCotizada, PlanCotizado, PlanQuote } from '../launchOffer.types'

const opcion = (precioCents: number, netCents: number): OpcionCotizada => ({
  quoteToken: `tok-${precioCents}`,
  precioCents,
  netCents,
  firstChargeCents: precioCents,
  trialEndsAt: null,
})
const plan = (displayName: string, trialDays: number, mensual: [number, number], anual: [number, number]): PlanCotizado => ({
  displayName,
  onSale: true,
  requiresCard: true,
  trialDays,
  monthly: opcion(...mensual),
  annual: opcion(...anual),
})
// Pro se llama «Plus»: $799 + IVA al mes ($926.84) y $8,500 + IVA al año ($9,860); 14 días de prueba.
const OFERTA: OfertaDelAlta = {
  versionNumber: 2,
  free: { displayName: 'Gratis' },
  planes: { PRO: plan('Plus', 14, [92684, 79900], [986000, 850000]), PREMIUM: plan('Premium', 0, [197084, 169900], [1970840, 1699000]) },
}
const QUOTE_V2: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 14,
  tiers: {
    PRO: { monthlyCents: 92684, annualCents: 986000, monthlyNetCents: 79900, annualNetCents: 850000, intro: null },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, monthlyNetCents: 169900, annualNetCents: 1699000, intro: null },
  },
  oferta: OFERTA,
}
const QUOTE_DE_HOY: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: {
      monthlyCents: 115884,
      annualCents: 1158840,
      monthlyNetCents: 99900,
      annualNetCents: 999000,
      intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true },
    },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
  },
}

beforeEach(() => {
  localStorage.clear()
  ofertaActual.valor = OFERTA_V1
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti' } } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_1' } })
})

const pintar = (quote?: PlanQuote | null) =>
  render(<PlanStep data={{}} onNext={vi.fn()} venueId="venue_1" organizationId="org_1" quote={quote} activateBeforeContinue={vi.fn()} />)

async function alPago() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /^Continuar$/ }))
  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  return user
}

describe('PlanStep con la versión del editor', () => {
  it('🔴 con la cotización de una v2 (sin intro) no menciona «3 meses» ni «$599»: ni en la nota de la tarjeta ni en la ventana de pago', async () => {
    pintar(QUOTE_V2)
    expect(screen.getByTestId('plan-picker').dataset.promo).toBe('')
    expect(document.body.textContent).not.toMatch(/3 meses|\$599/)
    await alPago()
    expect(document.body.textContent).not.toMatch(/3 meses|\$599|\$999/)
    expect(screen.getByRole('radio', { name: /Pagar hoy/ })).toBeInTheDocument()
  })

  it('el picker recibe el nombre y los brutos de la cotización, tal cual', () => {
    pintar(QUOTE_V2)
    const precios = JSON.parse(screen.getByTestId('plan-picker').dataset.precios!)
    expect(precios.PRO).toEqual({
      monthlyNetCents: 79900,
      annualNetCents: 850000,
      displayName: 'Plus',
      monthlyGrossCents: 92684,
      annualGrossCents: 986000,
    })
  })

  it('el nombre del resumen y los días de la prueba salen de la cotización («Plus», 14 días), no de las constantes', async () => {
    pintar(QUOTE_V2)
    await alPago()
    expect(screen.getByText('Plus')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /14 días gratis/ })).toBeInTheDocument()
    expect(screen.queryByText(/30 días/)).toBeNull()
    expect(screen.getByText(/Empezar 14 días gratis/)).toBeInTheDocument()
  })

  it('un plan sin prueba (0 días) no ofrece «0 días gratis»: sólo se paga hoy', async () => {
    pintar({ ...QUOTE_V2, oferta: { ...OFERTA, planes: { ...OFERTA.planes, PRO: plan('Plus', 0, [92684, 79900], [986000, 850000]) } } })
    await alPago()
    expect(document.body.textContent).not.toMatch(/0 días gratis/)
    expect(screen.queryByRole('radio', { name: /días gratis/ })).toBeNull()
  })
})

describe('PlanStep sin versión: lo de hoy', () => {
  it('con la cotización de hoy y su intro, la nota dice lo del servidor; sin cotización, «3 meses a $599»', () => {
    pintar(QUOTE_DE_HOY)
    expect(screen.getByTestId('plan-picker').dataset.promo).toMatch(/Paga hoy y ahorra: 3 meses/)
    pintar(null)
    expect(screen.getAllByTestId('plan-picker')[1].dataset.promo).toBe('Paga hoy: 3 meses a $599 + IVA, luego $999.')
  })

  it('sin cotización, el precio de la ventana de pago sale del hook: $999 con la v1 y ningún monto con cargando o sin dato', async () => {
    pintar(null)
    await alPago()
    expect(screen.getByText('$999 al mes')).toBeInTheDocument()
  })

  it.each([OFERTA_CARGANDO, OFERTA_SIN_DATO])(
    '🔴 con el hook %j, sin cotización: ningún monto de precio (ni $0 ni el de las constantes)',
    async oferta => {
      ofertaActual.valor = oferta
      pintar(null)
      await alPago()
      // El precio del resumen no sale de las constantes (la nota de la promo de hoy es el texto sin versión y no es el precio del resumen).
      expect(document.body.textContent).not.toMatch(/\$999 al mes|\$0\b|\$0\.00/)
    },
  )

  it('sin cotización y con el hook en una v2 («Plus» a $799): $799 al mes, y sin «3 meses a $599»', async () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    pintar(null)
    await alPago()
    expect(screen.getByText('$799 al mes')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/3 meses|\$599/)
  })
})
