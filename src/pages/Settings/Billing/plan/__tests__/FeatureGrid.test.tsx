// src/pages/Settings/Billing/plan/__tests__/FeatureGrid.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FeatureAccessSource, FeatureGridEntry } from '@/services/hybridBilling.service'
import { FeatureGrid, type FeatureGridProps } from '../FeatureGrid'
import { isMarkable } from '../planActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'es' },
    t: (key: string, params: Record<string, unknown> = {}) =>
      (params.defaultValue as string) ?? Object.entries(params).reduce((text, [name, value]) => `${text}|${name}=${value}`, key),
  }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (value: string) => value.slice(0, 10) }) }))

const entry = (
  id: string,
  category: FeatureGridEntry['category'],
  minimumTier: FeatureGridEntry['minimumTier'],
  source: FeatureAccessSource,
  price: number | null,
  extra: Partial<FeatureGridEntry> = {},
): FeatureGridEntry => ({
  id,
  featureCode: id.startsWith('BASE_') ? null : id,
  names: { es: `n-${id}`, en: id, fr: id },
  description: '',
  category,
  minimumTier,
  offering: minimumTier === 'FREE' ? 'INCLUDED' : 'CONFIGURABLE',
  access: { source, contractId: null, paidThrough: null, cancelAt: null },
  offer:
    price == null
      ? null
      : {
          publicationId: `pub_${id}`,
          campaignId: 'c',
          name: id,
          kind: 'FEATURES',
          planTier: null,
          price,
          renewal: 'SAME_PRICE',
          renewalPrice: null,
          promotionCycles: null,
          includedFeatureCodes: [id],
        },
  ...extra,
})
const ENTRIES = [
  entry('BASE_POS', 'sell', 'FREE', 'FREE', null),
  entry('LOYALTY_PROGRAM', 'customers', 'PRO', 'NONE', 199),
  entry('REFERRAL_PROGRAM', 'customers', 'PRO', 'CONTRACT', null, {
    access: { source: 'CONTRACT', contractId: 'hc_1', paidThrough: '2026-10-27T00:00:00.000Z', cancelAt: null },
  }),
  entry('COMMISSIONS', 'team', 'PREMIUM', 'NONE', null),
  entry('MASTER_CATALOG', 'custom', null, 'NONE', null, { offering: 'CONTACT' }),
]
const renderGrid = (over: Partial<FeatureGridProps> = {}) => {
  const props: FeatureGridProps = {
    entries: ENTRIES,
    purchasesEnabled: true,
    mode: 'ADD',
    marked: [],
    isMarkable: item => isMarkable(item, 'ADD'),
    onToggle: vi.fn(),
    onPickTier: vi.fn(),
    canManage: true,
    target: 'FREE',
    ...over,
  }
  render(<FeatureGrid {...props} />)
  return props
}

