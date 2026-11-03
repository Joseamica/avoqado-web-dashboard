// src/pages/Delivery/components/RappiConnectionSection.test.tsx — Rappi fase 3
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink } from '@/types/delivery'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// t devuelve la llave (y el conteo, si lo hay) para poder afirmar sobre llaves de i18n.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: { count?: number; store?: string }) =>
      o?.count !== undefined ? `${key}:${o.count}` : o?.store ? `${key}:${o.store}` : key,
  }),
}))

const mockCan = vi.fn((_perm: string) => true)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))

const mockGetUrl = vi.fn()
const mockDisconnect = vi.fn()
vi.mock('@/services/delivery.service', () => ({
  getRappiConnectUrl: (...a: unknown[]) => mockGetUrl(...a),
  disconnectChannel: (...a: unknown[]) => mockDisconnect(...a),
}))

import { RappiConnectionSection, RappiStoreActions } from './RappiConnectionSection'

function tienda(overrides: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink {
  return {
    id: 'link-1',
    venueId: 'venue-1',
    provider: 'RAPPI',
    status: 'ACTIVE',
    orderAcceptanceMode: 'AUTO',
    autoSyncMenu: true,
    lastMenuSyncAt: null,
    externalLocationId: '900',
    externalAccountId: 'Tacos Centro',
    conexionId: 'i1:900',
    pedidosEnCurso: 0,
    ...overrides,
  }
}

const rechazo = (code: string, details?: unknown) =>
  Object.assign(new Error(code), { response: { data: { code, message: code, details } } })

function conCliente(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const r = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return { ...r, invalidar }
}

const confirmarDesconexion = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'rappi.disconnect' }))
  fireEvent.click(await screen.findByRole('button', { name: 'rappi.disconnect' }))
}

let pestana: { location: { href: string }; opener: unknown; closed: boolean; close: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockCan.mockImplementation(() => true)
  mockGetUrl.mockResolvedValue({ ok: true, url: 'https://rappi.test/start' })
  mockDisconnect.mockResolvedValue(tienda({ status: 'DISABLED' }))
  pestana = { location: { href: 'about:blank' }, opener: window, closed: false, close: vi.fn() }
  vi.spyOn(window, 'open').mockImplementation(() => pestana as unknown as Window)
})

describe('RappiConnectionSection', () => {
  it('sin tiendas: Conectar Rappi abre la pestaña DURANTE el toque y la lleva al enlace al llegar (Codex código r1 #3)', async () => {
    let soltar: (v: { ok: boolean; url: string }) => void = () => {}
    mockGetUrl.mockReturnValueOnce(new Promise(r => (soltar = r)))
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'rappi.connect' }))
    // Todavía no llega el enlace y la pestaña ya está abierta: el navegador no la bloquea por esperar la red.
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(pestana.opener).toBeNull()
    soltar({ ok: true, url: 'https://rappi.test/start' })
    await waitFor(() => expect(pestana.location.href).toBe('https://rappi.test/start'))
    expect(mockGetUrl).toHaveBeenCalledWith('venue-1')
    // Y el enlace queda a la vista por si el navegador no la dejó abrir.
    expect(screen.getByRole('link', { name: 'rappi.openLinkFallback' })).toHaveAttribute('href', 'https://rappi.test/start')
  })

  it('dos toques seguidos a Conectar piden UN solo enlace y abren UNA pestaña (full-testing 25-oct)', async () => {
    let soltar: (v: { ok: boolean; url: string }) => void = () => {}
    mockGetUrl.mockReturnValueOnce(new Promise(r => (soltar = r)))
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[]} />)
    const boton = screen.getByRole('button', { name: 'rappi.connect' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(window.open).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockGetUrl).toHaveBeenCalled())
    soltar({ ok: true, url: 'https://rappi.test/start' })
    await waitFor(() => expect(pestana.location.href).toBe('https://rappi.test/start'))
    expect(mockGetUrl).toHaveBeenCalledTimes(1)
  })

  it('si el navegador bloquea la pestaña, el enlace queda a la vista para tocarlo', async () => {
    vi.mocked(window.open).mockImplementationOnce(() => null)
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'rappi.connect' }))
    expect(await screen.findByRole('link', { name: 'rappi.openLinkFallback' })).toHaveAttribute('href', 'https://rappi.test/start')
  })

  it('si el enlace falla cierra la pestaña vacía y avisa con el mensaje del servidor', async () => {
    mockGetUrl.mockRejectedValueOnce(rechazo('RAPPI_CONNECT_NOT_CONFIGURED'))
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'rappi.connect' }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'rappi.connectError', variant: 'destructive' })),
    )
    expect(pestana.close).toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'rappi.openLinkFallback' })).not.toBeInTheDocument()
  })

  it('con dos tiendas pinta dos renglones y el botón dice Conectar otra tienda', () => {
    conCliente(
      <RappiConnectionSection
        venueId="venue-1"
        rappiChannels={[tienda({ status: 'DISABLED' }), tienda({ id: 'link-2', externalAccountId: 'Tacos Norte', status: 'PENDING' })]}
      />,
    )
    expect(screen.getByText('Tacos Centro')).toBeInTheDocument()
    expect(screen.getByText('Tacos Norte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'rappi.connectAnother' })).toBeInTheDocument()
  })

  it('DISABLED muestra Reconectar (mismo enlace); PENDING espera y no ofrece Desconectar', async () => {
    conCliente(
      <RappiConnectionSection
        venueId="venue-1"
        rappiChannels={[tienda({ status: 'DISABLED' }), tienda({ id: 'link-2', status: 'PENDING' })]}
      />,
    )
    expect(screen.getByText('rappi.pendingHint')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'rappi.disconnect' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'rappi.reconnect' }))
    expect(window.open).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(pestana.location.href).toBe('https://rappi.test/start'))
  })

  it('sin permiso no hay botones y se ve el aviso para el administrador', () => {
    mockCan.mockImplementation(() => false)
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[tienda({ status: 'DISABLED' })]} />)
    expect(screen.getByText('rappi.needsAdmin')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Tacos Centro')).toBeInTheDocument()
  })

  it('en el panel vivo (showRows=false) sólo va el botón de conectar', () => {
    conCliente(<RappiConnectionSection venueId="venue-1" rappiChannels={[tienda()]} showRows={false} />)
    expect(screen.queryByText('Tacos Centro')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'rappi.connectAnother' })).toBeInTheDocument()
  })
})

