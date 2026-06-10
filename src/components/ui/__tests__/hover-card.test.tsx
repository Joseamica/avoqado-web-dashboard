import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

// The global setup mocks ResizeObserver with a vi.fn(), but the suite runs with
// `mockReset: true`, which wipes that mock's implementation before each test —
// leaving floating-ui (Radix Popper) with an observer that has no `.observe`.
// Install a plain class so it survives mock resets.
beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = RO as unknown as typeof ResizeObserver
})

/**
 * Regression test for the settlement-calendar "saldo disponible" hover bug:
 * the hover card lived inside a GlassCard with `position: relative` +
 * `overflow-hidden`. Because HoverCardContent was NOT portalled, the floating
 * content rendered as a descendant of that clipping container and got cut off
 * when it popped above the day cell — the header/labels were invisible.
 *
 * The fix portals HoverCardContent (like popover.tsx / tooltip.tsx). This test
 * proves the content escapes an `overflow-hidden` ancestor by rendering to
 * document.body instead of inside the clipping container.
 */
describe('HoverCardContent', () => {
  it('renders its content in a portal, outside an overflow-hidden ancestor', () => {
    render(
      <div data-testid="clip-container" className="relative overflow-hidden">
        <HoverCard open>
          <HoverCardTrigger>trigger</HoverCardTrigger>
          <HoverCardContent>
            <span data-testid="hover-body">Monto neto a depositar</span>
          </HoverCardContent>
        </HoverCard>
      </div>,
    )

    const body = screen.getByTestId('hover-body')
    const clipContainer = screen.getByTestId('clip-container')

    // The content must render (open hover card)...
    expect(body).toBeInTheDocument()
    // ...but it must NOT be trapped inside the overflow-hidden clipping container.
    // If HoverCardContent regresses to a non-portalled render, this fails.
    expect(clipContainer).not.toContainElement(body)
  })
})
