// src/components/billing/__tests__/PlanPicker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanPicker } from '../PlanPicker'

// i18n returns the key (or interpolated) so assertions are deterministic
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.tier ? `${k}:${o.tier}` : o?.price ? `${k}:${o.price}` : k) }),
}))

describe('PlanPicker', () => {
  it('renders the 4 tier cards and marks the current one', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.tiers.free.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.pro.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.premium.name')).toBeInTheDocument()
    expect(screen.getByText('plan.tiers.enterprise.name')).toBeInTheDocument()
    expect(screen.getByText('plan.cta.current')).toBeInTheDocument()
  })

  it('fires onSelectTier when an upgrade CTA is clicked', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    fireEvent.click(screen.getByText('plan.cta.upgrade:plan.tiers.pro.name'))
    expect(onSelect).toHaveBeenCalledWith('PRO', 'monthly')
  })

  it('Premium is purchasable — fires onSelectTier, no coming-soon badge', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    expect(screen.queryByText('plan.comingSoon')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('plan.cta.upgrade:plan.tiers.premium.name'))
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('toggles monthly/annual pricing', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    fireEvent.click(screen.getByText('plan.billing.annual'))
    // Pro annual equiv ($9,990) should appear
    expect(screen.getByText(/9,990/)).toBeInTheDocument()
  })

  // Wizard integrations (SetupWizard PlanStep): controlled interval + per-tier promo note
  it('supports controlled interval — notifies parent and respects the prop', () => {
    const onIntervalChange = vi.fn()
    const { rerender } = render(
      <PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="monthly" onIntervalChange={onIntervalChange} />,
    )
    fireEvent.click(screen.getByText('plan.billing.annual'))
    expect(onIntervalChange).toHaveBeenCalledWith('annual')
    // parent controls the value: still monthly until the prop changes
    rerender(<PlanPicker currentTier="FREE" onSelectTier={() => {}} interval="annual" onIntervalChange={onIntervalChange} />)
    expect(screen.getByText(/9,990/)).toBeInTheDocument()
  })

  it('renders a promo note on the matching tier card', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} promoNotes={{ PRO: '3 meses a $599' }} />)
    expect(screen.getByText('3 meses a $599')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // selectionMode="choice" — wizards (SetupWizard PlanStep, ConversionWizard).
  // `currentTier` there means "the tier the user just PICKED", not "the plan they
  // already own", so the picked card must stay live. Regression: it used to render
  // the owned-plan CTA (disabled "Tu plan actual"), leaving the pre-selected PRO
  // card with a dead button and no way forward.
  // ---------------------------------------------------------------------------
  const card = (tier: string) => document.querySelector(`[data-tour="plan-card-${tier}"]`) as HTMLElement

  it('choice mode: the picked tier is marked on the card, never as the disabled owned-plan CTA', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(card('pro')).toHaveAttribute('aria-checked', 'true')
    expect(card('free')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText('plan.cta.current')).not.toBeInTheDocument()
  })

  it('choice mode: no per-card «Elegir/Seleccionado» buttons (the card is the control) and no upgrade wording', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(screen.queryByText('plan.cta.selected')).not.toBeInTheDocument()
    expect(screen.queryByText(/plan\.cta\.choose/)).not.toBeInTheDocument()
    expect(screen.queryByText(/plan\.cta\.(upgrade|downgrade)/)).not.toBeInTheDocument()
  })

  it('choice mode: Enterprise keeps its «Contactar ventas» action', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(screen.getAllByText('plan.cta.contact').find(el => el.closest('button'))!)
    expect(onSelect).toHaveBeenCalledWith('ENTERPRISE', 'monthly')
  })

  it('owned mode (Billing) keeps its per-card buttons', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('plan.cta.current')).toBeInTheDocument()
  })

  it('choice mode: clicking anywhere on a card selects it (no button required)', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(card('premium'))
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('choice mode: the card is keyboard-selectable (radio semantics)', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    const premium = card('premium')
    expect(premium).toHaveAttribute('role', 'radio')
    expect(card('pro')).toHaveAttribute('aria-checked', 'true')
    expect(premium).toHaveAttribute('aria-checked', 'false')
    fireEvent.keyDown(premium, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('PREMIUM', 'monthly')
  })

  it('owned mode (default): the card body is NOT clickable — only the CTA is', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="FREE" onSelectTier={onSelect} />)
    fireEvent.click(card('premium'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  // ── Precios del servidor, con IVA (alta: México muestra el precio YA con IVA) ──
  // 🔴 En el alta la tarjeta decía «$999 + IVA» junto a «3 meses a $694.84… IVA incluido»:
  // la misma tarjeta hablaba en dos idiomas de precio. Con la cotización del servidor se pinta
  // SU monto con IVA; sin ella (Facturación, conversión) todo queda como estaba.
  const PRECIOS = {
    PRO: { monthlyCents: 115884, annualCents: 1158840 },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840 },
  }

  it('con precios del servidor: el monto con IVA y la leyenda «IVA incluido», nunca «+ IVA»', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} preciosConIva={PRECIOS} />)
    expect(screen.getByText('$1,158.84')).toBeInTheDocument()
    expect(screen.getByText('$1,970.84')).toBeInTheDocument()
    // «/mes · IVA incluido» es UNA pieza (no se parte ni se sale de la tarjeta angosta).
    expect(screen.getAllByText('plan.perMonth · plan.ivaIncluded')).toHaveLength(2)
    expect(screen.queryByText(/plan\.plusIva/)).not.toBeInTheDocument()
    expect(screen.queryByText('$999')).not.toBeInTheDocument()
  })

  it('con precios del servidor en anual: el equivalente mensual y el total del año, con IVA', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} interval="annual" preciosConIva={PRECIOS} />)
    expect(screen.getByText('$965.70')).toBeInTheDocument() // 11,588.40 ÷ 12
    expect(screen.getByText('plan.annualEquiv:$11,588.40')).toBeInTheDocument()
  })

  it('sin precios del servidor (Facturación) sigue igual: «$999» y «+ IVA» (regresión)', () => {
    render(<PlanPicker currentTier="FREE" onSelectTier={() => {}} />)
    expect(screen.getByText('$999')).toBeInTheDocument()
    expect(screen.getAllByText('plan.perMonth · plan.plusIva').length).toBeGreaterThan(0)
  })
})
