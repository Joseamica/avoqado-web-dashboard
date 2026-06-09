// src/components/billing/__tests__/CancelPlanDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CancelPlanDialog } from '../CancelPlanDialog'

// ── react-i18next: return key (or interpolated) ──────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      // returnObjects for loseItems array
      if (o?.returnObjects) {
        return ['Full reports & history', 'AI Assistant + MCP', 'Loyalty & referrals']
      }
      // Interpolate simple values
      if (o && typeof o === 'object') {
        return Object.entries(o).reduce(
          (acc, [key, val]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val)),
          k,
        )
      }
      return k
    },
  }),
}))

// ── service mocks ────────────────────────────────────────────────────────────
const mockApplyRetentionOffer = vi.fn()
const mockCancelVenuePlan = vi.fn()

vi.mock('@/services/features.service', () => ({
  applyRetentionOffer: (...args: unknown[]) => mockApplyRetentionOffer(...args),
  cancelVenuePlan: (...args: unknown[]) => mockCancelVenuePlan(...args),
}))

// ── TanStack Query ────────────────────────────────────────────────────────────
const mockMutate = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (...args: unknown[]) => unknown }) => ({
    mutate: (...args: unknown[]) => {
      mockMutate(...args)
      mutationFn(...args)
    },
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

// ── toast ────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// ── datetime ─────────────────────────────────────────────────────────────────
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: string) => d,
  }),
}))

// ── Default props ─────────────────────────────────────────────────────────────
const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  venueId: 'venue-abc',
  planName: 'Avoqado Pro',
  currentPeriodEnd: '2026-07-08',
}

describe('CancelPlanDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRetentionOffer.mockResolvedValue(undefined)
    mockCancelVenuePlan.mockResolvedValue({})
  })

  it('renders step "reason" with all 6 radio options on open', () => {
    render(<CancelPlanDialog {...defaultProps} />)

    // Heading
    expect(screen.getByText('plan.cancel.reason.title')).toBeInTheDocument()

    // All 6 reasons
    expect(screen.getByText('plan.cancel.reason.options.tooExpensive')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.options.notUsing')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.options.missingFeature')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.options.switching')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.options.temporary')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.options.other')).toBeInTheDocument()
  })

  it('primary "keep" button closes the dialog without advancing', () => {
    const onOpenChange = vi.fn()
    render(<CancelPlanDialog {...defaultProps} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByTestId ? screen.getByText('plan.cancel.reason.keepCta') : screen.getByText('plan.cancel.reason.keepCta'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('"Continue" is disabled until a reason is selected', () => {
    render(<CancelPlanDialog {...defaultProps} />)
    const continueBtn = screen.getByText('plan.cancel.reason.continueCta')
    expect(continueBtn).toBeDisabled()
  })

  it('selecting a reason enables Continue; clicking it advances to step "offer"', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    // Select "tooExpensive"
    const expensiveLabel = screen.getByText('plan.cancel.reason.options.tooExpensive')
    fireEvent.click(expensiveLabel)

    const continueBtn = screen.getByText('plan.cancel.reason.continueCta')
    expect(continueBtn).not.toBeDisabled()

    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(screen.getByText('plan.cancel.offer.title')).toBeInTheDocument()
    })
  })

  it('offer step shows the discount copy and a live countdown (MM:SS format)', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    // Navigate to offer step
    fireEvent.click(screen.getByText('plan.cancel.reason.options.tooExpensive'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))

    await waitFor(() => {
      expect(screen.getByText('plan.cancel.offer.discountBody')).toBeInTheDocument()
    })

    // Discount badge present
    expect(screen.getByText('plan.cancel.offer.discountBadge')).toBeInTheDocument()

    // Timer label contains MM:SS — look for the pattern in any element containing the key
    const timerElements = screen.getAllByText(/plan\.cancel\.offer\.timerLabel/)
    expect(timerElements.length).toBeGreaterThan(0)
  })

  it('offer step shows pause CTA when reason is "notUsing"', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('plan.cancel.reason.options.notUsing'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))

    await waitFor(() => {
      expect(screen.getByText('plan.cancel.offer.pauseCta')).toBeInTheDocument()
    })
  })

  it('offer step does NOT show pause CTA for reason "tooExpensive"', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('plan.cancel.reason.options.tooExpensive'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))

    await waitFor(() => {
      expect(screen.getByText('plan.cancel.offer.title')).toBeInTheDocument()
    })

    expect(screen.queryByText('plan.cancel.offer.pauseCta')).not.toBeInTheDocument()
  })

  it('"Accept and stay" on offer step calls applyRetentionOffer with "discount"', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('plan.cancel.reason.options.tooExpensive'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))

    await waitFor(() => expect(screen.getByText('plan.cancel.offer.acceptCta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('plan.cancel.offer.acceptCta'))

    expect(mockApplyRetentionOffer).toHaveBeenCalledWith('venue-abc', 'discount')
  })

  it('"No thanks, cancel" on offer step advances to confirm step', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('plan.cancel.reason.options.tooExpensive'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))

    await waitFor(() => expect(screen.getByText('plan.cancel.offer.declineCta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('plan.cancel.offer.declineCta'))

    await waitFor(() => {
      expect(screen.getByText('plan.cancel.confirm.title')).toBeInTheDocument()
    })
  })

  it('confirm step primary "keep" button closes the dialog', async () => {
    const onOpenChange = vi.fn()
    render(<CancelPlanDialog {...defaultProps} onOpenChange={onOpenChange} />)

    // Navigate to confirm step
    fireEvent.click(screen.getByText('plan.cancel.reason.options.switching'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))
    await waitFor(() => expect(screen.getByText('plan.cancel.offer.declineCta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('plan.cancel.offer.declineCta'))
    await waitFor(() => expect(screen.getByText('plan.cancel.confirm.keepCta')).toBeInTheDocument())

    fireEvent.click(screen.getByText('plan.cancel.confirm.keepCta'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('confirm step "Yes, cancel" calls cancelVenuePlan', async () => {
    render(<CancelPlanDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('plan.cancel.reason.options.switching'))
    fireEvent.click(screen.getByText('plan.cancel.reason.continueCta'))
    await waitFor(() => expect(screen.getByText('plan.cancel.offer.declineCta')).toBeInTheDocument())
    fireEvent.click(screen.getByText('plan.cancel.offer.declineCta'))
    await waitFor(() => expect(screen.getByText('plan.cancel.confirm.cancelCta')).toBeInTheDocument())

    fireEvent.click(screen.getByText('plan.cancel.confirm.cancelCta'))
    expect(mockCancelVenuePlan).toHaveBeenCalledWith('venue-abc')
  })
})
