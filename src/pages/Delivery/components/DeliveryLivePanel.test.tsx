// src/pages/Delivery/components/DeliveryLivePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink, DeliverySummary } from '@/types/delivery'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// t returns the key verbatim so assertions can match i18n keys directly (repo test convention).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

// useAccess mock — controls `can('delivery-channels:manage')` per test. Defaults to true so the
// existing pause tests exercise the interactive Switch; the gating test flips it to false.
const mockCan = vi.fn((_perm: string) => true)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ fullBasePath: '/venues/test' }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => `dt:${d}` }),
}))

const mockGetDeliverySummary = vi.fn()
const mockPauseChannel = vi.fn()
const mockUpdateChannel = vi.fn()
vi.mock('@/services/delivery.service', () => ({
  getDeliverySummary: (...args: unknown[]) => mockGetDeliverySummary(...args),
  pauseChannel: (...args: unknown[]) => mockPauseChannel(...args),
  updateChannel: (...args: unknown[]) => mockUpdateChannel(...args),
}))

import { DeliveryLivePanel } from './DeliveryLivePanel'

function channel(overrides: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink {
  return {
    id: 'link-1',
    venueId: 'venue-1',
    provider: 'UBER_EATS',
    status: 'ACTIVE',
    orderAcceptanceMode: 'AUTO',
    autoSyncMenu: true,
    lastMenuSyncAt: '2026-07-18T10:00:00.000Z',
    externalLocationId: 'ext-1',
    ...overrides,
  }
}

function summaryWith(channels: DeliverySummary['channels']): DeliverySummary {
  return { channels, generatedAt: '2026-07-18T12:00:00.000Z' }
}

function renderPanel(channels: DeliveryChannelLink[]) {
  // retry:false so a rejected getDeliverySummary surfaces isError immediately (no 3× backoff).
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeliveryLivePanel venueId="venue-1" channels={channels} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCan.mockReturnValue(true) // default: OWNER/ADMIN — can manage
  mockGetDeliverySummary.mockResolvedValue(summaryWith([]))
  mockPauseChannel.mockResolvedValue(channel({ status: 'PAUSED' }))
  mockUpdateChannel.mockResolvedValue(channel({ orderAcceptanceMode: 'MANUAL' }))
})

