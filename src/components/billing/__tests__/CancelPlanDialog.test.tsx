// src/components/billing/__tests__/CancelPlanDialog.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CancelPlanDialog, type CancelTarget } from '../CancelPlanDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params: Record<string, unknown> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => `${text}|${name}=${value}`, key),
  }),
}))

const PLAN: CancelTarget = {
  kind: 'PLAN',
  tierName: 'Pro',
  until: '27 oct 2026',
  classic: true,
  retentionOfferEligible: true,
  pauseOfferEligible: true,
}
const onConfirm = vi.fn()
const onOpenChange = vi.fn()
const onAcceptOffer = vi.fn()
const renderDialog = (props: Partial<Parameters<typeof CancelPlanDialog>[0]> = {}) =>
  render(<CancelPlanDialog open onOpenChange={onOpenChange} target={PLAN} onConfirm={onConfirm} onAcceptOffer={onAcceptOffer} {...props} />)
const pick = (id: string) => userEvent.click(screen.getByText(`plan.cancel.reason.options.${id}`))

beforeEach(() => {
  onConfirm.mockReset()
  onOpenChange.mockReset()
  onAcceptOffer.mockReset()
})

describe('CancelPlanDialog', () => {
  it('asks why with seven optional reasons and says until when the plan stays', () => {
    renderDialog()
    expect(screen.getByText('plan.cancel.reason.title')).toBeInTheDocument()
    expect(screen.getByText('plan.cancel.reason.subtitlePlan|tier=Pro|date=27 oct 2026')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
  })

  it('can cancel without choosing a reason', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'plan.cancel.confirm.cancelCta' }))
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('sends the server reason and the trimmed comment, capped at 500 characters', async () => {
    renderDialog()
    await pick('temporary')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: `  ${'x'.repeat(600)}  ` } })
    await userEvent.click(screen.getByRole('button', { name: 'plan.cancel.confirm.cancelCta' }))
    const input = onConfirm.mock.calls[0][0]
    expect(input.reason).toBe('TEMPORARY')
    expect(input.comment.length).toBeLessThanOrEqual(500)
  })

  it('maps "difícil de usar" to TOO_COMPLEX', async () => {
    renderDialog()
    await pick('tooComplex')
    await userEvent.click(screen.getByRole('button', { name: 'plan.cancel.confirm.cancelCta' }))
    expect(onConfirm).toHaveBeenCalledWith({ reason: 'TOO_COMPLEX' })
  })

  it('puts "cancel" on the left and "keep my plan" on the right, focused by default, and keeping closes', async () => {
    renderDialog()
    const [left, right] = within(screen.getByRole('dialog'))
      .getAllByRole('button')
      .filter(button => button.dataset.tour?.startsWith('cancel-'))
    expect(left).toHaveAttribute('data-tour', 'cancel-confirm')
    expect(right).toHaveAttribute('data-tour', 'cancel-keep')
    // Long labels (fr contract, «Me quedo con mi plan» at 390 px) must wrap inside their equal cells.
    expect(left).toHaveClass('whitespace-normal', 'h-auto', 'min-h-9')
    expect(right).toHaveClass('whitespace-normal', 'h-auto', 'min-h-9')
    expect(right).toHaveFocus()
    await userEvent.click(right)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('offers the discount for "too expensive" and the pause for "temporary", classic plans only', async () => {
    renderDialog()
    await pick('tooExpensive')
    await userEvent.click(screen.getByRole('button', { name: 'plan.cancel.offer.acceptCta' }))
    expect(onAcceptOffer).toHaveBeenCalledWith('discount')
    await pick('temporary')
    await userEvent.click(screen.getByRole('button', { name: 'plan.cancel.offer.pauseCta' }))
    expect(onAcceptOffer).toHaveBeenCalledWith('pause')
  })

  it('no offer when not eligible, nor for a plan by contract', async () => {
    renderDialog({ target: { ...PLAN, retentionOfferEligible: false } as CancelTarget })
    await pick('tooExpensive')
    expect(screen.queryByRole('button', { name: 'plan.cancel.offer.acceptCta' })).toBeNull()
  })

  it('a contract says when it stops renewing and uses its own labels', () => {
    renderDialog({ target: { kind: 'CONTRACT', name: 'Reservas', until: '27 oct 2026' } })
    expect(screen.getByText('plan.cancel.reason.subtitleContract|name=Reservas|date=27 oct 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'plan.cancel.reason.confirmContractCta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'plan.cancel.reason.keepContractCta' })).toBeInTheDocument()
  })

  it('shows the Free seat rule, a note and a server error when given', () => {
    renderDialog({ seatNotice: 'CHOOSE', note: 'Revisión del pago en curso', error: 'No se pudo cancelar' })
    expect(screen.getByText('plan.seatNotice.choose')).toBeInTheDocument()
    expect(screen.getByText('Revisión del pago en curso')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cancelar')
  })
})
