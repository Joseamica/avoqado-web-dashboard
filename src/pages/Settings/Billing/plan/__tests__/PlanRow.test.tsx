// src/pages/Settings/Billing/plan/__tests__/PlanRow.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PlanOrigin } from '@/services/features.service'
import { PlanRow, type PlanRowProps } from '../PlanRow'
import { NO_ORIGIN } from '../planActions'

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
})
