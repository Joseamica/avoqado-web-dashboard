import React, { createContext, useContext } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import TierRewardEditor from '../TierRewardEditor'
import type { TierReward } from '@/types/referrals'

// ─── i18n: echo key (+ interpolated values) — repo convention (see
// TierRewardSummary.test.tsx / CancelPlanDialog.test.tsx) ────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
  }),
}))

// ─── toast ────────────────────────────────────────────────────────────────
const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

// ─── product catalog ────────────────────────────────────────────────────────
const mockGetProducts = vi.fn()
vi.mock('@/services/menu.service', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
}))

// ─── referrals service ──────────────────────────────────────────────────────
const mockUpdateConfig = vi.fn()
vi.mock('@/services/referrals.service', () => ({
  default: { updateConfig: (...args: unknown[]) => mockUpdateConfig(...args) },
}))

// ─── TanStack Query: real enough to exercise mutationFn + track calls ───────
const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn }: { queryFn: () => unknown }) => ({ data: queryFn(), isLoading: false }),
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    mutate: (args: unknown) => {
      Promise.resolve()
        .then(() => mutationFn(args))
        .then(onSuccess)
        .catch(onError)
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

// ─── Select stub — real Radix Select is painful in jsdom (pointer capture);
// mirror OrgStaffAccessStep.test.tsx's pattern but wire onValueChange through
// a context so SelectItem can act as a clickable option. ────────────────────
const SelectCtx = createContext<{ onValueChange?: (v: string) => void }>({})
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <SelectCtx.Provider value={{ onValueChange }}>
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    </SelectCtx.Provider>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, disabled, children }: any) => {
    const { onValueChange } = useContext(SelectCtx)
    return (
      <button type="button" disabled={disabled} onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    )
  },
}))

// ─── Search combobox stub — expose a clickable "pick" button per item ──────
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect }: { items: { id: string; label: string }[]; onSelect: (item: any) => void }) => (
    <div data-testid="product-picker">
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => onSelect(item)}>
          pick:{item.label}
        </button>
      ))}
    </div>
  ),
}))

