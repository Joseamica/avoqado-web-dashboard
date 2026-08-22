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

  it('choice mode: the picked tier reads as selected, never as the disabled owned-plan CTA', () => {
    render(<PlanPicker currentTier="PRO" onSelectTier={() => {}} selectionMode="choice" />)
    expect(screen.getByText('plan.cta.selected')).toBeInTheDocument()
    expect(screen.queryByText('plan.cta.current')).not.toBeInTheDocument()
  })

  it('choice mode: the picked tier CTA is live and re-fires onSelectTier', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    fireEvent.click(screen.getByText('plan.cta.selected'))
    expect(onSelect).toHaveBeenCalledWith('PRO', 'monthly')
  })

  it('choice mode: unpicked tiers offer "choose", not upgrade/downgrade wording', () => {
    const onSelect = vi.fn()
    render(<PlanPicker currentTier="PRO" onSelectTier={onSelect} selectionMode="choice" />)
    expect(screen.queryByText(/plan\.cta\.(upgrade|downgrade)/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('plan.cta.choose:plan.tiers.free.name'))
    expect(onSelect).toHaveBeenCalledWith('FREE', 'monthly')
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
})
