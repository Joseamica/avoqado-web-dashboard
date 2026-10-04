import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PassConnectionStatus, PassIntegrationsOverview } from '@/types/passes'

vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false, isResolved: true }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
const svc = vi.hoisted(() => ({ getPassVisitsSummary: vi.fn(), getPassIntegrationsOverview: vi.fn() }))
vi.mock('@/services/passes.service', () => svc)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { PassVisitsSummary } from '../PassVisitsSummary'

const ROWS = [
  { provider: 'TOTALPASS' as const, confirmed: 12, alreadyConfirmed: 1, expired: 2, rejected: 0, pending: 1, lateCancellations: 3 },
  { provider: 'WELLHUB' as const, confirmed: 0, alreadyConfirmed: 0, expired: 0, rejected: 0, pending: 0, lateCancellations: 0 },
]

// R2b-28: el reporte sólo muestra proveedores con conexión (status ≠ null), como el filtro de la lista (R2b-26).
const overview = (totalpass: PassConnectionStatus | null, wellhub: PassConnectionStatus | null = null): PassIntegrationsOverview => ({
  planActive: true,
  connections: (['TOTALPASS', 'WELLHUB'] as const).map(provider => ({
    provider,
    available: true,
    status: provider === 'TOTALPASS' ? totalpass : wellhub,
    externalPlaceName: null,
    confirmMode: 'AUTO' as const,
    lastError: null,
    plans: [],
    productLinks: [],
    updatedAt: null,
  })),
  classProducts: { items: [], total: 0 },
})

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PassVisitsSummary venueId="v1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // 1-feb 03:00 UTC = 31-ene 21:00 en CDMX: el mes por defecto tiene que ser ENERO (zona del venue, no UTC)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-02-01T03:00:00Z'))
  svc.getPassVisitsSummary.mockResolvedValue(ROWS)
  svc.getPassIntegrationsOverview.mockResolvedValue(overview('ACTIVE'))
})
afterEach(() => vi.useRealTimers())

