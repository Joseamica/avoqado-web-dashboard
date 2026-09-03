import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Campaigns from '../Campaigns'

/**
 * La lista de campañas. Lo que estas pruebas fijan:
 *
 *  - Pagina contra el SERVIDOR (`page`/`pageSize`), nunca trayendo todo — `bounded-data-…`.
 *  - Un listado vacío se EXPLICA; no se deja una tabla en blanco.
 *  - Antes de mandar no se pinta «0 de 0», que se lee como fracaso.
 */
// Eco de la clave. Tolerante a propósito: DataTable llama `t()` con valores que no son
// string, y un mock que asume string revienta con un error que no habla del sujeto.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: unknown) => (typeof key === 'string' ? key : String(key)) }),
}))

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d.slice(0, 10) }) }))
// El paywall y el permiso tienen sus propias pruebas; aquí se dejan abiertos para que la
// lista sea el sujeto y no el gate.
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: any) => <>{children}</> }))
vi.mock('../components/CampaignEditorModal', () => ({ CampaignEditorModal: () => null }))

const mockList = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: { listCampaigns: (...a: unknown[]) => mockList(...a) },
}))

const campana = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Promo de fin de semana', subject: '20% este sábado', status: 'SENT',
  audience: 'ALL_CONSENTED', customerGroupId: null, tags: [], totalRecipients: 120,
  sentCount: 118, failedCount: 2, skippedCount: 0, scheduledFor: null,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', ...over,
})

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Campaigns />
    </QueryClientProvider>,
  )
}

describe('Campaigns — la lista', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide la PRIMERA página al servidor, acotada', async () => {
    mockList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    pintar()
    await waitFor(() => expect(mockList).toHaveBeenCalledWith('v1', { page: 1, pageSize: 20 }))
  })

  it('pinta la campaña con su asunto', async () => {
    mockList.mockResolvedValue({ items: [campana()], total: 1, page: 1, pageSize: 20 })
    pintar()
    await waitFor(() => expect(screen.getByText('Promo de fin de semana')).toBeInTheDocument())
    expect(screen.getByText('20% este sábado')).toBeInTheDocument()
  })

  it('sin campañas: lo EXPLICA en vez de dejar la tabla en blanco', async () => {
    mockList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    pintar()
    await waitFor(() => expect(screen.getByText('campaigns.empty.title')).toBeInTheDocument())
    expect(screen.getByText('campaigns.empty.body')).toBeInTheDocument()
  })

  it('con campañas NO enseña el mensaje de vacío', async () => {
    mockList.mockResolvedValue({ items: [campana()], total: 1, page: 1, pageSize: 20 })
    pintar()
    await waitFor(() => expect(screen.getByText('Promo de fin de semana')).toBeInTheDocument())
    expect(screen.queryByText('campaigns.empty.title')).not.toBeInTheDocument()
  })

  it('un borrador no pinta "0 / 0": todavía no hay nada que contar', async () => {
    mockList.mockResolvedValue({
      items: [campana({ status: 'DRAFT', sentCount: 0, totalRecipients: 0, failedCount: 0 })],
      total: 1, page: 1, pageSize: 20,
    })
    pintar()
    await waitFor(() => expect(screen.getByText('Promo de fin de semana')).toBeInTheDocument())
    expect(screen.queryByText(/0\s*\/\s*0/)).not.toBeInTheDocument()
  })
})
