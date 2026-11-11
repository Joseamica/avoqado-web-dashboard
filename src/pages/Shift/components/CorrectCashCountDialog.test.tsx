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

type DialogProps = Partial<React.ComponentProps<typeof CorrectCashCountDialog>>

function setup(props: DialogProps = {}) {
  const onOpenChange = vi.fn()
  const client = new QueryClient()
  const ui = (p: DialogProps) => (
    <QueryClientProvider client={client}>
      <CorrectCashCountDialog
        open
        onOpenChange={onOpenChange}
        venueId="v1"
        shiftId="s1"
        countedCash={20000}
        cashDifference={18000}
        expectedAmount={2000}
        correctionCount={0}
        {...p}
      />
    </QueryClientProvider>
  )
  const { rerender } = render(ui(props))
  return { onOpenChange, rerender: (p: DialogProps) => rerender(ui({ ...props, ...p })) }
}

const rejectWith =
  (code: string, message = 'mensaje del servidor') =>
  () =>
    Promise.reject(Object.assign(new Error('409'), { response: { status: 409, data: { code, message } } }))

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

  it('🔴 keeps what the manager saw when the detail refetches underneath (another manager corrected)', async () => {
    const { rerender } = setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    // El detalle se recarga (foco de la ventana, socket, cobro): otro gerente ya dejó el corte en $2,000.
    rerender({ countedCash: 2000, cashDifference: 0, expectedAmount: 2000, correctionCount: 1 })
    expect(document.body.textContent).toContain('detail.correctCount.over')

    fireEvent.click(save())
    await waitFor(() => expect(h.calls).toHaveLength(1))
    expect(h.calls[0][1]).toMatchObject({ expectedCurrentCount: 20000, expectedCorrectionCount: 0, expectedResultingDifference: 0 })
  })

  it('freezes the form and the close while saving', async () => {
    h.impl = () => new Promise(() => {})
    const { onOpenChange } = setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    fireEvent.click(save())
    await waitFor(() => expect(amount()).toBeDisabled())
    expect(reason()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'common:close' }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('disables save for a reason over 300 characters', () => {
    setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'a'.repeat(301) } })
    expect(save()).toBeDisabled()
    fireEvent.change(reason(), { target: { value: 'a'.repeat(300) } })
    expect(save()).toBeEnabled()
    expect(reason()).toHaveAttribute('maxLength', '300')
  })

  it.each([
    ['CASH_COUNT_NO_LINKED_DRAWER', 'detail.correctCount.blocked.NO_LINKED_DRAWER'],
    ['CASH_COUNT_TOO_MANY', 'detail.correctCount.blocked.TOO_MANY'],
    ['CASH_COUNT_INVALID_REASON', 'mensaje del servidor'],
  ])('a 409 %s shows %s', async (code, text) => {
    h.impl = rejectWith(code)
    setup()
    fireEvent.change(amount(), { target: { value: '2000' } })
    fireEvent.change(reason(), { target: { value: 'error de dedo' } })
    fireEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
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
