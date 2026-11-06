// src/pages/Settings/Billing/plan/__tests__/SelectionSummary.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeatureGridEntry } from '@/services/hybridBilling.service'
import { SelectionSummary, type SelectionSummaryProps } from '../SelectionSummary'
import type { SelectionSummaryModel } from '../planActions'

vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (value: string) => value.slice(0, 10) }) }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: (key: string, params: Record<string, unknown> = {}) =>
      (params.defaultValue as string) ?? Object.entries(params).reduce((text, [name, value]) => `${text}|${name}=${value}`, key),
  }),
}))

const loyalty = {
  id: 'LOYALTY_PROGRAM',
  featureCode: 'LOYALTY_PROGRAM',
  names: { es: 'Lealtad', en: 'Loyalty', fr: 'Fidélité' },
  access: { source: 'PLAN' },
} as unknown as FeatureGridEntry
const model = (over: Partial<SelectionSummaryModel> = {}): SelectionSummaryModel => ({
  operation: { kind: 'FEATURES', lines: [{ publicationId: 'pub_1', selectedFeatureCodes: [] }] },
  current: 'FREE',
  target: 'FREE',
  lines: [
    { key: 'plan-FREE', plan: 'FREE', price: 0 },
    {
      key: 'LOYALTY_PROGRAM',
      entry: loyalty,
      offer: {
        publicationId: 'pub_1',
        campaignId: 'c',
        name: 'Lealtad',
        kind: 'FEATURES',
        planTier: null,
        price: 199,
        renewal: 'REPRICE',
        renewalPrice: 249,
        promotionCycles: 3,
        includedFeatureCodes: ['LOYALTY_PROGRAM'],
      },
      price: 199,
    },
  ],
  monthlyTotal: 199,
  payToday: null,
  firstChargeAt: null,
  lose: [],
  hint: { tier: 'PRO', covered: 1, more: 17, price: 1158.84 },
  seatNotice: false,
  tooMany: false,
  ...over,
})
const renderSummary = (over: Partial<SelectionSummaryProps> = {}) => {
  const props: SelectionSummaryProps = {
    model: model(),
    seatRule: 'CHOOSE',
    canManage: true,
    busy: false,
    error: null,
    onReview: vi.fn(),
    onPickTier: vi.fn(),
    onAssisted: vi.fn(),
    ...over,
  }
  render(<SelectionSummary {...props} />)
  return props
}
const review = () => document.querySelector('[data-tour="plan-review"]') as HTMLButtonElement

