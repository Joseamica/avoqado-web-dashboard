import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardSettingsView } from '@/types/giftCard'

const svc = vi.hoisted(() => ({
  getGiftCardSettings: vi.fn(),
  updateGiftCardSettings: vi.fn(),
  listGiftCards: vi.fn(),
  getGiftCardDetail: vi.fn(),
  operateGiftCard: vi.fn(),
  startGiftCardSaleCancel: vi.fn(),
  releaseGiftCardSaleCancel: vi.fn(),
  getGiftCardSummary: vi.fn(),
  getGiftCardAging: vi.fn(),
  listGiftCardPendingAccounting: vi.fn(),
  downloadGiftCardBalancesCsv: vi.fn(),
}))
vi.mock('@/services/giftCard.service', () => svc)
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { GiftCardRulesForm } from '../components/giftCards/GiftCardRulesForm'

const SETTINGS: GiftCardSettingsView = {
  enabled: true,
  suggestedAmounts: [500, 1000, 2000],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 69999.99,
  llavesConfiguradas: true,
  hasCards: true,
  updatedAt: '2026-10-14T15:00:00.000Z',
}

function renderForm(canManage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <GiftCardRulesForm venueId="v1" settings={SETTINGS} canManage={canManage} />
    </QueryClientProvider>,
  )
}
const guardar = () => screen.getByRole('button', { name: 'settings.rules.save' })

beforeEach(() => {
  vi.clearAllMocks()
  svc.updateGiftCardSettings.mockImplementation(async (_v: string, input: Record<string, unknown>) => ({ ...SETTINGS, ...input }))
})

describe('GiftCardRulesForm', () => {
  it('sin cambios no hay nada que guardar', () => {
    renderForm()
    expect(guardar()).toBeDisabled()
  })

  it('guarda los montos ordenados y la vigencia como número', async () => {
    renderForm()
    fireEvent.change(screen.getAllByLabelText('settings.rules.suggestedN')[2], { target: { value: '750' } })
    fireEvent.click(screen.getByLabelText('settings.rules.validityOption.12'))
    fireEvent.click(guardar())
    await waitFor(() =>
      expect(svc.updateGiftCardSettings).toHaveBeenCalledWith('v1', {
        suggestedAmounts: [500, 750, 1000],
        minAmount: 100,
        maxAmount: 10000,
        validityMonths: 12,
      }),
    )
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'settings.rules.saved' }))
  })

  it('un mínimo debajo del piso no se manda y se explica', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('settings.rules.min'), { target: { value: '50' } })
    fireEvent.click(guardar())
    expect(screen.getByRole('alert')).toHaveTextContent('settings.rules.errors.minTooLow')
    expect(svc.updateGiftCardSettings).not.toHaveBeenCalled()
  })

  it('el campo se puede vaciar sin que el valor rebote (Clearable Number Inputs)', () => {
    renderForm()
    const max = screen.getByLabelText('settings.rules.max') as HTMLInputElement
    fireEvent.change(max, { target: { value: '' } })
    expect(max.value).toBe('')
  })

  it('sin giftCards:manage los campos se ven pero no se editan y no hay botón', () => {
    renderForm(false)
    expect(screen.getByLabelText('settings.rules.min')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'settings.rules.save' })).not.toBeInTheDocument()
  })

  it('un error sin `code` se dice con el texto genérico, nunca el crudo (nota 12)', async () => {
    svc.updateGiftCardSettings.mockRejectedValue({ response: { status: 401, data: { message: 'Unauthorized' } } })
    renderForm()
    fireEvent.change(screen.getByLabelText('settings.rules.max'), { target: { value: '5000' } })
    fireEvent.click(guardar())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'settings.rules.saveError', description: 'errors.generic', variant: 'destructive' }),
    )
  })
})
