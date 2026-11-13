// src/pages/Delivery/components/ImpresionDelCanalEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import esDelivery from '@/locales/es/delivery.json'
import type { DeliveryChannelLink } from '@/types/delivery'
import type { Printer, PrintStation } from '@/services/printStations.service'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// t con los textos reales en español: las pruebas afirman sobre lo que lee el dueño.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], esDelivery) as string | undefined
      return (raw ?? key).replace(/\{\{(\w+)\}\}/g, (_, k) => vars?.[k] ?? '')
    },
  }),
}))

const mockUpdateChannel = vi.fn()
vi.mock('@/services/delivery.service', () => ({ updateChannel: (...a: unknown[]) => mockUpdateChannel(...a) }))
const mockGetStations = vi.fn()
const mockGetPrinters = vi.fn()
vi.mock('@/services/printStations.service', () => ({
  getPrintStations: (...a: unknown[]) => mockGetStations(...a),
  getPrinters: (...a: unknown[]) => mockGetPrinters(...a),
}))

import { ImpresionDelCanalEditor, VERSION_MINIMA_POS_IMPRESION_REPARTO } from './ImpresionDelCanalEditor'

const station = (o: Partial<PrintStation>): PrintStation => ({
  id: 'x', venueId: 'venue-1', name: 'X', printerId: null, copies: 1, isDefault: false, isPacking: false,
  hasKitchenDisplay: false, sendsComanda: true, active: true, displayOrder: 0, ...o,
})
const printer = (o: Partial<Printer>): Printer => ({
  id: 'p', venueId: 'venue-1', name: 'P', connectionType: 'NETWORK', stableKey: null, address: '192.168.1.5:9100',
  paperWidthMm: 80, leftMarginChars: 0, charset: 'CP858', active: true, lastStatus: null, lastSeenAt: null, ...o,
})

const ESTACIONES: PrintStation[] = [
  station({ id: 'cocina', name: 'Cocina', printerId: 'p-red', isDefault: true }),
  station({ id: 'barra', name: 'Barra', printerId: 'p-red' }),
  station({ id: 'empaque', name: 'Empaque', printerId: 'p-red', isPacking: true }),
  station({ id: 'sin-imp', name: 'Pasillo', printerId: null }),
  station({ id: 'integrada', name: 'Caja', printerId: 'p-int' }),
  station({ id: 'sin-dir', name: 'Bodega', printerId: 'p-sin-dir' }),
  station({ id: 'apagada', name: 'Apagada', printerId: 'p-red', active: false }),
  station({ id: 'sin-comanda', name: 'Sin comanda', sendsComanda: false }),
]
const IMPRESORAS: Printer[] = [
  printer({ id: 'p-red' }),
  printer({ id: 'p-int', connectionType: 'POS_INTERNAL', address: null }),
  printer({ id: 'p-sin-dir', connectionType: 'NETWORK', address: '' }),
]

