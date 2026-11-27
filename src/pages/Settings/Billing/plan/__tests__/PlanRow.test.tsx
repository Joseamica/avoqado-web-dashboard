// src/pages/Settings/Billing/plan/__tests__/PlanRow.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanOrigin } from '@/services/features.service'
import { PlanRow, type PlanRowProps } from '../PlanRow'
import { NO_ORIGIN } from '../planActions'
import { OFERTA_CARGANDO, OFERTA_SIN_DATO, OFERTA_V1, OFERTA_V2_PLUS, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'

vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: (key: string, params: Record<string, unknown> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => `${text}|${name}=${value}`, key),
  }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (value: string) => value.slice(0, 10) }) }))

const origin = (over: Partial<PlanOrigin>): PlanOrigin => ({ ...NO_ORIGIN, ...over })
const props = (over: Partial<PlanRowProps> = {}): PlanRowProps => ({
  origin: NO_ORIGIN,
  planState: undefined,
  grandfathered: false,
  grid: undefined,
  replacements: undefined,
  classicRejected: false,
  current: 'FREE',
  selected: 'FREE',
  onSelect: vi.fn(),
  interval: 'monthly',
  onIntervalChange: vi.fn(),
  canManage: true,
  busy: false,
  onCancel: vi.fn(),
  onReactivate: vi.fn(),
  onUpdatePayment: vi.fn(),
  ...over,
})
const CLASSIC = origin({
  kind: 'CLASSIC',
  tier: 'PRO',
  currentPeriodEnd: '2026-10-27T00:00:00.000Z',
  price: { base: 999, gross: 1158.84, currency: 'MXN' },
  interval: 'month',
  subscriptionId: 'sub_1',
})