function makeReward(overrides: Partial<TierReward> = {}): TierReward {
  return {
    id: 'reward-1',
    configId: 'config-1',
    tierLevel: 2,
    rewardType: 'PERCENT_COUPON',
    recurrence: 'ONE_TIME',
    rewardPercent: '20.00',
    rewardProductId: null,
    rewardQuantity: 1,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const defaultProps = {
  venueId: 'venue-1',
  tierLevel: 2 as const,
  initialReferralsRequired: 12,
  initialRewards: [makeReward()],
  minReferralsRequired: 7,
  maxReferralsRequired: 20,
  onClose: vi.fn(),
}

describe('TierRewardEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProducts.mockReturnValue([
      { id: 'prod-1', name: 'Sesión Iyashi', price: 500 },
      { id: 'prod-2', name: 'Botella de agua', price: 0 },
    ])
    mockUpdateConfig.mockResolvedValue({ ok: true })
  })

  it('renders the 3 reward types, with PERMANENT_DISCOUNT disabled and its terminal-upgrade note', () => {
    render(<TierRewardEditor {...defaultProps} />)

    const coupon = screen.getByText('editor.rewardTypeCoupon')
    const permanent = screen.getByText('editor.rewardTypePermanent')
    const freeProduct = screen.getByText('editor.rewardTypeFreeProduct')
    expect(coupon).toBeInTheDocument()
    expect(permanent).toBeInTheDocument()
    expect(freeProduct).toBeInTheDocument()

    expect(screen.getByText('editor.rewardTypePermanentNote')).toBeInTheDocument()
    expect(permanent.closest('button')).toBeDisabled()
    expect(coupon.closest('button')).not.toBeDisabled()
  })

  it('defaults to PERCENT_COUPON with the percent field visible, seeded from initialRewards', () => {
    render(<TierRewardEditor {...defaultProps} />)

    expect(screen.getByText('activate.tierRewardPercent')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.queryByText('editor.rewardProduct')).not.toBeInTheDocument()
  })

  it('switches to FREE_PRODUCT conditional fields when the type is changed', () => {
    render(<TierRewardEditor {...defaultProps} />)

    fireEvent.click(screen.getByText('editor.rewardTypeFreeProduct'))

    expect(screen.queryByText('activate.tierRewardPercent')).not.toBeInTheDocument()
    expect(screen.getByText('editor.rewardProduct')).toBeInTheDocument()
    expect(screen.getByText('editor.rewardQuantity')).toBeInTheDocument()
    expect(screen.getByText('editor.rewardRecurrence')).toBeInTheDocument()
    expect(screen.getByText('editor.rewardManualHint')).toBeInTheDocument()
  })

  it('adds and removes reward rows', () => {
    render(<TierRewardEditor {...defaultProps} />)

    expect(screen.getAllByText('editor.rewardType')).toHaveLength(1)

    fireEvent.click(screen.getByText('editor.addReward'))
    expect(screen.getAllByText('editor.rewardType')).toHaveLength(2)
    expect(screen.getByText('editor.rewardIndex(index=2)')).toBeInTheDocument()

    // Remove buttons only render once there's more than 1 row.
    const removeButtons = document.querySelectorAll('button svg.lucide-trash2')
    expect(removeButtons.length).toBe(2)
    fireEvent.click(removeButtons[1].closest('button')!)

    expect(screen.getAllByText('editor.rewardType')).toHaveLength(1)
  })

  it('saves a single PERCENT_COUPON reward with the correct tiers payload, scoped to this tier level only', async () => {
    render(<TierRewardEditor {...defaultProps} />)

    fireEvent.click(screen.getByText('editor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', {
      tier2ReferralsRequired: 12,
      tiers: [{ tierLevel: 2, rewardType: 'PERCENT_COUPON', recurrence: 'ONE_TIME', rewardPercent: 20 }],
    })

    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled())
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['referrals-config', 'venue-1'] })
  })

  it('saves a FREE_PRODUCT reward with product/quantity/recurrence in the payload', async () => {
    render(<TierRewardEditor {...defaultProps} initialRewards={[]} legacyRewardPercent={undefined} />)

    fireEvent.click(screen.getByText('editor.rewardTypeFreeProduct'))
    fireEvent.click(screen.getByText('pick:Sesión Iyashi'))
    fireEvent.click(screen.getByText('editor.recurrenceMonthly'))

    fireEvent.click(screen.getByText('editor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', {
      tier2ReferralsRequired: 12,
      tiers: [
        {
          tierLevel: 2,
          rewardType: 'FREE_PRODUCT',
          recurrence: 'MONTHLY',
          rewardProductId: 'prod-1',
          rewardQuantity: 1,
        },
      ],
    })
  })

  it('blocks save and shows an inline error when the percent is out of range', () => {
    render(<TierRewardEditor {...defaultProps} />)

    fireEvent.change(screen.getByDisplayValue('20'), { target: { value: '150' } })
    fireEvent.click(screen.getByText('editor.save'))

    expect(screen.getByText('editor.errors.percentInvalid')).toBeInTheDocument()
    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('blocks save when FREE_PRODUCT has no product selected', () => {
    render(<TierRewardEditor {...defaultProps} initialRewards={[]} />)

    fireEvent.click(screen.getByText('editor.rewardTypeFreeProduct'))
    fireEvent.click(screen.getByText('editor.save'))

    expect(screen.getByText('editor.errors.productRequired')).toBeInTheDocument()
    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('blocks save when the threshold is not strictly ascending vs. the neighboring tiers', () => {
    render(<TierRewardEditor {...defaultProps} />)

    const referralsInput = screen.getByDisplayValue('12')
    fireEvent.change(referralsInput, { target: { value: '5' } }) // <= minReferralsRequired (7)
    fireEvent.click(screen.getByText('editor.save'))

    expect(screen.getByText('editor.errors.thresholdTooLow(min=7)')).toBeInTheDocument()
    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('seeds a default PERCENT_COUPON row from legacyRewardPercent when initialRewards is empty (legacy venue)', () => {
    render(<TierRewardEditor {...defaultProps} initialRewards={[]} legacyRewardPercent={25} />)

    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
  })

  it('surfaces the backend error message and does not close the dialog on failure', async () => {
    mockUpdateConfig.mockRejectedValue({ response: { data: { message: 'PORCENTAJE_INVALIDO' } } })

    render(<TierRewardEditor {...defaultProps} />)
    fireEvent.click(screen.getByText('editor.save'))

    await waitFor(() => expect(screen.getByText('PORCENTAJE_INVALIDO')).toBeInTheDocument())
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })
})
