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
const tier = vi.hoisted(() => ({ current: { hasAccess: true, isResolved: true, isLoading: false, requiredTier: 'PRO' } }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => tier.current }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// La casilla real usa <Trans> y la hoja de documentos; aquí basta una casilla que diga si se marcó.
vi.mock('@/components/legal/LegalConsentCheckbox', () => ({
  LegalConsentCheckbox: (p: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) => (
    <input
      type="checkbox"
      aria-label="consent"
      checked={p.checked}
      disabled={p.disabled}
      onChange={e => p.onCheckedChange(e.target.checked)}
    />
  ),
}))

import { giftCardKeys } from '@/hooks/use-gift-cards'
import { GiftCardsSwitch } from '../components/giftCards/GiftCardsSwitch'

const SETTINGS: GiftCardSettingsView = {
  enabled: false,
  suggestedAmounts: [500, 1000, 2000],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 69999.99,
  llavesConfiguradas: true,
  hasCards: false,
  updatedAt: null,
}

function renderSwitch(over: Partial<GiftCardSettingsView> = {}, canManage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <GiftCardsSwitch venueId="v1" settings={{ ...SETTINGS, ...over }} canManage={canManage} />
    </QueryClientProvider>,
  )
  return { invalidate }
}
const elSwitch = () => screen.getByRole('switch', { name: 'settings.switch.label' })

beforeEach(() => {
  vi.clearAllMocks()
  tier.current = { hasAccess: true, isResolved: true, isLoading: false, requiredTier: 'PRO' }
  svc.updateGiftCardSettings.mockResolvedValue({ ...SETTINGS, enabled: true })
})

describe('GiftCardsSwitch (switch canónico, spec §9)', () => {
  it('prende sólo tras aceptar las reglas; manda aceptaTerminos y refresca ajustes y tipos de pago', async () => {
    const { invalidate } = renderSwitch()
    expect(elSwitch()).not.toBeChecked()
    fireEvent.click(elSwitch())
    const prender = screen.getByRole('button', { name: 'activate.confirm' })
    expect(prender).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'consent' }))
    expect(prender).toBeEnabled()
    fireEvent.click(prender)
    await waitFor(() => expect(svc.updateGiftCardSettings).toHaveBeenCalledWith('v1', { enabled: true, aceptaTerminos: true }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'settings.switch.onToast' }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: giftCardKeys.settings('v1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tender-types', 'v1'] })
  })

  it('con el plan sin comprobar (cargando: el gate hace fail-open) el switch apagado NO se puede prender', () => {
    tier.current = { hasAccess: true, isResolved: false, isLoading: true, requiredTier: 'PRO' }
    renderSwitch()
    expect(elSwitch()).toBeDisabled()
    fireEvent.click(elSwitch())
    expect(screen.queryByRole('button', { name: 'activate.confirm' })).not.toBeInTheDocument()
  })

  it('sin el plan y apagado: deshabilitado (el cartel de la página dice cómo tenerlo)', () => {
    tier.current = { hasAccess: false, isResolved: true, isLoading: false, requiredTier: 'PRO' }
    renderSwitch()
    expect(elSwitch()).toBeDisabled()
  })

  it('prendido y bajó de plan: se ve, lo explica y deja apagar (lo vendido se sigue cobrando)', async () => {
    tier.current = { hasAccess: false, isResolved: true, isLoading: false, requiredTier: 'PRO' }
    svc.updateGiftCardSettings.mockResolvedValue({ ...SETTINGS, enabled: false })
    renderSwitch({ enabled: true })
    expect(screen.getByText('settings.switch.downgraded')).toBeInTheDocument()
    expect(elSwitch()).toBeChecked()
    expect(elSwitch()).toBeEnabled()
    fireEvent.click(elSwitch())
    expect(screen.getByText('deactivate.body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'deactivate.confirm' }))
    await waitFor(() => expect(svc.updateGiftCardSettings).toHaveBeenCalledWith('v1', { enabled: false }))
  })

  it('sin giftCards:manage el switch se ve pero no se mueve', () => {
    renderSwitch({ enabled: true }, false)
    expect(elSwitch()).toBeChecked()
    expect(elSwitch()).toBeDisabled()
  })

  it('un rechazo del server se dice con SU texto y el diálogo sigue abierto para reintentar', async () => {
    svc.updateGiftCardSettings.mockRejectedValue({
      response: { status: 403, data: { code: 'GIFT_CARDS_NOT_IN_PLAN', message: 'Tu plan no incluye vender tarjetas de regalo.' } },
    })
    renderSwitch()
    fireEvent.click(elSwitch())
    fireEvent.click(screen.getByRole('checkbox', { name: 'consent' }))
    fireEvent.click(screen.getByRole('button', { name: 'activate.confirm' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'settings.switch.errorTitle',
        description: 'Tu plan no incluye vender tarjetas de regalo.',
        variant: 'destructive',
      }),
    )
    expect(screen.getByRole('button', { name: 'activate.confirm' })).toBeInTheDocument()
  })

  it('un error sin `code` (401/500 de checkFeatureAccess, en inglés) se dice con el texto genérico, nunca el crudo (nota 12)', async () => {
    svc.updateGiftCardSettings.mockRejectedValue({ response: { status: 500, data: { message: 'Internal server error' } } })
    renderSwitch()
    fireEvent.click(elSwitch())
    fireEvent.click(screen.getByRole('checkbox', { name: 'consent' }))
    fireEvent.click(screen.getByRole('button', { name: 'activate.confirm' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'settings.switch.errorTitle', description: 'errors.generic', variant: 'destructive' }),
    )
  })

  it('le falta a Avoqado una llave: prendido, lo dice', () => {
    renderSwitch({ enabled: true, llavesConfiguradas: false })
    expect(screen.getByText('notice.KEYS_MISSING')).toBeInTheDocument()
  })
})
