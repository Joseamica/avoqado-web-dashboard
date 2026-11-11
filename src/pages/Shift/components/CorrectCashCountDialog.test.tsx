import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}))
const h = vi.hoisted(() => ({ impl: (..._a: unknown[]): Promise<unknown> => Promise.resolve({ data: {} }), calls: [] as unknown[][] }))
vi.mock('@/api', () => ({
  default: {
    post: (...a: unknown[]) => {
      h.calls.push(a)
      return h.impl(...a)
    },
  },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { CorrectCashCountDialog, differenceAfterCorrection } from './CorrectCashCountDialog'

function setup(props: Partial<React.ComponentProps<typeof CorrectCashCountDialog>> = {}) {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CorrectCashCountDialog
        open
        onOpenChange={onOpenChange}
        venueId="v1"
        shiftId="s1"
        countedCash={20000}
        cashDifference={18000}
        expectedAmount={2000}
        correctionCount={0}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onOpenChange }
}

const amount = () => screen.getByLabelText('detail.correctCount.amount')
const reason = () => screen.getByLabelText('detail.correctCount.reason')
const save = () => screen.getByRole('button', { name: 'detail.correctCount.save' })

describe('differenceAfterCorrection', () => {
  it('uses integer cents', () => {
    expect(differenceAfterCorrection(1000.3, 1000.1)).toBe(-0.2)
    expect(differenceAfterCorrection(2099.9999999999995, 2100)).toBe(0)
    expect(differenceAfterCorrection(2000, 2000)).toBe(0)
  })
})

describe('CorrectCashCountDialog', () => {
  beforeEach(() => {
    h.calls.length = 0
    h.impl = () => Promise.resolve({ data: {} })
  })

  it('previews over -> balanced', () => {
    setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    const text = document.body.textContent ?? ''
    expect(text).toContain('detail.correctCount.preview')
    expect(text).toContain('detail.correctCount.over')
    expect(text).toContain('detail.correctCount.balanced')
  })

  it('disables save for a blank reason', () => {
    setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: '   ' } })
    expect(save()).toBeDisabled()
  })

  it('disables save and hints when the amount is unchanged', () => {
    setup()
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    expect(save()).toBeDisabled()
    expect(screen.getByText('detail.correctCount.sameAmount')).toBeInTheDocument()
  })

  it('posts once on a double click', async () => {
    setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    act(() => {
      save().click()
      save().click()
    })
    await waitFor(() => expect(h.calls).toHaveLength(1))
    expect(h.calls[0]).toEqual([
      '/api/v1/dashboard/venues/v1/shifts/s1/cash-count-correction',
      {
        countedCash: 2000,
        reason: 'error de dedo',
        expectedCurrentCount: 20000,
        expectedResultingDifference: 0,
        expectedCorrectionCount: 0,
      },
    ])
  })

  it('shows the changed message on CASH_COUNT_CHANGED and stays open', async () => {
    h.impl = () =>
      Promise.reject(Object.assign(new Error('409'), { response: { status: 409, data: { code: 'CASH_COUNT_CHANGED', message: 'x' } } }))
    const { onOpenChange } = setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    fireEvent.click(save())
    expect(await screen.findByText('detail.correctCount.changed')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
