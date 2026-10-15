import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCustomerDisplay, type CustomerDisplayFicha, type CustomerDisplayView } from '@/services/customerDisplay.service'
import { DEFAULT_TPV_SETTINGS, tpvSettingsService } from '@/services/tpv-settings.service'
import { CustomerDisplayCard } from '../CustomerDisplayCard'
import { DISENO_DE_FABRICA } from '../model'

const permisos = new Set<string>()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => permisos.has(p) }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => `dt(${d})` }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/services/customerDisplay.service', () => ({ getCustomerDisplay: vi.fn() }))
vi.mock('@/services/tpv-settings.service', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/tpv-settings.service')>()
  return { ...real, tpvSettingsService: { getSettings: vi.fn(), updateSettings: vi.fn() } }
})
// El editor y la copia tienen sus propias pruebas: aquí importa CUÁNDO se abren, QUÉ reciben y que al cerrar se DESMONTAN.
vi.mock('../CustomerDisplayEditor', () => ({
  CustomerDisplayEditor: (p: { pasosConocidos: boolean; onClose: () => void }) => (
    <div data-testid="editor-abierto" data-pasos-conocidos={String(p.pasosConocidos)}>
      <button type="button" onClick={p.onClose}>
        cerrar-editor
      </button>
    </div>
  ),
}))
vi.mock('../CopyDesignDialog', () => ({
  CopyDesignDialog: (p: { source: { editToken: string }; tokenVigente: string; onClose: () => void }) => (
    <div data-testid="copia-abierta" data-origen={p.source.editToken} data-vigente={p.tokenVigente}>
      <button type="button" onClick={p.onClose}>
        cerrar-copia
      </button>
    </div>
  ),
}))

// 🔴 Tipado, sin `as const` (Codex #13: un `slides` de sólo lectura no cabe en `CustomerDisplayFicha`, TS2322).
const FICHA: CustomerDisplayFicha = {
  schemaVersion: 1, fingerprint: 'fp-vigente', theme: 'LIGHT', accent: { custom: false }, logo: null, welcomeText: null, thanksText: null,
  slides: [], slideSeconds: 8, promotionCards: { enabled: false }, poweredBy: true,
}
function vista(extra: Partial<CustomerDisplayView> = {}, device: Partial<CustomerDisplayView['device']> = {}): CustomerDisplayView {
  return {
    terminal: { id: 't1', name: 'Caja 1' }, editToken: 'factory', design: { ...DISENO_DE_FABRICA }, ficha: FICHA,
    entitlements: { slides: false, promotionCards: false }, assetRejected: [],
    device: { presence: 'SUPPORTED', stale: false, capabilitiesObservedAt: '2026-10-14T19:00:00.000Z', lastHeartbeat: new Date().toISOString(), designVersion: 1, ack: null, installationWarning: false, ...device },
    ...extra,
  }
}
const CLAVE = ['customer-display', 'v1', 't1']
const FALLA = { response: { status: 500, data: { message: 'Ocurrió un error inesperado en el servidor.' } } }
function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CustomerDisplayCard venueId="v1" terminalId="t1" deviceName="Caja 1" venueName="Testarudo" />
    </QueryClientProvider>,
  )
  return { qc }
}

beforeEach(() => {
  permisos.clear()
  toast.mockClear()
  vi.mocked(getCustomerDisplay).mockReset()
  vi.mocked(tpvSettingsService.getSettings).mockReset()
  vi.mocked(tpvSettingsService.getSettings).mockResolvedValue({ ...DEFAULT_TPV_SETTINGS })
})