describe('DeliveryLivePanel', () => {
  // -------------------------------------------------------------------------------------------
  // Pause/resume toggle — the highest-risk surface (money-adjacent: pausing a live channel stops
  // incoming orders). Assert the EXACT pauseChannel args + the exact cache key invalidated.
  // -------------------------------------------------------------------------------------------
  it('toggle de un canal ACTIVE → pauseChannel(venueId, linkId, true) EXACTO + invalida ["deliveryChannels", venueId]', async () => {
    const { invalidateSpy } = renderPanel([channel({ id: 'link-1', status: 'ACTIVE' })])

    const sw = await screen.findByRole('switch')
    fireEvent.click(sw)

    // ACTIVE → checked=true; clicking turns it off → onCheckedChange(false) → paused = !false = true.
    await waitFor(() => expect(mockPauseChannel).toHaveBeenCalledWith('venue-1', 'link-1', true))
    // Must invalidate the SAME key useDeliveryStatus reads, or the LIVE/PENDING gate + cards go stale.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['deliveryChannels', 'venue-1'] }))
  })

  it('toggle de un canal PAUSED → pauseChannel(venueId, linkId, false) (reanudar)', async () => {
    renderPanel([channel({ id: 'link-2', status: 'PAUSED' })])

    const sw = await screen.findByRole('switch')
    fireEvent.click(sw)

    // PAUSED → checked=false; clicking turns it on → onCheckedChange(true) → paused = !true = false.
    await waitFor(() => expect(mockPauseChannel).toHaveBeenCalledWith('venue-1', 'link-2', false))
  })

  it('canal PENDING (no togglable) → sin switch', async () => {
    renderPanel([channel({ status: 'PENDING' })])

    await screen.findByText('live.channelsTitle')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('sin delivery-channels:manage → Switch disabled + status como badge de solo-lectura; al intentar pausar NO llama a pauseChannel', async () => {
    mockCan.mockImplementation((perm: string) => perm !== 'delivery-channels:manage') // MANAGER: read pero no manage
    renderPanel([channel({ status: 'ACTIVE' })])

    const sw = await screen.findByRole('switch')
    expect(sw).toBeDisabled()
    // El estado sigue visible como badge de solo-lectura (no se pierde información).
    expect(screen.getByText('live.statusActive')).toBeInTheDocument()

    fireEvent.click(sw)
    // Un Switch disabled no dispara onCheckedChange → el guard evita el 403 muerto.
    await new Promise(r => setTimeout(r, 0))
    expect(mockPauseChannel).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------------------------
  // Acceptance mode control (AUTO/MANUAL) — backend PATCH .../channels/:linkId, gated the same
  // way as the pause Switch: always rendered, `disabled` without delivery-channels:manage.
  // -------------------------------------------------------------------------------------------
  it('modo AUTO → click en MANUAL llama a updateChannel(venueId, linkId, { orderAcceptanceMode: "MANUAL" }) EXACTO + invalida ["deliveryChannels", venueId]', async () => {
    const { invalidateSpy } = renderPanel([channel({ id: 'link-1', orderAcceptanceMode: 'AUTO' })])

    const manualBtn = await screen.findByRole('button', { name: 'live.modeManual' })
    fireEvent.click(manualBtn)

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledWith('venue-1', 'link-1', { orderAcceptanceMode: 'MANUAL' }))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['deliveryChannels', 'venue-1'] }))
  })

  it('modo MANUAL → click en AUTO llama a updateChannel(venueId, linkId, { orderAcceptanceMode: "AUTO" })', async () => {
    renderPanel([channel({ id: 'link-2', orderAcceptanceMode: 'MANUAL' })])

    const autoBtn = await screen.findByRole('button', { name: 'live.modeAuto' })
    fireEvent.click(autoBtn)

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledWith('venue-1', 'link-2', { orderAcceptanceMode: 'AUTO' }))
  })

  it('el botón del modo actual está marcado (aria-pressed) y un click sobre el modo ya activo NO llama a updateChannel', async () => {
    renderPanel([channel({ orderAcceptanceMode: 'AUTO' })])

    const autoBtn = await screen.findByRole('button', { name: 'live.modeAuto' })
    const manualBtn = await screen.findByRole('button', { name: 'live.modeManual' })
    expect(autoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(manualBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(autoBtn)
    await new Promise(r => setTimeout(r, 0))
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('sin delivery-channels:manage → controles de modo disabled; al intentar cambiar NO llama a updateChannel', async () => {
    mockCan.mockImplementation((perm: string) => perm !== 'delivery-channels:manage')
    renderPanel([channel({ orderAcceptanceMode: 'AUTO' })])

    const manualBtn = await screen.findByRole('button', { name: 'live.modeManual' })
    expect(manualBtn).toBeDisabled()

    fireEvent.click(manualBtn)
    await new Promise(r => setTimeout(r, 0))
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------------------------
  // Stats strip — data / empty / error (Minor #1: a failed fetch must NOT masquerade as zero orders).
  // -------------------------------------------------------------------------------------------
  it('stats con datos → renderiza canal, monto y conteo de pedidos', async () => {
    mockGetDeliverySummary.mockResolvedValue(summaryWith([{ channel: 'UBER_EATS', orders: 12, totalPesos: 150.5 }]))
    renderPanel([channel()])

    // Currency(150.5) is locale-formatted; match the digits (getAllBy: "Uber Eats" also shows on the card).
    expect((await screen.findAllByText(/150[.,]50/)).length).toBeGreaterThan(0)
    expect(screen.getByText('12 live.ordersLabel')).toBeInTheDocument()
    expect(screen.getAllByText('Uber Eats').length).toBeGreaterThan(0)
    expect(screen.queryByText('live.statsEmpty')).not.toBeInTheDocument()
  })

  it('stats vacío (summary.channels: []) → live.statsEmpty, no crashea', async () => {
    mockGetDeliverySummary.mockResolvedValue(summaryWith([]))
    renderPanel([channel()])

    expect(await screen.findByText('live.statsEmpty')).toBeInTheDocument()
  })

  it('stats con error de fetch → live.statsError, NO lo confunde con "cero pedidos" (Minor #1)', async () => {
    mockGetDeliverySummary.mockRejectedValue(new Error('boom'))
    renderPanel([channel()])

    expect(await screen.findByText('live.statsError')).toBeInTheDocument()
    expect(screen.queryByText('live.statsEmpty')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------------------------
  // Defensive rendering — nulls / empties must not throw.
  // -------------------------------------------------------------------------------------------
  it('canal sin lastMenuSyncAt (null) no crashea → muestra live.lastSyncNever', async () => {
    renderPanel([channel({ lastMenuSyncAt: null })])

    expect(await screen.findByText(/live\.lastSyncNever/)).toBeInTheDocument()
  })

  it('channels=[] no crashea → título de canales presente, sin switches', async () => {
    renderPanel([])

    expect(await screen.findByText('live.channelsTitle')).toBeInTheDocument()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('link "Ver pedidos" reutiliza la vista de Órdenes existente (fullBasePath/orders)', async () => {
    renderPanel([channel()])

    const link = await screen.findByRole('link', { name: /live\.viewOrders/ })
    expect(link).toHaveAttribute('href', '/venues/test/orders')
  })
  // ── Señales que hasta hoy sólo vivían en el log o en la base ──────────────────────────
  describe('avisos de menú y de tasa de aceptación', () => {
    it('🔴 avisa cuando el menú NUNCA se logró publicar', async () => {
      // El proveedor está vendiendo otra carta —o ninguna— y nadie se entera hasta que un
      // cliente se queja. Es el aviso que más temprano evita perder ventas.
      renderPanel([channel({ menuSyncStatus: 'NUNCA_PUBLICADO' })])
      expect(await screen.findByText('live.menuNeverPublished')).toBeInTheDocument()
    })

    it('un menú AL DÍA no pinta nada: no se felicita a un canal sano', async () => {
      // Una etiqueta permanente se vuelve invisible justo cuando cambia a roja.
      renderPanel([channel({ menuSyncStatus: 'AL_DIA' })])
      await screen.findByText('live.channelsTitle')
      expect(screen.queryByText('live.menuNeverPublished')).not.toBeInTheDocument()
      expect(screen.queryByText('live.menuManual')).not.toBeInTheDocument()
    })

    it('🔴 avisa cuando la tasa de aceptación cae bajo el umbral de revocación', async () => {
      // Es el número con el que el proveedor decide quitar el acceso. Verlo tarde es
      // enterarse por correo de que ya lo quitaron.
      renderPanel([channel({ injectionRate: { recibidos: 100, aceptados: 97, porcentaje: 97, estado: 'CRITICO' } })])
      expect(await screen.findByText('live.injectionRate')).toBeInTheDocument()
    })

    it('🔴 SIN_DATOS no pinta alarma: aún no hay pedidos, no es un 0%', async () => {
      // Un canal recién conectado no ha recibido nada. Pintarlo en rojo enseñaría a ignorar
      // el aviso justo antes del que sí importa.
      renderPanel([channel({ injectionRate: { recibidos: 0, aceptados: 0, porcentaje: null, estado: 'SIN_DATOS' } })])
      await screen.findByText('live.channelsTitle')
      expect(screen.queryByText('live.injectionRate')).not.toBeInTheDocument()
    })

    it('una tasa OK tampoco pinta nada', async () => {
      renderPanel([channel({ injectionRate: { recibidos: 100, aceptados: 100, porcentaje: 100, estado: 'OK' } })])
      await screen.findByText('live.channelsTitle')
      expect(screen.queryByText('live.injectionRate')).not.toBeInTheDocument()
    })
  })
})
