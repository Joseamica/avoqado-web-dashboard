import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, o?: Record<string, string>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', venueSlug: 'taqueria', fullBasePath: '/venues/taqueria' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => `T(${d})` }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/pages/Reservations/components/OperatingHoursEditor', () => ({
  OperatingHoursEditor: () => <div data-testid="hours-editor" />,
}))
vi.mock('qrcode.react', () => ({ QRCodeCanvas: ({ value }: { value: string }) => <canvas data-testid="qr" data-value={value} /> }))

const getSettings = vi.fn()
const updateSettings = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return { ...actual, getSettings: (...a: unknown[]) => getSettings(...a), updateSettings: (...a: unknown[]) => updateSettings(...a) }
})

import { SettingsTab } from '../components/SettingsTab'

const base = (over: Record<string, unknown> = {}) => ({
  enabled: false,
  minOrderAmount: 50,
  defaultPrepMinutes: 20,
  acceptsPayAtPickup: true,
  manualPause: false,
  pausedUntil: null,
  hours: null,
  lastInboxPollAt: null,
  store: { status: 'DISABLED', reason: 'NOT_ENABLED', pausedUntil: null, manualPause: false },
  requirements: { address: true, phone: true, privacyNotice: true },
  ...over,
})

// La forma REAL del PUT de hoy: los ajustes, SIN `store` ni `requirements` (sólo el GET los trae).
const putToday = (over: Record<string, unknown> = {}) => {
  const { store: _store, requirements: _requirements, ...rest } = base(over)
  return rest
}