describe('CustomerDisplayCard', () => {
  it('sin customer-display:read: se explica y NO se consulta el diseño', () => {
    pintar()
    expect(screen.getByText('card.noReadPermission')).toBeInTheDocument()
    expect(getCustomerDisplay).not.toHaveBeenCalled()
  })

  it('sólo lectura: estado visible, sin botones de editar ni copiar', async () => {
    permisos.add('customer-display:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    pintar()
    expect(await screen.findByText('card.designFactory')).toBeInTheDocument()
    expect(screen.getByText('status.noAck')).toBeInTheDocument()
    expect(screen.getByText('card.readOnly')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'card.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'card.copy' })).not.toBeInTheDocument()
  })

  it('histórico con la hora del SERVIDOR y presente por separado', async () => {
    permisos.add('customer-display:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vista({ design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' } }, { ack: { fingerprint: 'fp-vigente', receivedAt: '2026-10-14T20:02:00.000Z', storedAt: '2026-10-14T20:01:58.000Z', shownAt: '2026-10-14T20:01:59.000Z', imagesPending: 2 } }),
    )
    pintar()
    expect(await screen.findByText('card.designOwn')).toBeInTheDocument()
    expect(screen.getByText(/status\.shown \{"date":"dt\(2026-10-14T20:02:00\.000Z\)"\} status\.imagesPending \{"count":2\}/)).toBeInTheDocument()
    expect(screen.getByText(/^status\.heartbeat /)).toBeInTheDocument()
    expect(screen.getByText('status.displayDetected {"date":"dt(2026-10-14T19:00:00.000Z)"}')).toBeInTheDocument()
  })

  it('una app que no entiende diseños lo dice; una segunda pantalla ausente también', async () => {
    permisos.add('customer-display:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista({}, { designVersion: null, presence: 'UNSUPPORTED' }))
    pintar()
    expect(await screen.findByText('status.appWithoutDesigns')).toBeInTheDocument()
    expect(screen.getByText('status.displayAbsent')).toBeInTheDocument()
  })

  it('«Actualizar estado» relee en el momento y enseña lo nuevo', async () => {
    permisos.add('customer-display:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    const user = userEvent.setup()
    pintar()
    await screen.findByText('status.noAck')
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vista({}, { ack: { fingerprint: 'fp-vigente', receivedAt: '2026-10-14T20:02:00.000Z', storedAt: '2026-10-14T20:01:58.000Z', shownAt: '2026-10-14T20:01:59.000Z' } }),
    )
    await user.click(screen.getByRole('button', { name: 'status.refresh' }))
    expect(await screen.findByText('status.shown {"date":"dt(2026-10-14T20:02:00.000Z)"}')).toBeInTheDocument()
  })

  it('🔴 una reconsulta que FALLA con el editor abierto no lo desmonta: el borrador sigue y se avisa (Codex #3)', async () => {
    permisos.add('customer-display:read').add('customer-display:update')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    const user = userEvent.setup()
    const { qc } = pintar()
    await user.click(await screen.findByRole('button', { name: 'card.edit' }))
    vi.mocked(getCustomerDisplay).mockRejectedValue(FALLA)
    await act(async () => {
      await qc.refetchQueries({ queryKey: CLAVE })
    })
    expect(await screen.findByText('status.refreshError', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByTestId('editor-abierto')).toBeInTheDocument()
    expect(screen.queryByText('card.loadError')).not.toBeInTheDocument()
  })

  it('con permiso de cambiar: «Editar pantalla» abre el editor y le dice que los pasos son conocidos', async () => {
    permisos.add('customer-display:read').add('customer-display:update').add('tpv-settings:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'card.edit' }))
    await waitFor(() => expect(screen.getByTestId('editor-abierto')).toHaveAttribute('data-pasos-conocidos', 'true'))
  })

  it('cerrar el editor lo DESMONTA (su salida retenida depende de eso) y se puede volver a abrir', async () => {
    permisos.add('customer-display:read').add('customer-display:update')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'card.edit' }))
    await user.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    expect(screen.queryByTestId('editor-abierto')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'card.edit' }))
    expect(screen.getByTestId('editor-abierto')).toBeInTheDocument()
  })

  it('🔴 si los pasos no se pudieron leer, el editor lo sabe y no los presenta como conocidos (Codex #4)', async () => {
    permisos.add('customer-display:read').add('customer-display:update').add('tpv-settings:read')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    vi.mocked(tpvSettingsService.getSettings).mockRejectedValue(new Error('Network Error'))
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'card.edit' }))
    await waitFor(() => expect(screen.getByTestId('editor-abierto')).toHaveAttribute('data-pasos-conocidos', 'false'), { timeout: 4000 })
  })

  it('copiar un diseño de fábrica se explica en vez de abrir la lista', async () => {
    permisos.add('customer-display:read').add('customer-display:update')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'card.copy' }))
    expect(toast).toHaveBeenCalledWith({ title: 'card.copyNeedsDesign' })
    expect(screen.queryByTestId('copia-abierta')).not.toBeInTheDocument()
  })

  it('🔴 la copia recibe la FOTO del origen al abrir y, aparte, el token vigente (Codex #8)', async () => {
    permisos.add('customer-display:read').add('customer-display:update')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista({ editToken: 'd1:2', design: { ...DISENO_DE_FABRICA, theme: 'DARK' } }))
    const user = userEvent.setup()
    const { qc } = pintar()
    await user.click(await screen.findByRole('button', { name: 'card.copy' }))
    expect(screen.getByTestId('copia-abierta')).toHaveAttribute('data-origen', 'd1:2')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista({ editToken: 'd1:3', design: { ...DISENO_DE_FABRICA, welcomeText: 'Otro' } }))
    await act(async () => {
      await qc.refetchQueries({ queryKey: CLAVE })
    })
    await waitFor(() => expect(screen.getByTestId('copia-abierta')).toHaveAttribute('data-vigente', 'd1:3'))
    expect(screen.getByTestId('copia-abierta')).toHaveAttribute('data-origen', 'd1:2')
  })

  it('🔴 cerrar la copia la DESMONTA: al reabrir tras un cambio del origen, la foto nueva es la del token NUEVO', async () => {
    permisos.add('customer-display:read').add('customer-display:update')
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista({ editToken: 'd1:2', design: { ...DISENO_DE_FABRICA, theme: 'DARK' } }))
    const user = userEvent.setup()
    const { qc } = pintar()
    await user.click(await screen.findByRole('button', { name: 'card.copy' }))
    await user.click(screen.getByRole('button', { name: 'cerrar-copia' }))
    expect(screen.queryByTestId('copia-abierta')).not.toBeInTheDocument()
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista({ editToken: 'd1:3', design: { ...DISENO_DE_FABRICA, welcomeText: 'Otro' } }))
    await act(async () => {
      await qc.refetchQueries({ queryKey: CLAVE })
    })
    await user.click(screen.getByRole('button', { name: 'card.copy' }))
    expect(screen.getByTestId('copia-abierta')).toHaveAttribute('data-origen', 'd1:3')
    expect(screen.getByTestId('copia-abierta')).toHaveAttribute('data-vigente', 'd1:3')
  })

  it('si el servidor falla SIN datos previos: se dice (no se ve como «de fábrica») y se puede reintentar', async () => {
    permisos.add('customer-display:read')
    vi.mocked(getCustomerDisplay).mockRejectedValue(FALLA)
    pintar()
    expect(await screen.findByText('card.loadError', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText('card.designFactory')).not.toBeInTheDocument()
    vi.mocked(getCustomerDisplay).mockResolvedValue(vista())
    await userEvent.setup().click(screen.getByRole('button', { name: 'card.retry' }))
    expect(await screen.findByText('card.designFactory', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})