describe('SelectionSummary', () => {
  it('lists what changes, the monthly total and that today is calculated at review for a hybrid purchase', () => {
    renderSummary()
    expect(screen.getByText('plan.selection.plan|tier=plan.tiers.free.name')).toBeInTheDocument()
    expect(screen.getAllByText(/\$199\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/plan\.selection\.payTodayAtReview/)).toBeInTheDocument()
    expect(screen.getByText(/plan\.selection\.promo\|count=3\|price=\$249\.00/)).toBeInTheDocument()
  })

  it('adding functions to a paid plan says the total is what is ADDED, not the whole monthly bill', () => {
    const [, feature] = model().lines
    renderSummary({ model: model({ current: 'PRO', target: 'PRO', lines: [feature], hint: null }) })
    expect(screen.getAllByText('plan.selection.monthlyAdded')).toHaveLength(2)
    expect(screen.queryByText('plan.selection.monthlyTotal')).not.toBeInTheDocument()
  })

  it('the classic checkout says what is paid today', () => {
    renderSummary({
      model: model({
        operation: { kind: 'CLASSIC_CHECKOUT', tier: 'PRO' },
        target: 'PRO',
        lines: [{ key: 'plan-PRO', plan: 'PRO', price: 1158.84 }],
        monthlyTotal: 1158.84,
        payToday: 1158.84,
        hint: null,
      }),
    })
    expect(screen.getByText(/plan\.selection\.payToday\|price=\$1,158\.84/)).toBeInTheDocument()
    expect(screen.getByText(/plan\.selection\.netPlusIva\|net=\$999\.00\|gross=\$1,158\.84/)).toBeInTheDocument()
  })

  it('the plan comparison is informative and can switch to that plan', async () => {
    const props = renderSummary()
    expect(document.querySelector('[data-tour="plan-hint"]')).toHaveTextContent(
      'plan.selection.hint|tier=plan.tiers.pro.name|covered=1|more=17|price=$999.00',
    )
    await userEvent.click(screen.getByRole('button', { name: 'plan.selection.hintCta|tier=plan.tiers.pro.name' }))
    expect(props.onPickTier).toHaveBeenCalledWith('PRO')
  })

  it('a drop to Gratis lists what stops and states the seat rule before confirming', () => {
    // What summarizeSelection returns for a classic drop: only the Gratis line (nothing marked), total 0.
    renderSummary({
      model: model({
        operation: { kind: 'DOWNGRADE_CLASSIC' },
        current: 'PRO',
        target: 'FREE',
        lines: [{ key: 'plan-FREE', plan: 'FREE', price: 0 }],
        monthlyTotal: 0,
        lose: [loyalty],
        seatNotice: true,
        hint: null,
      }),
    })
    expect(screen.getByText('plan.selection.lose')).toBeInTheDocument()
    expect(screen.queryByText(/netPlusIva/)).toBeNull()
    expect(screen.getByText('Lealtad')).toBeInTheDocument()
    expect(document.querySelector('[data-tour="plan-seat-notice"]')).toHaveTextContent('plan.seatNotice.choose')
    expect(review()).toHaveTextContent('plan.selection.drop')
  })

  it('review is disabled with nothing chosen, with too many offers and without permission', () => {
    const { rerender } = render(
      <SelectionSummary
        {...{
          model: model({ operation: { kind: 'NONE' }, lines: [], monthlyTotal: null, hint: null }),
          seatRule: 'CHOOSE',
          canManage: true,
          busy: false,
          error: null,
          onReview: vi.fn(),
          onPickTier: vi.fn(),
          onAssisted: vi.fn(),
        }}
      />,
    )
    expect(review()).toBeDisabled()
    rerender(
      <SelectionSummary
        {...{
          model: model({ tooMany: true }),
          seatRule: 'CHOOSE',
          canManage: true,
          busy: false,
          error: null,
          onReview: vi.fn(),
          onPickTier: vi.fn(),
          onAssisted: vi.fn(),
        }}
      />,
    )
    expect(review()).toBeDisabled()
    rerender(
      <SelectionSummary
        {...{
          model: model(),
          seatRule: 'CHOOSE',
          canManage: false,
          busy: false,
          error: null,
          onReview: vi.fn(),
          onPickTier: vi.fn(),
          onAssisted: vi.fn(),
        }}
      />,
    )
    expect(review()).toBeDisabled()
    expect(screen.getByText('hybrid.permission')).toBeInTheDocument()
  })

  it('a server refusal is shown as is, with the assisted change next to it', async () => {
    const props = renderSummary({ error: 'Tu organización ya utilizó esta campaña.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Tu organización ya utilizó esta campaña.')
    await userEvent.click(screen.getByRole('button', { name: 'plan.selection.assisted' }))
    expect(props.onAssisted).toHaveBeenCalled()
  })

  it('a dependency the cart brings for too short: offers the list of that line, which the owner can pick', async () => {
    const inventory = {
      id: 'INVENTORY_TRACKING',
      featureCode: 'INVENTORY_TRACKING',
      names: { es: 'Inventario FIFO', en: 'FIFO inventory', fr: '' },
    } as unknown as FeatureGridEntry
    const onPreferList = vi.fn()
    renderSummary({
      error: 'Reorden automático necesita Inventario FIFO…',
      dependency: { kind: 'LIST', prefer: 'INVENTORY_TRACKING', entry: inventory, price: 599 },
      onPreferList,
    })
    await userEvent.click(screen.getByRole('button', { name: 'plan.dependency.useList|name=Inventario FIFO|price=$516.38' }))
    expect(onPreferList).toHaveBeenCalledWith('INVENTORY_TRACKING')
  })

  it('… the plan line: the list of the plan', async () => {
    const onPreferList = vi.fn()
    renderSummary({ error: 'x', dependency: { kind: 'LIST', prefer: 'PLAN', plan: 'PRO', price: 1158.84 }, onPreferList })
    await userEvent.click(screen.getByRole('button', { name: 'plan.dependency.useList|name=plan.tiers.pro.name|price=$999.00' }))
    expect(onPreferList).toHaveBeenCalledWith('PLAN')
  })

  it('a dependency the venue keeps but that ends first goes to the assisted change; one nobody brings asks to add it', () => {
    const { rerender } = render(
      <SelectionSummary
        model={model()}
        seatRule="CHOOSE"
        canManage
        busy={false}
        error="x"
        onReview={vi.fn()}
        onPickTier={vi.fn()}
        onAssisted={vi.fn()}
        dependency={{ kind: 'RETAINED', code: 'INVENTORY_TRACKING' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('plan.dependency.retained|name=INVENTORY_TRACKING')
    expect(screen.getByRole('button', { name: 'plan.selection.assisted' })).toBeInTheDocument()
    rerender(
      <SelectionSummary
        model={model()}
        seatRule="CHOOSE"
        canManage
        busy={false}
        error="x"
        onReview={vi.fn()}
        onPickTier={vi.fn()}
        dependency={{ kind: 'MISSING', code: 'INVENTORY_TRACKING' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('plan.dependency.missing|name=INVENTORY_TRACKING')
    expect(screen.queryByRole('button', { name: /useList/ })).toBeNull()
  })

  it('a line with no list asks to remove the function, by its catalog name', () => {
    const reorder = { id: 'AUTO_REORDER', featureCode: 'AUTO_REORDER', names: { es: 'Reorden automático', en: 'Auto-reorder', fr: '' } }
    renderSummary({
      error: 'x',
      dependency: { kind: 'REMOVE', code: 'AUTO_REORDER', entry: reorder as unknown as FeatureGridEntry },
      onPreferList: vi.fn(),
    })
    expect(screen.getByRole('alert')).toHaveTextContent('plan.dependency.remove|name=Reorden automático')
    expect(screen.queryByRole('button', { name: /useList/ })).toBeNull()
  })

  it('a kept contract on Gratis, with no assisted button on screen, never names that button', () => {
    renderSummary({ error: 'x', onAssisted: undefined, dependency: { kind: 'RETAINED', code: 'INVENTORY_TRACKING' } })
    expect(screen.getByRole('alert')).toHaveTextContent('plan.dependency.retainedContact|name=INVENTORY_TRACKING')
    expect(screen.queryByText(/plan\.dependency\.retained\|/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'plan.selection.assisted' })).toBeNull()
    // «Escríbenos» comes with a real channel: the sales WhatsApp, as the upgrade dialog has.
    const contact = screen.getByRole('link', { name: 'plan.dependency.contactCta' })
    expect(contact).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\d+\?text=/))
    expect(contact.getAttribute('href')).toContain(encodeURIComponent('plan.dependency.contactMessage|name=INVENTORY_TRACKING'))
    expect(contact).toHaveAttribute('target', '_blank')
  })

  it('a refused drop keeping functions offers dropping at period end', async () => {
    const onFallbackDrop = vi.fn()
    renderSummary({ error: 'No se pudo reemplazar', onFallbackDrop })
    await userEvent.click(screen.getByRole('button', { name: 'plan.selection.fallbackDrop' }))
    expect(onFallbackDrop).toHaveBeenCalled()
  })

  it('with no assisted target, the refusal shows no assisted link', () => {
    renderSummary({ error: 'Tu organización ya utilizó esta campaña.', onAssisted: undefined })
    expect(screen.getByRole('alert')).toHaveTextContent('Tu organización ya utilizó esta campaña.')
    expect(screen.queryByRole('button', { name: 'plan.selection.assisted' })).toBeNull()
  })

  it('the refusal links are disabled while busy and without permission', () => {
    const { rerender } = render(
      <SelectionSummary
        model={model()}
        seatRule="CHOOSE"
        canManage
        busy
        error="No se pudo reemplazar"
        onReview={vi.fn()}
        onPickTier={vi.fn()}
        onAssisted={vi.fn()}
        onFallbackDrop={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'plan.selection.fallbackDrop' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'plan.selection.assisted' })).toBeDisabled()
    rerender(
      <SelectionSummary
        model={model()}
        seatRule="CHOOSE"
        canManage={false}
        busy={false}
        error="No se pudo reemplazar"
        onReview={vi.fn()}
        onPickTier={vi.fn()}
        onAssisted={vi.fn()}
        onFallbackDrop={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'plan.selection.fallbackDrop' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'plan.selection.assisted' })).toBeDisabled()
  })

  it('on a phone, a fixed bar keeps the monthly total and the button', () => {
    renderSummary()
    const bar = document.querySelector('[data-tour="plan-selection-bar"]')
    expect(bar).toHaveTextContent('$199.00')
    // The figure is the monthly total, never read as today's charge.
    expect(bar).toHaveTextContent('plan.selection.monthlyTotal')
    expect(document.querySelector('[data-tour="plan-review-bar"]')).not.toBeNull()
  })

  // D3: quedarse con el plan de una prueba regalada — hoy $0 y el día del primer cobro, nunca «Hoy pagas $1,158.84».
  it('quedarse con el plan de una prueba regalada dice hoy $0, el primer cobro y que puede cancelar antes', () => {
    renderSummary({
      interval: 'annual',
      model: model({
        operation: { kind: 'CLASSIC_CHECKOUT', tier: 'PRO', firstChargeAt: '2026-12-05T17:19:24.498Z' },
        current: 'PRO',
        target: 'PRO',
        lines: [{ key: 'plan-PRO', plan: 'PRO', price: 11588.4 }],
        monthlyTotal: 11588.4,
        payToday: 0,
        firstChargeAt: '2026-12-05T17:19:24.498Z',
        hint: null,
      }),
    })
    expect(screen.getAllByText('plan.selection.annualTotal').length).toBeGreaterThan(0)
    expect(screen.getByText(/plan\.selection\.payTodayDeferred\|price=\$0\.00\|date=2026-12-05/)).toBeInTheDocument()
    expect(screen.getByText('plan.selection.deferredNote|date=2026-12-05')).toBeInTheDocument()
    expect(screen.queryByText(/plan\.selection\.payToday\|/)).toBeNull()
    // full-testing WARN 4: el botón dice «Quedarme con Pro», no «Revisar y pagar».
    expect(screen.getAllByRole('button', { name: /plan\.selection\.keepPlan\|tier=plan\.tiers\.pro\.name/ }).length).toBeGreaterThan(0)
  })
})

// D5 (5-nov): below xl the box sits under the 47 functions and the fixed bar is the button in sight; a refusal landed
// 4,700 px below it and the owner saw nothing happen.
describe('a refusal comes into view', () => {
  const refuse = (rect: { top: number; bottom: number }) => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: rect.top, bottom: rect.bottom } as DOMRect)
    const props: SelectionSummaryProps = {
      model: model(),
      seatRule: 'CHOOSE',
      canManage: true,
      busy: false,
      error: null,
      onReview: vi.fn(),
      onPickTier: vi.fn(),
    }
    const view = render(<SelectionSummary {...props} />)
    view.rerender(<SelectionSummary {...props} error="Este negocio ya tiene un plan." />)
    return scroll
  }
  afterEach(() => {
    vi.restoreAllMocks()
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  it('scrolls to the refusal when it lands out of sight', () => {
    expect(refuse({ top: 4715, bottom: 4865 })).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
  })

  it('leaves the page where it is when the refusal is already in sight', () => {
    expect(refuse({ top: 300, bottom: 400 })).not.toHaveBeenCalled()
  })
})
