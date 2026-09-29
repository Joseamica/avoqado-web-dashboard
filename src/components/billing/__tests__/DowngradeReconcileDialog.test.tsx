// src/components/billing/__tests__/DowngradeReconcileDialog.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DowngradeReconcileDialog } from '../DowngradeReconcileDialog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params: Record<string, unknown> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => `${text}|${name}=${value}`, key),
  }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (value: string) => value.slice(0, 10) }) }))
const phone = { value: false }
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => phone.value }))

const preview = {
  required: true,
  cap: 2,
  currentActive: 3,
  keepMax: 2,
  staff: [
    { staffVenueId: 'sv-owner', staffId: 's1', name: 'Olivia', email: 'o@x.com', role: 'OWNER', isOwner: true, lastActiveAt: null },
    { staffVenueId: 'sv-ana', staffId: 's2', name: 'Ana', email: 'a@x.com', role: 'MANAGER', isOwner: false, lastActiveAt: null },
    { staffVenueId: 'sv-beto', staffId: 's3', name: 'Beto', email: 'b@x.com', role: 'WAITER', isOwner: false, lastActiveAt: null },
  ],
}
const onConfirm = vi.fn()
const onSkip = vi.fn()

beforeEach(() => {
  onConfirm.mockReset()
  onSkip.mockReset()
  phone.value = false
})

describe('DowngradeReconcileDialog', () => {
  it('starts with the owner locked in and confirms the chosen ids', async () => {
    render(
      <DowngradeReconcileDialog
        open
        onClose={vi.fn()}
        preview={preview}
        currentPeriodEnd="2026-10-27T00:00:00.000Z"
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByText('plan.downgrade.counter|selected=1|keepMax=2')).toBeInTheDocument()
    expect(document.querySelector('[data-tour="downgrade-staff-sv-owner"]')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(document.querySelector('[data-tour="downgrade-staff-sv-ana"]')!)
    expect(document.querySelector('[data-tour="downgrade-staff-sv-beto"]')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(document.querySelector('[data-tour="downgrade-confirm"]')!)
    expect(onConfirm).toHaveBeenCalledWith(['sv-owner', 'sv-ana'])
  })

  it('before paying a replacement it can be skipped, and says what the button does', async () => {
    render(
      <DowngradeReconcileDialog
        open
        onClose={vi.fn()}
        preview={preview}
        onConfirm={onConfirm}
        confirmLabel="Continuar al pago"
        onSkip={onSkip}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeInTheDocument()
    await userEvent.click(document.querySelector('[data-tour="downgrade-skip"]')!)
    expect(onSkip).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('before paying a replacement it says the others stop when the payment is confirmed, not at period end', () => {
    // Live test 2026-09-29: the hybrid drop deactivated the others right after payment, while the text said
    // «cuando termine tu periodo pagado».
    render(<DowngradeReconcileDialog open onClose={vi.fn()} preview={preview} onConfirm={onConfirm} onSkip={onSkip} />)
    expect(screen.getByText('plan.downgrade.explainBodyNow|cap=2|currentActive=3')).toBeInTheDocument()
    expect(screen.queryByText(/plan\.downgrade\.explainBody\|/)).toBeNull()
  })

  it('the classic downgrade has no skip', () => {
    render(<DowngradeReconcileDialog open onClose={vi.fn()} preview={preview} onConfirm={onConfirm} />)
    expect(document.querySelector('[data-tour="downgrade-skip"]')).toBeNull()
  })

  it('on a phone the buttons go to a bar at the bottom, so the header title stays readable', async () => {
    phone.value = true
    render(
      <DowngradeReconcileDialog
        open
        onClose={vi.fn()}
        preview={preview}
        onConfirm={onConfirm}
        confirmLabel="Continuar al pago"
        onSkip={onSkip}
      />,
    )
    const confirm = document.querySelector('[data-tour="downgrade-confirm"]')!
    expect(confirm.closest('header')).toBeNull()
    expect(confirm.closest('[data-tour="downgrade-actions-bar"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="downgrade-skip"]')!.closest('header')).toBeNull()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith(['sv-owner'])
  })

  it('on a computer the buttons stay in the header', () => {
    render(<DowngradeReconcileDialog open onClose={vi.fn()} preview={preview} onConfirm={onConfirm} />)
    expect(document.querySelector('[data-tour="downgrade-confirm"]')!.closest('header')).not.toBeNull()
    expect(document.querySelector('[data-tour="downgrade-actions-bar"]')).toBeNull()
  })
})