describe('PlanRow', () => {
  beforeEach(() => {
    ofertaActual.valor = OFERTA_V1
  })

  it('shows Gratis, Pro and Premium with list prices before IVA, marks the current plan and selects', async () => {
    const onSelect = vi.fn()
    render(<PlanRow {...props({ onSelect })} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(within(radios[0]).getByText('plan.row.current')).toBeInTheDocument()
    expect(within(radios[1]).getByText(/999\.00/)).toBeInTheDocument()
    expect(within(radios[1]).getByText('plan.plusIva')).toBeInTheDocument()
    await userEvent.click(radios[2])
    expect(onSelect).toHaveBeenCalledWith('PREMIUM')
  })

  it('the current plan keeps what it pays, VAT included: a $22 promotion never shows as $18.97', () => {
    const promo = origin({ ...CLASSIC, price: { base: 18.97, gross: 22, currency: 'MXN' } })
    render(<PlanRow {...props({ origin: promo, current: 'PRO', selected: 'PRO' })} />)
    const pro = screen.getAllByRole('radio')[1]
    expect(within(pro).getByText(/22\.00/)).toBeInTheDocument()
    expect(within(pro).getByText('plan.ivaIncluded')).toBeInTheDocument()
    expect(pro).not.toHaveTextContent('18.97')
  })

  it('offers Mensual/Anual only when the classic checkout applies (a paid plan picked from Gratis)', () => {
    const { rerender } = render(<PlanRow {...props()} />)
    expect(document.querySelector('[data-tour="plan-interval"]')).toBeNull()
    rerender(<PlanRow {...props({ selected: 'PRO' })} />)
    expect(document.querySelector('[data-tour="plan-interval"]')).not.toBeNull()
    rerender(<PlanRow {...props({ origin: CLASSIC, current: 'PRO', selected: 'PRO' })} />)
    expect(document.querySelector('[data-tour="plan-interval"]')).toBeNull()
    rerender(<PlanRow {...props({ classicRejected: true, selected: 'PRO' })} />)
    expect(document.querySelector('[data-tour="plan-interval"]')).toBeNull()
  })

  // D6 (5-nov): with a purchase on its way the plan could still be switched, and its answer landed beside another plan.
  it('while a write is in flight no plan and no Mensual/Anual can be picked', () => {
    render(<PlanRow {...props({ selected: 'PRO', busy: true })} />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    const interval = document.querySelector('[data-tour="plan-interval"]') as HTMLElement
    for (const button of within(interval).getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('classic: renewal date, cancel and payment method', async () => {
    const onCancel = vi.fn()
    render(<PlanRow {...props({ origin: CLASSIC, current: 'PRO', selected: 'PRO', onCancel })} />)
    expect(screen.getByText('currentPlan.renewsOn|date=2026-10-27')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'currentPlan.actions.cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'currentPlan.actions.updatePayment' })).toBeEnabled()
  })

  it('classic scheduled to end: says until when and offers to resume', async () => {
    const onReactivate = vi.fn()
    render(
      <PlanRow {...props({ origin: { ...CLASSIC, cancelAt: CLASSIC.currentPeriodEnd }, current: 'PRO', selected: 'PRO', onReactivate })} />,
    )
    expect(screen.getByText('plan.row.endsClassic|tier=plan.tiers.pro.name|date=2026-10-27')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'plan.row.resume' }))
    expect(onReactivate).toHaveBeenCalled()
  })

  it('suspended access is said apart from the contracted plan', () => {
    render(<PlanRow {...props({ origin: CLASSIC, planState: { state: 'suspended' } as never, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('plan.row.paymentPending')
  })

  // D4 + D6 (5-nov-2026): `past_due` CONSERVA el acceso (el servidor lo concede durante la gracia y hasta el 4.º intento).
  // Decir «el acceso está en pausa» ahí era falso: el negocio seguía usando su plan.
  it('🔴 pago pendiente CON acceso: no dice «en pausa»; dice hasta cuándo conserva el plan', () => {
    render(
      <PlanRow
        {...props({
          origin: CLASSIC,
          planState: { state: 'past_due', gracePeriodEndsAt: '2099-11-22T04:40:00.000Z' } as never,
          current: 'PRO',
          selected: 'PRO',
        })}
      />,
    )
    const alerta = screen.getByRole('alert')
    expect(alerta).not.toHaveTextContent('plan.row.paymentPending|')
    expect(alerta.textContent).toMatch(/^plan\.row\.paymentPendingUntil\|date=/)
  })

  it('pago pendiente sin fecha de gracia conocida: aviso sin fecha y sin «en pausa»', () => {
    render(
      <PlanRow
        {...props({ origin: CLASSIC, planState: { state: 'past_due', gracePeriodEndsAt: null } as never, current: 'PRO', selected: 'PRO' })}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('plan.row.paymentPendingNoDate')
  })

  it('contract: cancel renewal, and no resume', () => {
    render(
      <PlanRow
        {...props({
          origin: origin({
            kind: 'CONTRACT',
            tier: 'PREMIUM',
            contractId: 'hc_1',
            contractRevision: 3,
            currentPeriodEnd: '2026-10-27T00:00:00.000Z',
          }),
          current: 'PREMIUM',
          selected: 'PREMIUM',
        })}
      />,
    )
    expect(screen.getByRole('button', { name: 'hybrid.cancelContract' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'plan.row.resume' })).toBeNull()
  })

  it('comp: says until when, with no cancel', () => {
    render(
      <PlanRow
        {...props({
          origin: origin({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: '2026-11-01T00:00:00.000Z' }),
          current: 'PRO',
          selected: 'PRO',
        })}
      />,
    )
    expect(screen.getByText('plan.row.comp|tier=plan.tiers.pro.name|date=2026-11-01')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'currentPlan.actions.cancel' })).toBeNull()
  })

  it('without the feature grid (loading or failed) shows prices but no function count', () => {
    const { rerender } = render(<PlanRow {...props()} />)
    expect(within(screen.getAllByRole('radio')[1]).getByText(/999\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/plan\.row\.features/)).toBeNull()
    rerender(
      <PlanRow {...props({ grid: { catalogVersion: 'v1', purchasesEnabled: true, plans: { PRO: null, PREMIUM: null }, entries: [] } })} />,
    )
    expect(screen.getAllByText('plan.row.features|count=0')).toHaveLength(3)
  })

  it('a founder sees why and cannot change plans; read-only users cannot act', () => {
    const { rerender } = render(<PlanRow {...props({ grandfathered: true })} />)
    expect(screen.getByText('plan.row.founder')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')[1]).toBeDisabled()
    rerender(<PlanRow {...props({ origin: CLASSIC, current: 'PRO', selected: 'PRO', canManage: false })} />)
    expect(screen.getAllByRole('radio')[2]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'currentPlan.actions.cancel' })).toBeDisabled()
  })

  // D3 full-testing WARN 3: tras quedarse con el plan de una prueba (Stripe en trial), la fecha es el PRIMER cobro.
  it('en prueba con tarjeta dice «tu primer cobro será el…», no «se renueva el…»', () => {
    render(<PlanRow {...props({ origin: CLASSIC, planState: { state: 'trial' } as never, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.getByText('plan.row.firstChargeOn|date=2026-10-27')).toBeInTheDocument()
    expect(screen.queryByText(/currentPlan\.renewsOn/)).toBeNull()
  })

  // Planes editables (B2, Task 12): una prueba SIN tarjeta no «se renueva»: Stripe la cancela si nadie pone la tarjeta.
  it('PlanRow con origin.faltaTarjeta: «Tu prueba termina el …; pon tu tarjeta para seguir con Pro», no «se renueva»', () => {
    const sinTarjeta = origin({ ...CLASSIC, currentPeriodEnd: '2026-12-10T17:00:00.000Z', faltaTarjeta: true })
    render(
      <PlanRow
        {...props({
          origin: sinTarjeta,
          planState: { state: 'trial', trialEndsAt: '2026-12-10T17:00:00.000Z' } as never,
          current: 'PRO',
          selected: 'PRO',
        })}
      />,
    )
    expect(screen.getByText('plan.row.trialNoCard|date=2026-12-10|tier=plan.tiers.pro.name')).toBeInTheDocument()
    expect(screen.queryByText(/currentPlan\.renewsOn/)).toBeNull()
    expect(screen.queryByText(/plan\.row\.firstChargeOn/)).toBeNull()
  })

  it('B2: con la prueba ya TERMINADA en Stripe (la baja no llegó) no promete «primer cobro» ni «se renueva», y deja elegir mensual o anual', () => {
    const terminada = {
      state: 'trial',
      trialEndsAt: '2026-12-10T17:00:00.000Z',
      cotizacion: {
        versionNumber: 2,
        planes: {},
        estadoDeLaPrueba: { estado: 'TERMINADA', tier: 'PRO', interval: 'monthly', trialEndsAt: '2026-12-10T17:00:00.000Z' },
      },
    }
    render(<PlanRow {...props({ origin: CLASSIC, planState: terminada as never, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.queryByText(/plan\.row\.firstChargeOn/)).toBeNull()
    expect(screen.queryByText(/currentPlan\.renewsOn/)).toBeNull()
    expect(document.querySelector('[data-tour="plan-interval"]')).not.toBeNull()
  })

  it('fix round 2: con la cotización, la píldora de un plan fuera de venta dice «No disponible por ahora» y ningún precio; la de un plan vendible, su precio', () => {
    const opcion = (precioCents: number) => ({
      quoteToken: `tok_${precioCents}`,
      precioCents,
      netCents: precioCents,
      firstChargeCents: precioCents,
      trialEndsAt: null,
    })
    const cotizacion = {
      versionNumber: 2,
      planes: {
        PRO: { displayName: 'Pro', vendible: true, monthly: opcion(92684), annual: opcion(926840) },
        PREMIUM: { displayName: 'Premium', vendible: false, monthly: null, annual: null },
      },
    }
    render(<PlanRow {...props({ planState: { state: 'none', cotizacion } as never })} />)
    const [, pro, premium] = screen.getAllByRole('radio')
    expect(within(premium).getByText('plan.notOnSale')).toBeInTheDocument()
    expect(premium).not.toHaveTextContent('$')
    expect(within(premium).queryByText('plan.plusIva')).toBeNull()
    expect(within(premium).queryByText('plan.ivaIncluded')).toBeNull()
    expect(within(pro).getByText(/926\.84/)).toBeInTheDocument()
    expect(within(pro).queryByText('plan.notOnSale')).toBeNull()
  })

  it('fix round 3: durante una prueba viva sin tarjeta, la píldora de Premium dice «No se puede cambiar de plan durante tu prueba», sin precio; la del plan de la prueba, su precio', () => {
    const planes = {
      PRO: { displayName: 'Pro', vendible: false, monthly: null, annual: null },
      PREMIUM: { displayName: 'Premium', vendible: false, monthly: null, annual: null },
    }
    const estadoDeLaPrueba = {
      estado: 'SIN_TARJETA',
      tier: 'PRO',
      interval: 'monthly',
      trialEndsAt: '2026-12-10T17:00:00.000Z',
      tarjeta: null,
      montoAlTerminarCents: 81084,
    }
    const enPrueba = origin({ ...CLASSIC, faltaTarjeta: true })
    render(
      <PlanRow
        {...props({
          origin: enPrueba,
          planState: {
            state: 'trial',
            trialEndsAt: '2026-12-10T17:00:00.000Z',
            cotizacion: { versionNumber: 2, planes, estadoDeLaPrueba },
          } as never,
          current: 'PRO',
          selected: 'PRO',
        })}
      />,
    )
    const [, pro, premium] = screen.getAllByRole('radio')
    expect(within(premium).getByText('plan.notDuringTrial')).toBeInTheDocument()
    expect(within(premium).queryByText('plan.notOnSale')).toBeNull()
    expect(premium).not.toHaveTextContent('$')
    expect(within(pro).getByText(/1,158\.84/)).toBeInTheDocument()
    expect(within(pro).queryByText('plan.notDuringTrial')).toBeNull()
  })

  // D5 (5-nov-2026): con un cupón vigente, «Tu plan» dice lo que paga, hasta cuándo y el precio después.
  it('cupón de 3 meses: lo que paga, hasta cuándo y después el precio de lista', () => {
    const conCupon = {
      ...CLASSIC,
      discount: { gross: 811.19, percentOff: 30, duration: 'repeating' as const, endsAt: '2027-02-05T17:00:00.000Z' },
    }
    render(<PlanRow {...props({ origin: conCupon, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.getByText(/plan\.row\.discountUntil\|price=\$811\.19\|date=2027-02-05\|list=\$1,158\.84/)).toBeInTheDocument()
  })

  it('cupón de una vez: «en tu siguiente cobro»', () => {
    const conCupon = { ...CLASSIC, discount: { gross: 811.19, percentOff: 30, duration: 'once' as const, endsAt: null } }
    render(<PlanRow {...props({ origin: conCupon, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.getByText(/plan\.row\.discountOnce\|price=\$811\.19\|list=\$1,158\.84/)).toBeInTheDocument()
  })

  it('REGRESIÓN: sin cupón no aparece ninguna línea de descuento', () => {
    render(<PlanRow {...props({ origin: CLASSIC, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.queryByText(/plan\.row\.discount/)).toBeNull()
  })

  // B4: las píldoras sin cotización salen de la oferta vigente; sin ella, ningún monto.
  it('v2 «Plus»: la píldora de Pro dice Plus y $799 + IVA (no $999)', () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    render(<PlanRow {...props()} />)
    const pro = screen.getAllByRole('radio')[1]
    expect(within(pro).getByText('Plus')).toBeInTheDocument()
    expect(within(pro).getByText(/799\.00/)).toBeInTheDocument()
    expect(within(pro).getByText('plan.plusIva')).toBeInTheDocument()
    expect(pro).not.toHaveTextContent('999')
  })

  it.each([
    ['cargando', OFERTA_CARGANDO],
    ['sinDato', OFERTA_SIN_DATO],
  ])('con %s las píldoras de Pro y Premium no traen monto (ni $999, ni $0.00)', (_n, oferta) => {
    ofertaActual.valor = oferta
    render(<PlanRow {...props()} />)
    const [, pro, premium] = screen.getAllByRole('radio')
    for (const pildora of [pro, premium]) {
      expect(pildora).not.toHaveTextContent(/\$|plan\.plusIva/)
    }
    expect(pro).toHaveTextContent('plan.tiers.pro.name')
  })

  it('I3: con una cotización firmada, el nombre del plan sale de ELLA aunque la oferta no cargue', () => {
    ofertaActual.valor = OFERTA_CARGANDO
    const cotizacion = {
      versionNumber: 2,
      planes: {
        PRO: { displayName: 'Plus', vendible: true, monthly: null, annual: null },
        PREMIUM: { displayName: 'Elite', vendible: true, monthly: null, annual: null },
      },
    }
    render(<PlanRow {...props({ planState: { cotizacion } as never })} />)
    const [, pro, premium] = screen.getAllByRole('radio')
    expect(within(pro).getByText('Plus')).toBeInTheDocument()
    expect(within(premium).getByText('Elite')).toBeInTheDocument()
  })
})
