import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPut = vi.fn()
const mockToast = vi.fn()
const mockCan = vi.fn()
const mockTierAccess = vi.fn()

vi.mock('@/api', () => ({ default: { put: (...args: unknown[]) => mockPut(...args) } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => mockTierAccess(),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { CashReconciliationSetting } from './CashReconciliationSetting'

function renderSetting(storedSetting = false) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CashReconciliationSetting venueId="venue-1" storedSetting={storedSetting} />
    </QueryClientProvider>,
  )
  return { ...view, invalidateSpy }
}

describe('CashReconciliationSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockImplementation((permission: string) => permission === 'venues:update')
    mockTierAccess.mockReturnValue({
      hasAccess: true,
      isResolved: true,
      isLoading: false,
      requiredTier: 'PRO',
    })
    mockPut.mockResolvedValue({ data: { cashReconciliationEnabled: true } })
  })

  it('enables only after a positively resolved PRO entitlement and sends the exact boolean payload', async () => {
    const { invalidateSpy } = renderSetting(false)

    fireEvent.click(screen.getByRole('switch', { name: 'edit.cashReconciliation.switchLabel' }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', {
        cashReconciliationEnabled: true,
      }),
    )
    expect(screen.getByRole('switch')).toBeChecked()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['get-venue-data', 'venue-1'] })
  })

  it('does not render while the tier signal is unresolved and no stored opt-in exists', () => {
    mockTierAccess.mockReturnValue({
      hasAccess: true,
      isResolved: false,
      isLoading: false,
      requiredTier: 'PRO',
    })
    const { container } = renderSetting(false)

    expect(container).toBeEmptyDOMElement()
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('keeps a downgraded stored opt-in visible and lets an authorized user turn it off', async () => {
    mockTierAccess.mockReturnValue({
      hasAccess: false,
      isResolved: true,
      isLoading: false,
      requiredTier: 'PRO',
    })
    renderSetting(true)

    expect(screen.getByText('edit.cashReconciliation.downgraded')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'edit.cashReconciliation.switchLabel' }))

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', {
        cashReconciliationEnabled: false,
      }),
    )
  })

  it('restores the server state when the update fails', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 503 } })
    renderSetting(false)

    fireEvent.click(screen.getByRole('switch', { name: 'edit.cashReconciliation.switchLabel' }))

    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked())
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    )
  })

  it('does not render for a venue without entitlement or a stored opt-in', () => {
    mockTierAccess.mockReturnValue({
      hasAccess: false,
      isResolved: true,
      isLoading: false,
      requiredTier: 'PRO',
    })
    const { container } = renderSetting(false)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders read-only without venues:update permission', () => {
    mockCan.mockReturnValue(false)
    renderSetting(false)

    expect(screen.getByRole('switch', { name: 'edit.cashReconciliation.switchLabel' })).toBeDisabled()
  })
})