const renderTab = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsTab />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsTab', () => {
  beforeEach(() => {
    getSettings.mockReset()
    updateSettings.mockReset()
    toast.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rehidrata el formulario y Guardar empieza deshabilitado', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    expect(await screen.findByLabelText('settings.minOrder')).toHaveValue(50)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    expect(screen.queryByTestId('hours-editor')).toBeNull()
  })

  it('pausada por muchos pedidos (TOO_BUSY) no dice «Pausada desde Configuración»', async () => {
    getSettings.mockResolvedValue(base({ enabled: true, store: { status: 'PAUSED', reason: 'TOO_BUSY', pausedUntil: null, manualPause: false } }))
    renderTab()
    expect(await screen.findByText('settings.status.pausedBusy')).toBeInTheDocument()
    expect(screen.queryByText('settings.status.pausedManual')).toBeNull()
  })

  it('guardar manda sólo lo cambiado', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockResolvedValue(base({ minOrderAmount: 80 }))
    renderTab()
    const input = await screen.findByLabelText('settings.minOrder')
    fireEvent.change(input, { target: { value: '80' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { minOrderAmount: 80 }))
  })

  it('🔴 guardar con la respuesta REAL del PUT (sin store ni requirements) no tira la pestaña y vuelve a pedir el GET', async () => {
    getSettings.mockResolvedValueOnce(base()).mockResolvedValue(base({ minOrderAmount: 80 }))
    updateSettings.mockResolvedValue(putToday({ minOrderAmount: 80 }))
    renderTab()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '80' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    expect(toast).toHaveBeenCalledWith({ title: 'settings.saved' })
    // La pestaña sigue en pie: estado de la tienda, formulario con lo guardado y Guardar otra vez apagado.
    expect(await screen.findByText('settings.status.DISABLED|DISABLED')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.minOrder')).toHaveValue(80)
    await waitFor(() => expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled())
  })

  it('guardar con la respuesta COMPLETA del PUT (con store y requirements) también deja la pestaña en pie', async () => {
    const open = { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false }
    getSettings.mockResolvedValueOnce(base()).mockResolvedValue(base({ enabled: true, store: open }))
    updateSettings.mockResolvedValue(base({ enabled: true, store: open }))
    renderTab()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.status.OPEN|OPEN')).toBeInTheDocument()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
  })

  it('si el servidor llega a contestar sin store, la pestaña no truena', async () => {
    getSettings.mockResolvedValue(putToday())
    renderTab()
    expect(await screen.findByLabelText('settings.minOrder')).toHaveValue(50)
    expect(screen.getByText('settings.status.label', { exact: false })).toBeInTheDocument()
  })

  it('pedido mínimo vacío no manda 0', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockResolvedValue(base({ defaultPrepMinutes: 20, manualPause: true }))
    renderTab()
    const input = await screen.findByLabelText('settings.minOrder')
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue(null)
    await userEvent.click(screen.getByRole('switch', { name: 'settings.manualPause' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalled())
    expect(updateSettings.mock.calls[0][1]).toEqual({ manualPause: true })
  })

  it('pedido mínimo fuera de rango muestra el error y no llama updateSettings', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '200000' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.minOrderErrors.range')).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('pedido mínimo con 3 decimales muestra error de decimales', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '80.555' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.minOrderErrors.decimals')).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('vaciar el mínimo sin otro cambio deja Guardar deshabilitado', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
  })

  it('con phone:false «Encender» está deshabilitado y se ve la liga del faltante', async () => {
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: false, privacyNotice: true } }))
    renderTab()
    expect(await screen.findByRole('switch', { name: 'settings.enable' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'settings.requirements.phone.link' })).toHaveAttribute('href', '/venues/taqueria/settings/local/basic-info')
    expect(screen.queryByText('settings.requirements.address.label')).toBeNull()
  })

  it('aviso de privacidad faltante liga a Clientes', async () => {
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
    renderTab()
    expect(await screen.findByRole('link', { name: 'settings.requirements.privacyNotice.link' })).toHaveAttribute('href', '/venues/taqueria/customers')
  })

  it('STORE_REQUIREMENTS_MISSING pinta la lista que manda el servidor', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({ response: { data: { code: 'STORE_REQUIREMENTS_MISSING', details: { missing: ['privacyNotice'] } } } })
    renderTab()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByRole('link', { name: 'settings.requirements.privacyNotice.link' })).toBeInTheDocument()
  })

  it('NO_PAYMENT_MODE muestra el mensaje del servidor', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({ response: { data: { code: 'NO_PAYMENT_MODE', message: 'Activa un modo de pago' } } })
    renderTab()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('Activa un modo de pago')).toBeInTheDocument()
  })

  it('«Usar horario» muestra el editor y un 09:00–09:00 bloquea guardar; apagar manda hours:null', async () => {
    const week = Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => [d, { enabled: true, ranges: [{ open: '09:00', close: '09:00' }] }]),
    )
    getSettings.mockResolvedValue(base({ enabled: true, hours: week }))
    updateSettings.mockResolvedValue(base({ enabled: true, hours: null }))
    renderTab()
    expect(await screen.findByTestId('hours-editor')).toBeInTheDocument()
    expect(screen.getByText('settings.hours.errors.sameTime')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.hours.use' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { hours: null }))
  })

  it('compartir: liga, snippet de script (sin iframe) y QR con el slug', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    const link = 'https://pedidos.avoqado.io/taqueria'
    expect(await screen.findByDisplayValue(link)).toBeInTheDocument()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', link)
    const snippet = screen.getByTestId('widget-snippet').textContent ?? ''
    expect(snippet).toContain('<script src="https://cdn.avoqado.io/widget.js" defer></script>')
    expect(snippet).toContain('<avoqado-order venue="taqueria"></avoqado-order>')
    expect(snippet).not.toContain('<iframe')
    expect(screen.getByTitle('settings.share.previewTitle')).toHaveAttribute('src', link)
  })

  // ── Ronda final · D3 (+ ronda 1): la vista previa sólo en los orígenes que la tienda deja enmarcar ──
  // La lista debe coincidir con `frame-ancestors` de `avoqado-booking-widget/public/_headers`.
  const openedFrom = (origin: string) => {
    const url = new URL(origin)
    vi.stubGlobal('location', { ...window.location, origin: url.origin, hostname: url.hostname, href: `${url.origin}/` })
  }

  it.each([
    'https://dashboard.avoqado.io',
    'https://dashboardv2.avoqado.io',
    'https://demo.dashboard.avoqado.io',
    'https://staging.dashboard.avoqado.io',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
  ])('la vista previa (iframe) se ve desde %s', async origin => {
    openedFrom(origin)
    getSettings.mockResolvedValue(base())
    renderTab()
    expect(await screen.findByTitle('settings.share.previewTitle')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'settings.share.openInTab' })).toBeNull()
  })

  it.each(['https://otro.example.com', 'https://dashboard.avoqado.io.evil.example', 'http://dashboard.avoqado.io'])(
    '🔴 desde %s (origen que la tienda no deja enmarcar) no hay iframe: hay una liga «Abrir la tienda en otra pestaña»',
    async origin => {
      openedFrom(origin)
      getSettings.mockResolvedValue(base())
      renderTab()
      const link = await screen.findByRole('link', { name: 'settings.share.openInTab' })
      expect(link).toHaveAttribute('href', 'https://pedidos.avoqado.io/taqueria')
      expect(link).toHaveAttribute('target', '_blank')
      expect(screen.queryByTitle('settings.share.previewTitle')).toBeNull()
    },
  )

  // ── Ronda 1 de la revisión · D1: un refetch fallido tras guardar no tumba la pestaña ──
  it('🔴 si la recarga tras guardar falla, la pestaña sigue en pie con los datos guardados', async () => {
    getSettings.mockResolvedValueOnce(base()).mockRejectedValue(new Error('Network Error'))
    updateSettings.mockResolvedValue(putToday({ minOrderAmount: 80 }))
    renderTab()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '80' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    expect(toast).toHaveBeenCalledWith({ title: 'settings.saved' })
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByText('settings.loadFailed')).toBeNull()
    expect(screen.getByLabelText('settings.minOrder')).toHaveValue(80)
  })

  it('si NUNCA hubo datos y el GET falla, sí dice «No se pudo cargar»', async () => {
    getSettings.mockRejectedValue(new Error('Network Error'))
    renderTab()
    expect(await screen.findByText('settings.loadFailed')).toBeInTheDocument()
  })
})