describe('FeatureGrid', () => {
  it('shows every function grouped by area, with counts taken from the data', () => {
    renderGrid()
    expect(screen.getByRole('heading', { name: 'plan.grid.title|count=5' })).toBeInTheDocument()
    expect(screen.getByText('plan.grid.categories.customers · 2')).toBeInTheDocument()
    expect(screen.getByText('plan.grid.categories.sell · 1')).toBeInTheDocument()
  })

  it('a function with an offer can be marked; its price shows per month', async () => {
    const props = renderGrid()
    expect(screen.getByText(/\$199/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'plan.grid.mark|name=n-LOYALTY_PROGRAM' }))
    expect(props.onToggle).toHaveBeenCalledWith('LOYALTY_PROGRAM')
  })

  it('a price with cents shows its cents, as the summary and the server do', () => {
    renderGrid({ entries: [entry('LOYALTY_PROGRAM', 'customers', 'PRO', 'NONE', 199.99)] })
    expect(screen.getByText(/199\.99/)).toBeInTheDocument()
  })

  it('a promotion below its list shows the list struck through and when the promotional price ends', () => {
    const promo = entry('INVENTORY_TRACKING', 'inventory', 'PREMIUM', 'NONE', 479.2)
    promo.offer = { ...promo.offer!, listPrice: 599, renewal: 'REPRICE', renewalPrice: 599, promotionCycles: 3 }
    const { rerender } = render(
      <FeatureGrid
        entries={[promo]}
        purchasesEnabled
        mode="ADD"
        marked={[]}
        isMarkable={item => isMarkable(item, 'ADD')}
        onToggle={vi.fn()}
        onPickTier={vi.fn()}
        canManage
        target="FREE"
      />,
    )
    expect(screen.getByText(/\$479\.20/)).toBeInTheDocument()
    const struck = document.querySelector('s')
    expect(struck).toHaveTextContent('$599.00')
    expect(screen.getByText('plan.grid.promoThen|count=3|price=$599.00')).toBeInTheDocument()
    rerender(
      <FeatureGrid
        entries={[{ ...promo, offer: { ...promo.offer!, renewal: 'SAME_PRICE', renewalPrice: null, promotionCycles: null } }]}
        purchasesEnabled
        mode="ADD"
        marked={[]}
        isMarkable={item => isMarkable(item, 'ADD')}
        onToggle={vi.fn()}
        onPickTier={vi.fn()}
        canManage
        target="FREE"
      />,
    )
    expect(screen.getByText('plan.grid.promoForever')).toBeInTheDocument()
    rerender(
      <FeatureGrid
        entries={[{ ...promo, offer: { ...promo.offer!, renewal: 'END', renewalPrice: null, promotionCycles: 2 } }]}
        purchasesEnabled
        mode="ADD"
        marked={[]}
        isMarkable={item => isMarkable(item, 'ADD')}
        onToggle={vi.fn()}
        onPickTier={vi.fn()}
        canManage
        target="FREE"
      />,
    )
    expect(screen.getByText('plan.grid.promoEnds|count=2')).toBeInTheDocument()
  })

  it('once the owner picked the list, the tile shows the list price like the summary and the quote', () => {
    const promo = entry('INVENTORY_TRACKING', 'inventory', 'PREMIUM', 'NONE', 479.2)
    promo.offer = { ...promo.offer!, listPrice: 599, renewal: 'REPRICE', renewalPrice: 599, promotionCycles: 3 }
    promo.listOffer = {
      ...promo.offer,
      publicationId: 'pub_list',
      price: 599,
      renewal: 'SAME_PRICE',
      renewalPrice: null,
      promotionCycles: null,
    }
    renderGrid({ entries: [promo], preferList: ['INVENTORY_TRACKING'] })
    expect(screen.getByText(/\$599\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/\$479\.20/)).toBeNull()
    expect(document.querySelector('s')).toBeNull()
    expect(screen.queryByText(/promoThen|promoForever|promoEnds/)).toBeNull()
  })

  it('a promotion without its cycles never shows a raw condition key', () => {
    const promo = entry('INVENTORY_TRACKING', 'inventory', 'PREMIUM', 'NONE', 479.2)
    promo.offer = { ...promo.offer!, listPrice: 599, renewal: 'REPRICE', renewalPrice: 599, promotionCycles: null }
    renderGrid({ entries: [promo] })
    expect(document.querySelector('s')).toHaveTextContent('$599.00')
    expect(screen.queryByText(/promoThen|promoEnds/)).toBeNull()
  })

  it('a list price (or a promotion with no list under it) shows no strike and no condition', () => {
    renderGrid({ entries: [entry('LOYALTY_PROGRAM', 'customers', 'PRO', 'NONE', 599)] })
    expect(document.querySelector('s')).toBeNull()
    expect(screen.queryByText(/promoThen|promoForever|promoEnds/)).toBeNull()
  })

  it('an owned function shows no price to buy it again', () => {
    renderGrid({ entries: [entry('PROMOTIONS', 'customers', 'PRO', 'PLAN', 149)] })
    expect(screen.getByText('plan.grid.inPlan')).toBeInTheDocument()
    expect(screen.queryByText(/\$149/)).toBeNull()
  })

  it('says what the venue already has: included, and by contract with its renewal', () => {
    renderGrid()
    expect(screen.getByText('plan.grid.included')).toBeInTheDocument()
    expect(screen.getByText('plan.grid.ownedUntil|date=2026-10-27')).toBeInTheDocument()
  })

  it('a function that only comes in a plan preselects that plan; a quoted one says so', async () => {
    const props = renderGrid()
    await userEvent.click(screen.getByRole('button', { name: 'plan.grid.pickTier|name=n-COMMISSIONS|tier=plan.tiers.premium.name' }))
    expect(props.onPickTier).toHaveBeenCalledWith('PREMIUM')
    expect(screen.getByText('plan.grid.quote')).toBeInTheDocument()
  })

  it('with a plan already picked, a function the plan lacks still jumps to the plan that has it', async () => {
    const entries = [...ENTRIES, entry('TABLE_SERVICE', 'sell', 'PRO', 'NONE', null)]
    const pickTable = { name: 'plan.grid.pickTier|name=n-TABLE_SERVICE|tier=plan.tiers.pro.name' }
    const pickCommissions = { name: 'plan.grid.pickTier|name=n-COMMISSIONS|tier=plan.tiers.premium.name' }
    const props = renderGrid({ entries, purchasesEnabled: false, mode: 'VIEW', target: 'PRO' })
    expect(screen.queryByRole('button', pickTable)).toBeNull()
    await userEvent.click(screen.getByRole('button', pickCommissions))
    expect(props.onPickTier).toHaveBeenCalledWith('PREMIUM')
  })

  it('with Premium picked, nothing sends the selection back down', () => {
    const entries = [...ENTRIES, entry('TABLE_SERVICE', 'sell', 'PRO', 'NONE', null)]
    renderGrid({ entries, purchasesEnabled: false, mode: 'VIEW', target: 'PREMIUM' })
    expect(screen.queryByRole('button', { name: /pickTier/ })).toBeNull()
  })

  it('with sales closed every function shows, with no price and no checkbox', () => {
    renderGrid({ purchasesEnabled: false })
    expect(screen.getByText('plan.grid.introClosed')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/\$199/)).toBeNull()
  })

  it('at eight marked, no more can be added; read-only users cannot mark', () => {
    const many = Array.from({ length: 9 }, (_, index) => entry(`FEATURE_${index}`, 'sell', 'PRO', 'NONE', 99))
    const { rerender } = render(
      <FeatureGrid
        entries={many}
        purchasesEnabled
        mode="ADD"
        marked={many.slice(0, 8).map(item => item.id)}
        isMarkable={item => isMarkable(item, 'ADD')}
        onToggle={vi.fn()}
        onPickTier={vi.fn()}
        canManage
        target="FREE"
      />,
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(8)
    expect(screen.getByText('plan.grid.maxOffers')).toBeInTheDocument()
    rerender(
      <FeatureGrid
        entries={[...many, entry('COMMISSIONS', 'team', 'PREMIUM', 'NONE', null)]}
        purchasesEnabled
        mode="ADD"
        marked={[]}
        isMarkable={item => isMarkable(item, 'ADD')}
        onToggle={vi.fn()}
        onPickTier={vi.fn()}
        canManage={false}
        target="FREE"
      />,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /pickTier/ })).toBeNull()
  })

  it('going to Gratis, only what the plan gives today can be kept', () => {
    renderGrid({
      entries: [...ENTRIES, entry('PROMOTIONS', 'customers', 'PRO', 'PLAN', 149)],
      mode: 'DROP',
      isMarkable: item => isMarkable(item, 'DROP'),
    })
    expect(screen.getByText('plan.grid.introDrop')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'plan.grid.mark|name=n-PROMOTIONS' })).toBeInTheDocument()
    expect(screen.getByText(/\$149/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'plan.grid.mark|name=n-LOYALTY_PROGRAM' })).toBeNull()
  })
})