describe('PassVisitsSummary', () => {
  // nuevo — el mes por defecto es el del venue, no el del navegador ni UTC
  it('arranca en el mes actual del venue y pide el resumen de ese mes', async () => {
    renderSummary()
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledWith('v1', '2030-01'))
    expect(screen.getByLabelText('summary.month')).toHaveValue('2030-01')
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText('summary.columns.expired')).toBeInTheDocument()
  })

  // nuevo — cambiar el mes vuelve a pedir
  it('cambiar el mes pide el resumen del mes elegido', async () => {
    renderSummary()
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('summary.month'), { target: { value: '2029-12' } })
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledWith('v1', '2029-12'))
    expect(screen.getByLabelText('summary.month')).toHaveValue('2029-12')
  })

  // El selector no ofrece meses futuros: ni en el selector (max) ni tecleándolos (se queda en el mes actual del venue).
  it('no ofrece meses futuros: max = mes actual del venue y uno futuro tecleado no se pide', async () => {
    renderSummary()
    const input = screen.getByLabelText('summary.month')
    expect(input).toHaveAttribute('max', '2030-01')
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: '2030-03' } })
    expect(input).toHaveValue('2030-01')
    expect(svc.getPassVisitsSummary).not.toHaveBeenCalledWith('v1', '2030-03')
    expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1)
  })

  // H6: un año a medias (Chrome dispara «change» por cada dígito: 0002, 0020, 0202…) no pega al server ni parpadea.
  it('sólo se pide un mes con año razonable (≥ 2020): min en el campo y cada dígito del año no dispara una petición', async () => {
    renderSummary()
    const input = screen.getByLabelText('summary.month')
    expect(input).toHaveAttribute('min', '2020-01')
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1))
    for (const partial of ['0002-01', '0020-01', '0202-01', '2019-12']) {
      fireEvent.change(input, { target: { value: partial } })
      expect(input).toHaveValue(partial) // se sigue tecleando
    }
    expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1)
    fireEvent.change(input, { target: { value: '2020-01' } })
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledWith('v1', '2020-01'))
    expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(2)
  })

  // H6: donde no hay selector nativo (Firefox, Safari de escritorio) el campo es de texto: se le dice el formato.
  it('el campo trae un placeholder con el formato (para los navegadores sin selector de mes)', () => {
    renderSummary()
    expect(screen.getByLabelText('summary.month')).toHaveAttribute('placeholder', 'summary.monthPlaceholder')
  })

  // H2: «Canceladas tarde» cuenta RESERVAS por el día en que se cancelaron, no visitas por día de check-in: se explica bajo la tabla.
  it('explica «Canceladas tarde» bajo la tabla', async () => {
    renderSummary()
    await screen.findByRole('table')
    expect(screen.getByText('summary.lateCancellationsNote')).toBeInTheDocument()
  })

  // Un campo vaciado o a medias no deja el reporte de un mes con otro mes escrito: al salir vuelve al mes que se está viendo.
  it('un mes incompleto o vacío no se pide y al salir del campo vuelve al mes mostrado', async () => {
    renderSummary()
    const input = screen.getByLabelText('summary.month')
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('')
    fireEvent.blur(input)
    expect(input).toHaveValue('2030-01')
    expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1)
  })

  // R2b-28: hoy sólo TotalPass tiene conexión ⇒ Wellhub no se pinta (ni en ceros).
  it('sólo muestra los proveedores con conexión: Wellhub sin conectar no sale en ceros', async () => {
    renderSummary()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('providers.TOTALPASS')).toBeInTheDocument()
    expect(within(table).queryByText('providers.WELLHUB')).not.toBeInTheDocument()
  })

  // R2b-28: cuando Wellhub se conecte, su fila aparece sola (el filtro sigue a la conexión, no está fijo en el código).
  it('con los dos conectados salen los dos, en el orden del server', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue(overview('ACTIVE', 'PAUSED'))
    renderSummary()
    const table = await screen.findByRole('table')
    expect(within(table).getByText('providers.TOTALPASS')).toBeInTheDocument()
    expect(within(table).getByText('providers.WELLHUB')).toBeInTheDocument()
  })

  // Una conexión revocada sigue siendo una conexión (status ≠ null): sus visitas del mes siguen contando para cuadrar el depósito.
  it('un proveedor con la conexión revocada sigue en el reporte', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue(overview('REVOKED'))
    renderSummary()
    expect(await within(await screen.findByRole('table')).findByText('providers.TOTALPASS')).toBeInTheDocument()
  })

  it('sin ningún proveedor conectado: mensaje en vez de una tabla vacía', async () => {
    svc.getPassIntegrationsOverview.mockResolvedValue(overview(null))
    renderSummary()
    expect(await screen.findByText('summary.empty')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // Mientras no llegan las dos consultas no se concluye nada (ni tabla vacía ni «ceros»).
  it('mientras carga: «Cargando», sin tabla ni mensaje de vacío', () => {
    svc.getPassVisitsSummary.mockReturnValue(new Promise(() => {}))
    renderSummary()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('summary.empty')).not.toBeInTheDocument()
  })

  // H4: con la vista general pendiente tampoco se concluye «no hay proveedor conectado».
  it('mientras la vista general está pendiente: «Cargando», sin mensaje de proveedor ni tabla', async () => {
    svc.getPassIntegrationsOverview.mockReturnValue(new Promise(() => {}))
    renderSummary()
    // El resumen YA respondió: sólo la vista general sigue en vuelo (si no, la prueba no distinguiría cuál de las dos espera).
    await waitFor(() => expect(svc.getPassVisitsSummary).toHaveBeenCalledTimes(1))
    await svc.getPassVisitsSummary.mock.results[0].value
    await act(async () => {})
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('summary.empty')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // nuevo — el error del server, tal cual
  it('si falla muestra el mensaje del servidor', async () => {
    svc.getPassVisitsSummary.mockRejectedValue({ response: { status: 400, data: { message: 'El mes va como AAAA-MM.' } } })
    renderSummary()
    // retry: 1 del hook ⇒ el error tarda ~1 s más que el límite por defecto de findByText (P2-14)
    expect(await screen.findByText('El mes va como AAAA-MM.', {}, { timeout: 5_000 })).toBeInTheDocument()
    expect(screen.getByText('summary.loadError')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // H1: la alerta de pantalla trae «Reintentar»: reintenta lo que falló y, si ya responde, aparece la tabla.
  it('si falla el resumen: «Reintentar» lo vuelve a pedir y aparece la tabla', async () => {
    const down = { response: { status: 500, data: { message: 'Se cayó la base' } } }
    // La carga y su único reintento (retry: 1) fallan; el clic ya encuentra al servidor arriba.
    svc.getPassVisitsSummary.mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(ROWS)
    renderSummary()
    const retry = await screen.findByRole('button', { name: 'common:retry' }, { timeout: 5_000 })
    fireEvent.click(retry)
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.queryByText('summary.loadError')).not.toBeInTheDocument()
    expect(svc.getPassIntegrationsOverview).toHaveBeenCalledTimes(1)
  })

  // Si no se pudo saber qué proveedores están conectados no se adivina (se mostraría Wellhub en ceros, o se esconderían cifras).
  it('si falla la vista general (sin datos): error del servidor y sin tabla', async () => {
    svc.getPassIntegrationsOverview.mockRejectedValue({ response: { status: 500, data: { message: 'Se cayó la base' } } })
    renderSummary()
    expect(await screen.findByText('Se cayó la base', {}, { timeout: 5_000 })).toBeInTheDocument()
    expect(screen.getByText('summary.loadError')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  // H1: la vista general NO se refresca sola (a diferencia del resumen): sin «Reintentar» la tarjeta quedaba muerta hasta recargar.
  it('si falla la vista general: «Reintentar» la vuelve a pedir y aparece la tabla', async () => {
    const down = { response: { status: 500, data: { message: 'Se cayó la base' } } }
    svc.getPassIntegrationsOverview.mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(overview('ACTIVE'))
    renderSummary()
    fireEvent.click(await screen.findByRole('button', { name: 'common:retry' }, { timeout: 5_000 }))
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common:retry' })).not.toBeInTheDocument()
  })

  // R2b-25/H1: un refresco que falla con cifras ya cargadas no las tapa: aviso en línea y las cifras se quedan.
  it('un refresco fallido conserva las cifras y avisa en línea (sin el error de pantalla)', async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2030-02-01T03:00:00Z') })
    svc.getPassVisitsSummary
      .mockResolvedValueOnce(ROWS)
      .mockRejectedValue({ response: { status: 500, data: { message: 'Se cayó la base' } } })
    renderSummary()
    expect(await screen.findByText('12')).toBeInTheDocument()
    // El refresco de 30 s falla, y también su único reintento (retry: 1).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(await screen.findByText('summary.refreshError')).toBeInTheDocument()
    expect(screen.getByText('Se cayó la base')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText('summary.loadError')).not.toBeInTheDocument()
    // H7: el título del Alert recorta a una línea (line-clamp-1): la frase larga va en la descripción para leerse completa en celular.
    expect(screen.getByText('summary.refreshError').closest('[data-slot="alert-title"]')).toBeNull()
  })

  // Las vencidas son los cobros perdidos: se distinguen cuando hay alguna. El rojo va en un hijo de la celda y NO en el
  // <td>: en oscuro `.dark td { color }` (theme.css, sin capa) le gana a cualquier text-* puesto en el <td> (R2b-35).
  it('resalta «vencidas» sólo cuando hay (> 0), con el color dentro de la celda', async () => {
    svc.getPassVisitsSummary.mockResolvedValue([{ ...ROWS[0], expired: 0 }])
    const { unmount } = renderSummary()
    const calm = (await screen.findByText('12')).closest('tr')!
    expect(calm.querySelectorAll('.text-destructive')).toHaveLength(0)
    unmount()
    svc.getPassVisitsSummary.mockResolvedValue([ROWS[0]])
    renderSummary()
    const row = (await screen.findByText('12')).closest('tr')!
    const flagged = row.querySelectorAll('.text-destructive')
    expect(flagged).toHaveLength(1)
    expect(flagged[0].tagName).not.toBe('TD')
    expect(flagged[0]).toHaveTextContent(/^2$/)
  })
})
