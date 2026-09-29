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
  it('shows Gratis, Pro and Premium with IVA prices, marks the current plan and selects', async () => {
    const onSelect = vi.fn()
    render(<PlanRow {...props({ onSelect })} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(within(radios[0]).getByText('plan.row.current')).toBeInTheDocument()
    expect(within(radios[1]).getByText(/1,158\.84/)).toBeInTheDocument()
    await userEvent.click(radios[2])
    expect(onSelect).toHaveBeenCalledWith('PREMIUM')
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
    render(<PlanRow {...props({ origin: CLASSIC, planState: { state: 'past_due' } as never, current: 'PRO', selected: 'PRO' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('plan.row.paymentPending')
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
    expect(within(screen.getAllByRole('radio')[1]).getByText(/1,158\.84/)).toBeInTheDocument()
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
})