describe('RappiStoreActions (desconectar)', () => {
  it('confirmar Desconectar llama una vez con su linkId y conexionId, aunque se toque dos veces', async () => {
    const { invalidar } = conCliente(<RappiStoreActions venueId="venue-1" channel={tienda({ id: 'link-2', conexionId: 'i2:901' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'rappi.disconnect' }))
    const accion = await screen.findByRole('button', { name: 'rappi.disconnect' })
    fireEvent.click(accion)
    fireEvent.click(accion)
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title: 'rappi.disconnectSuccess' }))
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockDisconnect).toHaveBeenCalledWith('venue-1', 'link-2', 'i2:901', { forzar: false })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['deliveryChannels', 'venue-1'] })
  })

  it('con pedidosEnCurso 2 el botón está deshabilitado y dice cuántos son; con 0 se habilita sin recargar', () => {
    const { rerender } = conCliente(<RappiStoreActions venueId="venue-1" channel={tienda({ pedidosEnCurso: 2 })} />)
    expect(screen.getByRole('button', { name: 'rappi.disconnect' })).toBeDisabled()
    expect(screen.getByText('rappi.ordersInProgress:2')).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RappiStoreActions venueId="venue-1" channel={tienda({ pedidosEnCurso: 0 })} />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('button', { name: 'rappi.disconnect' })).toBeEnabled()
  })

  it('502 RAPPI_NO_ACEPTO avisa en el renglón; «Desconectar de todos modos» pide confirmar y manda forzar', async () => {
    mockDisconnect.mockRejectedValueOnce(rechazo('RAPPI_NO_ACEPTO'))
    conCliente(<RappiStoreActions venueId="venue-1" channel={tienda()} />)
    await confirmarDesconexion()
    expect(await screen.findByText('rappi.errorNotAccepted')).toBeInTheDocument()
    // El primer toque nunca fuerza.
    expect(mockDisconnect).toHaveBeenLastCalledWith('venue-1', 'link-1', 'i1:900', { forzar: false })
    fireEvent.click(screen.getByRole('button', { name: 'rappi.forceAction' }))
    expect(await screen.findByText('rappi.forceDescription')).toBeInTheDocument()
    const botones = screen.getAllByRole('button', { name: 'rappi.forceAction' })
    fireEvent.click(botones[botones.length - 1])
    await waitFor(() => expect(mockDisconnect).toHaveBeenLastCalledWith('venue-1', 'link-1', 'i1:900', { forzar: true }))
  })

  it('un 502 viejo no deja forzar una conexión nueva: si el conexionId cambió, el aviso desaparece (Codex código r1 #1)', async () => {
    mockDisconnect.mockRejectedValueOnce(rechazo('RAPPI_NO_ACEPTO'))
    const { rerender } = conCliente(<RappiStoreActions venueId="venue-1" channel={tienda({ conexionId: 'i1:900' })} />)
    await confirmarDesconexion()
    expect(await screen.findByRole('button', { name: 'rappi.forceAction' })).toBeInTheDocument()
    // Otro administrador desconectó y reconectó: el refresco trae otra conexión.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RappiStoreActions venueId="venue-1" channel={tienda({ conexionId: 'i2:900' })} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText('rappi.errorNotAccepted')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'rappi.forceAction' })).not.toBeInTheDocument()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('502 RAPPI_SIN_CONFIRMAR dice que no se supo y ofrece forzar', async () => {
    mockDisconnect.mockRejectedValueOnce(rechazo('RAPPI_SIN_CONFIRMAR'))
    conCliente(<RappiStoreActions venueId="venue-1" channel={tienda()} />)
    await confirmarDesconexion()
    expect(await screen.findByText('rappi.errorUnconfirmed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'rappi.forceAction' })).toBeInTheDocument()
  })

  it('409 de pedidos en curso, conexión cambiada o recién conectada: su texto, sin forzar, y refresca la lista', async () => {
    for (const [code, texto] of [
      ['RAPPI_PEDIDOS_EN_CURSO', 'rappi.ordersInProgress:3'],
      ['RAPPI_CAMBIO_LA_CONEXION', 'rappi.errorConnectionChanged'],
      ['RAPPI_OPERACION_EN_CURSO', 'rappi.errorStillConnecting'],
    ] as const) {
      mockDisconnect.mockRejectedValueOnce(rechazo(code, { pedidosEnCurso: 3 }))
      const { unmount } = conCliente(<RappiStoreActions venueId="venue-1" channel={tienda()} />)
      await confirmarDesconexion()
      expect(await screen.findByText(texto)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'rappi.forceAction' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('sin permiso no pinta nada', () => {
    mockCan.mockImplementation(() => false)
    const { container } = conCliente(<RappiStoreActions venueId="venue-1" channel={tienda()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
