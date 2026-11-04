// El interruptor vive en la misma página de Clientes › Tarjetas de regalo, junto a lo demás (founder, 3-nov-2026): se prende sin ir a
// Ajustes, también cuando ya se habían vendido tarjetas. Sólo administrador y dueño lo mueven; el gerente ve a quién pedírselo.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardSettingsView } from '@/types/giftCard'

const access = vi.hoisted(() => ({ allowed: [] as string[] }))
const plan = vi.hoisted(() => ({ hasAccess: true }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p), isLoading: false }) }))
vi.mock('@/hooks/use-tier-feature-access', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/use-tier-feature-access')>()),
  useTierFeatureAccess: () => ({ hasAccess: plan.hasAccess, isResolved: true, isLoading: false, requiredTier: 'PRO' }),
}))
const svc = vi.hoisted(() => ({ getGiftCardSettings: vi.fn(), updateGiftCardSettings: vi.fn() }))
vi.mock('@/services/giftCard.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('../components/GiftCardsList', () => ({ GiftCardsList: () => <div>lista-de-tarjetas</div> }))
vi.mock('../components/GiftCardReports', () => ({ GiftCardReports: () => <div>reportes</div> }))
vi.mock('../components/GiftCardsTeaser', () => ({ GiftCardsTeaser: () => <div>cartel</div> }))
vi.mock('@/components/legal/LegalConsentCheckbox', () => ({
  LegalConsentCheckbox: (p: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <input type="checkbox" aria-label="consent" checked={p.checked} onChange={e => p.onCheckedChange(e.target.checked)} />
  ),
}))

import GiftCardsPage from '../GiftCardsPage'

const AJUSTES: GiftCardSettingsView = {
  enabled: false,
  suggestedAmounts: [500],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 70000,
  llavesConfiguradas: true,
  updatedAt: null,
  hasCards: false,
} as GiftCardSettingsView

const ADMIN = ['giftCards:read', 'giftCards:manage', 'giftCards:enable']
const GERENTE = ['giftCards:read', 'giftCards:manage']

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GiftCardsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const elSwitch = () => screen.findByRole('switch', { name: 'settings.switch.label' })

beforeEach(() => {
  vi.clearAllMocks()
  access.allowed = ADMIN
  plan.hasAccess = true
  svc.getGiftCardSettings.mockResolvedValue(AJUSTES)
})

describe('Tarjetas de regalo: prender en la misma página', () => {
  it('apagadas y sin tarjetas: un administrador ve el interruptor aquí, y ninguna liga a Ajustes', async () => {
    pintar()
    expect(await elSwitch()).toBeEnabled()
    expect(screen.getByText('turnOn.title')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('🔴 prender aquí cambia la pantalla sin recargar: de «prender» pasa a la lista', async () => {
    const prendidas = { ...AJUSTES, enabled: true }
    svc.updateGiftCardSettings.mockImplementation(async () => {
      svc.getGiftCardSettings.mockResolvedValue(prendidas)
      return prendidas
    })
    const user = userEvent.setup()
    pintar()
    await user.click(await elSwitch())
    await user.click(screen.getByRole('checkbox', { name: 'consent' }))
    await user.click(screen.getByRole('button', { name: 'activate.confirm' }))
    await waitFor(() => expect(svc.updateGiftCardSettings).toHaveBeenCalledWith('v1', { enabled: true, aceptaTerminos: true }))
    expect(await screen.findByText('lista-de-tarjetas')).toBeInTheDocument()
    expect(screen.queryByText('turnOn.title')).not.toBeInTheDocument()
  })

  it('apagadas y sin tarjetas: un gerente ve el interruptor apagado y a quién pedírselo', async () => {
    access.allowed = GERENTE
    pintar()
    expect(await elSwitch()).toBeDisabled()
    expect(screen.getByText('settings.switch.askAdmin')).toBeInTheDocument()
  })

  it('🔴 apagadas con tarjetas ya vendidas: se vuelven a prender aquí, junto a la lista, sin ir a Ajustes', async () => {
    svc.getGiftCardSettings.mockResolvedValue({ ...AJUSTES, hasCards: true })
    pintar()
    expect(await elSwitch()).toBeEnabled()
    expect(screen.getByText('lista-de-tarjetas')).toBeInTheDocument()
    expect(screen.getByText('notice.DISABLED')).toBeInTheDocument()
    expect(screen.queryByText('notice.goToSettings')).not.toBeInTheDocument()
  })

  it('prendidas: un administrador puede apagarlas aquí; un gerente no ve el interruptor', async () => {
    svc.getGiftCardSettings.mockResolvedValue({ ...AJUSTES, enabled: true, hasCards: true })
    const primero = pintar()
    expect(await elSwitch()).toBeChecked()
    primero.unmount()
    access.allowed = GERENTE
    pintar()
    expect(await screen.findByText('lista-de-tarjetas')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'settings.switch.label' })).not.toBeInTheDocument()
  })

  // CI del PR #254: con el interruptor en la lista, el aviso de arriba repetía lo que ya dice el interruptor.
  it('🔴 sin plan y prendidas: «tu plan ya no incluye» sale una vez, y el gerente, sin interruptor, lo ve arriba', async () => {
    plan.hasAccess = false
    svc.getGiftCardSettings.mockResolvedValue({ ...AJUSTES, enabled: true, hasCards: true })
    const primero = pintar()
    expect(await screen.findByText('settings.switch.downgraded')).toBeInTheDocument()
    expect(screen.queryByText('notice.NOT_IN_PLAN')).not.toBeInTheDocument()
    primero.unmount()
    access.allowed = GERENTE
    pintar()
    expect(await screen.findByText('notice.NOT_IN_PLAN')).toBeInTheDocument()
  })

  it('🔴 prendidas sin llaves: el aviso sale una sola vez', async () => {
    svc.getGiftCardSettings.mockResolvedValue({ ...AJUSTES, enabled: true, hasCards: true, llavesConfiguradas: false })
    pintar()
    await screen.findByText('lista-de-tarjetas')
    expect(await screen.findAllByText('notice.KEYS_MISSING')).toHaveLength(1)
  })
})
