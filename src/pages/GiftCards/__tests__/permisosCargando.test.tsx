// D6 r1 (M2): al recargar en frío, la guardia deja pasar mientras llegan los permisos y `can()` da false: las consultas del
// módulo quedan apagadas SIN datos (en TanStack v5 eso no es «cargando» ni «error»). Antes, ajustes caía en «no se pudo
// cargar», la lista en «Aún no hay tarjetas» y pendientes en «sin pendientes» un instante. Aquí los hooks son los de verdad
// (con un QueryClient real); sólo se finge lo de fuera: los permisos todavía cargando, el servicio, textos y zona horaria.
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => false, isLoading: true }) }))
// El plan también es «de fuera» (Ajustes lo lee para decidir el cartel): sin esto saldría un GET real a /plan-tier.
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, isResolved: false, isLoading: true, requiredTier: 'PRO' }),
}))
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
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => d, formatDate: (d: string) => d }),
}))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))

import GiftCardSettings from '@/pages/Settings/GiftCardSettings'
import { GiftCardsList } from '../components/GiftCardsList'
import { GiftCardReports } from '../components/GiftCardReports'

function pintar(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
const nadaPedido = () => {
  for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled()
}

describe('permisos todavía cargando: cada pantalla dice «cargando», nunca error ni vacío', () => {
  it('ajustes', () => {
    pintar(<GiftCardSettings />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('settings.loadError')).not.toBeInTheDocument()
    // Lote ⭐ 2e: sin permisos todavía, `can()` da false; eso no es «sólo lectura».
    expect(screen.queryByText('settings.readOnly')).not.toBeInTheDocument()
    nadaPedido()
  })

  it('lista', () => {
    const { container } = pintar(<GiftCardsList venueId="v1" />)
    expect(screen.queryByText('list.emptyTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('list.loadError')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    nadaPedido()
  })

  it('pendientes contables (y el resto de los reportes)', () => {
    const { container } = pintar(<GiftCardReports venueId="v1" />)
    expect(screen.queryByText('reports.pending.empty')).not.toBeInTheDocument()
    expect(screen.queryByText('reports.pending.error')).not.toBeInTheDocument()
    expect(screen.queryByText('reports.aging.error')).not.toBeInTheDocument()
    expect(screen.queryByText('reports.summaryError')).not.toBeInTheDocument()
    expect(container.querySelector('[data-tour="gift-cards-pending-accounting"] .animate-pulse')).not.toBeNull()
    nadaPedido()
  })
})