const channel = (o: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink => ({
  id: 'link-1', venueId: 'venue-1', provider: 'RAPPI', status: 'ACTIVE', orderAcceptanceMode: 'AUTO', autoSyncMenu: true,
  lastMenuSyncAt: null, externalLocationId: 'ext', ...o,
})

function renderEditor(ch = channel(), canEdit = true, onPendienteChange?: (p: unknown) => void, conBotonGuardar?: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const arbol = (c: DeliveryChannelLink) => (
    <QueryClientProvider client={qc}>
      <ImpresionDelCanalEditor
        venueId="venue-1"
        channel={c}
        canEdit={canEdit}
        onPendienteChange={onPendienteChange}
        conBotonGuardar={conBotonGuardar}
      />
    </QueryClientProvider>
  )
  const r = render(arbol(ch))
  return { ...r, qc, rerenderCon: (c: DeliveryChannelLink) => r.rerender(arbol(c)) }
}

describe('ImpresionDelCanalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStations.mockResolvedValue(ESTACIONES)
    mockGetPrinters.mockResolvedValue(IMPRESORAS)
    mockUpdateChannel.mockResolvedValue(channel())
  })

  it('sin config.impresion: «Como en el salón» marcado y empaque del negocio con su nombre', async () => {
    renderEditor()
    expect(await screen.findByText('La de empaque del negocio (Empaque)')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /Como en el salón/ }) as HTMLInputElement).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /La de empaque del negocio/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('«Todo junto en: Barra» + guardar manda sólo la llave impresion dentro de config', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(1))
    expect(mockUpdateChannel).toHaveBeenCalledWith('venue-1', 'link-1', {
      config: { impresion: { comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NEGOCIO' } },
    })
  })

  it('avisa lo elegido y SIN guardar, y null cuando vuelve a lo guardado', async () => {
    const pendiente = vi.fn()
    renderEditor(channel(), true, pendiente)
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    await waitFor(() =>
      expect(pendiente).toHaveBeenLastCalledWith({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NEGOCIO' }),
    )
    fireEvent.click(screen.getByRole('radio', { name: /Como en el salón/ }))
    await waitFor(() => expect(pendiente).toHaveBeenLastCalledWith(null))
  })

  it('un refresco de impresoras que FALLA después no borra lo elegido ni lo deja de avisar (Codex c2 #1)', async () => {
    const pendiente = vi.fn()
    const { qc } = renderEditor(channel(), true, pendiente)
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    await waitFor(() =>
      expect(pendiente).toHaveBeenLastCalledWith({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NEGOCIO' }),
    )

    mockGetPrinters.mockRejectedValue(new Error('503'))
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['printStations', 'venue-1', 'printers'] })
      // React Query avisa a los componentes en el siguiente tic: sin esto se afirmaría sobre la pantalla de antes.
      await new Promise(r => setTimeout(r, 20))
    })

    expect(qc.getQueryState(['printStations', 'venue-1', 'printers'])?.status).toBe('error')
    expect(screen.getByRole('radio', { name: /Todo junto en: Barra/ }).getAttribute('aria-checked')).toBe('true')
    expect(pendiente).toHaveBeenLastCalledWith({ comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NEGOCIO' })
  })

  it('un refresco de estaciones con otro estado de impresora no regresa lo elegido', async () => {
    const { qc } = renderEditor(channel())
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    mockGetStations.mockResolvedValue(
      ESTACIONES.map(e => ({ ...e, printer: { id: 'p-red', name: 'P', active: true, lastStatus: 'OFFLINE' } })),
    )
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['printStations', 'venue-1'], exact: true })
      await new Promise(r => setTimeout(r, 20))
    })
    expect(screen.getByRole('radio', { name: /Todo junto en: Barra/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('si la estación elegida (sin guardar) deja de servir tras un refresco, cae a «Como en el salón»', async () => {
    const { qc } = renderEditor(channel())
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    mockGetStations.mockResolvedValue(ESTACIONES.map(e => (e.id === 'barra' ? { ...e, active: false } : e)))
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['printStations', 'venue-1'], exact: true })
      await new Promise(r => setTimeout(r, 20))
    })
    expect(screen.getByRole('radio', { name: /Como en el salón/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('si la otra puerta guarda otra cosa, el editor muestra lo nuevo', async () => {
    const { rerenderCon } = renderEditor(channel())
    expect((await screen.findByRole('radio', { name: /Como en el salón/ })).getAttribute('aria-checked')).toBe('true')
    rerenderCon(channel({ config: { impresion: { comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'NO' } } }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Todo junto en: Barra/ }).getAttribute('aria-checked')).toBe('true'),
    )
  })

  it('un refresco que cambia OTRA llave de config (agotados de Rappi) no regresa lo recién elegido', async () => {
    const { rerenderCon } = renderEditor(channel({ config: {} }))
    fireEvent.click(await screen.findByRole('radio', { name: /Todo junto en: Barra/ }))
    rerenderCon(channel({ config: { soldOutSkus: ['sku-1'] } as DeliveryChannelLink['config'] }))
    await act(async () => {})
    expect(screen.getByRole('radio', { name: /Todo junto en: Barra/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('empaque «En: Barra» manda ESTACION con su id (el contrato con el SERVIDOR)', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('radio', { name: 'En: Barra' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(1))
    expect(mockUpdateChannel).toHaveBeenCalledWith('venue-1', 'link-1', {
      config: { impresion: { comanda: 'SALON', empaque: 'ESTACION', empaqueEstacionId: 'barra' } },
    })
  })

  it('conBotonGuardar=false (dentro del diálogo del canal): no hay botón propio', async () => {
    renderEditor(channel(), true, undefined, false)
    await screen.findByRole('radio', { name: /Todo junto en: Barra/ })
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('sólo lista estaciones activas y con comanda', async () => {
    renderEditor()
    await screen.findByRole('radio', { name: /Todo junto en: Barra/ })
    expect(screen.queryByRole('radio', { name: /Apagada/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Sin comanda/ })).toBeNull()
  })

  it('estación sin impresora, integrada o de red sin dirección: cada una dice su aviso', async () => {
    renderEditor()
    await screen.findByRole('radio', { name: /Todo junto en: Pasillo/ })
    expect(screen.getByRole('radio', { name: /Todo junto en: Pasillo/ }).closest('label')?.textContent).toContain(
      'Sin impresora: sale en la impresora de cocina de la tablet',
    )
    expect(screen.getByRole('radio', { name: /Todo junto en: Caja/ }).closest('label')?.textContent).toContain(
      'Impresora integrada: sale en la tablet que tome el pedido; puede ser otra',
    )
    expect(screen.getByRole('radio', { name: /Todo junto en: Bodega/ }).closest('label')?.textContent).toContain(
      'Esta impresora no tiene dirección: sale en la impresora de cocina de la tablet',
    )
  })

  it('estación elegida integrada: el resumen también lo dice', async () => {
    renderEditor(channel({ config: { impresion: { comanda: 'UNA_ESTACION', estacionId: 'integrada', empaque: 'NO' } } }))
    await screen.findByRole('radio', { name: /Todo junto en: Caja/ })
    expect(screen.getAllByText(/Impresora integrada: sale en la tablet/).length).toBeGreaterThanOrEqual(2)
  })

  it('estacionId que ya no es elegible: aviso y vuelve a «Como en el salón»', async () => {
    renderEditor(channel({ config: { impresion: { comanda: 'UNA_ESTACION', estacionId: 'apagada', empaque: 'NEGOCIO' } } }))
    expect(await screen.findByText('La estación elegida ya no existe o está apagada: se imprime como en el salón')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Como en el salón/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('todo junto y empaque en la misma estación: un solo papel', async () => {
    renderEditor(channel({ config: { impresion: { comanda: 'UNA_ESTACION', estacionId: 'barra', empaque: 'ESTACION', empaqueEstacionId: 'barra' } } }))
    expect(await screen.findByText('Van a la misma impresora: sale un solo papel')).toBeTruthy()
  })

  it('siempre muestra la versión mínima del POS', async () => {
    renderEditor()
    expect(VERSION_MINIMA_POS_IMPRESION_REPARTO).toBe('2.25.44')
    expect(await screen.findByText('Se aplica en los POS con la versión 2.25.44 o más nueva')).toBeTruthy()
  })

  it('avisa que en iPad e iPhone todavía no se aplica', async () => {
    renderEditor()
    expect(await screen.findByText('En iPad e iPhone todavía no se aplica: ahí la comanda sale como en el salón, con el empaque del negocio')).toBeTruthy()
  })

  it('canEdit=false: controles deshabilitados', async () => {
    renderEditor(channel(), false)
    await screen.findByRole('radio', { name: /Todo junto en: Barra/ })
    for (const r of screen.getAllByRole('radio')) expect((r as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('doble clic en Guardar (los dos en el mismo instante): una sola llamada', async () => {
    mockUpdateChannel.mockReturnValue(new Promise(() => {}))
    renderEditor()
    await screen.findByRole('radio', { name: /Todo junto en: Barra/ })
    const btn = screen.getByRole('button', { name: 'Guardar' })
    act(() => {
      btn.click()
      btn.click()
    })
    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalledTimes(1))
  })

  it('getPrinters falla: no dice «Sin impresora», avisa del error y Guardar queda apagado', async () => {
    mockGetPrinters.mockRejectedValue(new Error('boom'))
    renderEditor()
    expect(await screen.findByText('No se pudieron cargar las estaciones e impresoras.')).toBeTruthy()
    expect(screen.queryByText(/Sin impresora/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('getPrintStations falla: mensaje de error con Reintentar', async () => {
    mockGetStations.mockRejectedValue(new Error('boom'))
    renderEditor()
    expect(await screen.findByText('No se pudieron cargar las estaciones e impresoras.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('error del servidor: el aviso lleva su mensaje', async () => {
    mockUpdateChannel.mockRejectedValue({ response: { data: { message: 'La estación no existe' } } })
    renderEditor()
    await screen.findByRole('radio', { name: /Todo junto en: Barra/ })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'La estación no existe', variant: 'destructive' })),
    )
  })
})
