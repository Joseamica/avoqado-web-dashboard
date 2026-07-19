import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelBadge } from './ChannelBadge'

describe('ChannelBadge', () => {
  it('renders "Uber Eats" for source=UBER_EATS', () => {
    render(<ChannelBadge source="UBER_EATS" />)
    expect(screen.getByText('Uber Eats')).toBeDefined()
  })

  it('renders "Rappi" for source=RAPPI', () => {
    render(<ChannelBadge source="RAPPI" />)
    expect(screen.getByText('Rappi')).toBeDefined()
  })

  it('renders "DiDi Food" for source=DIDI_FOOD', () => {
    render(<ChannelBadge source="DIDI_FOOD" />)
    expect(screen.getByText('DiDi Food')).toBeDefined()
  })

  it('renders "Delivery" for source=DELIVERY_PLATFORM', () => {
    render(<ChannelBadge source="DELIVERY_PLATFORM" />)
    expect(screen.getByText('Delivery')).toBeDefined()
  })

  it('renders nothing for a non-delivery source (e.g. TPV) — must not break normal rows', () => {
    const { container } = render(<ChannelBadge source="TPV" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when source is undefined', () => {
    const { container } = render(<ChannelBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when source is null', () => {
    const { container } = render(<ChannelBadge source={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
