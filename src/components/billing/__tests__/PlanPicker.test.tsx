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
})
