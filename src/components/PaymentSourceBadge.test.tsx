import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentSourceBadge } from './PaymentSourceBadge'

describe('PaymentSourceBadge', () => {
  it('renders a clean "Delivery" label for source=DELIVERY_PLATFORM (never the raw enum)', () => {
    render(<PaymentSourceBadge source="DELIVERY_PLATFORM" />)
    expect(screen.getByText('Delivery')).toBeDefined()
    // Must NOT leak the raw enum string as a pill.
    expect(screen.queryByText('DELIVERY_PLATFORM')).toBeNull()
  })

  // ── Regression: existing sources keep their labels ──
  it('still renders "TPV" for source=TPV', () => {
    render(<PaymentSourceBadge source="TPV" />)
    expect(screen.getByText('TPV')).toBeDefined()
  })

  it('still renders the free-text externalSource when source=OTHER', () => {
    render(<PaymentSourceBadge source="OTHER" externalSource="BUQ" />)
    expect(screen.getByText('BUQ')).toBeDefined()
  })
})
