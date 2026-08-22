// src/pages/Delivery/components/ChannelSettingsDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeliveryChannelLink, DeliveryWeeklyHours } from '@/types/delivery'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

// t devuelve la llave tal cual para poder afirmar sobre llaves i18n (convención del repo).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const mockUpdateChannel = vi.fn()
vi.mock('@/services/delivery.service', () => ({
  updateChannel: (...args: unknown[]) => mockUpdateChannel(...args),
}))

import { ChannelSettingsDialog } from './ChannelSettingsDialog'

const HORARIO_GUARDADO: DeliveryWeeklyHours = {
  monday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  tuesday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  wednesday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  thursday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  friday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  saturday: { enabled: true, ranges: [{ open: '11:00', close: '23:00' }] },
  sunday: { enabled: false, ranges: [] },
}

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

function renderDialog(ch: DeliveryChannelLink) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ChannelSettingsDialog open onClose={vi.fn()} venueId="venue-1" channel={ch} />
    </QueryClientProvider>,
  )
}

describe('ChannelSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateChannel.mockResolvedValue(channel())
  })

  // ── El bug que originó la pantalla ────────────────────────────────────────────────
  // `deliveryHours` y `precios` viven en la MISMA columna JSON. Si el formulario mandara
  // sólo el horario, el margen del comercio desaparecería — y el margen es lo único que
  // evita perder dinero en cada pedido, porque el marketplace se queda ~30%. No falla, no
  // avisa: simplemente deja de cobrar de más.
  it('manda el horario Y el margen juntos — guardar el horario NO deja fuera el margen', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO, precios: { markupPercent: 30 } } }))

    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    const [, , body] = mockUpdateChannel.mock.calls[0]
    expect(body.config.precios).toEqual({ markupPercent: 30 })
    expect(body.config.deliveryHours).toEqual(HORARIO_GUARDADO)
  })

  it('borrar el campo de margen manda `precios: {}` — omitirlo dejaría vivo el markup viejo', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO, precios: { markupPercent: 30 } } }))

    fireEvent.change(screen.getByLabelText('settings.markupTitle'), { target: { value: '' } })
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    expect(mockUpdateChannel.mock.calls[0][2].config.precios).toEqual({})
  })

  // ── El input numérico no debe atrapar al usuario ──────────────────────────────────
  // Un `parseFloat(x) || 0` hace que al borrar el campo el valor rebote a 0 y no se pueda
  // vaciar. Regla obligatoria de `ui-patterns.md`.
  it('el campo de margen se puede dejar vacío (no rebota a 0)', () => {
    renderDialog(channel({ config: { precios: { markupPercent: 30 } } }))
    const input = screen.getByLabelText('settings.markupTitle') as HTMLInputElement

    expect(input.value).toBe('30')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('avisa que el horario es un ESTIMADO cuando nadie lo configuró', () => {
    renderDialog(channel({ config: { precios: { markupPercent: 30 } } }))
    expect(screen.getByText('settings.hoursEstimated')).toBeInTheDocument()
  })

  it('no avisa de estimado cuando el horario SÍ está configurado', () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))
    expect(screen.queryByText('settings.hoursEstimated')).not.toBeInTheDocument()
  })

  // ── Bloquear antes de guardar, no después ─────────────────────────────────────────
  // El backend rechaza el horario inválido, pero un error de servidor sale lejos del campo
  // que lo causó. El usuario tiene que ver QUÉ día está mal mientras lo puede corregir.
  it('bloquea guardar si un día tiene la hora de cierre antes de la de apertura', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    // `getAllBy…`: el `t` mockeado devuelve la llave sin interpolar, así que los 6 días
    // comparten la misma etiqueta. El primero es lunes.
    fireEvent.change(screen.getAllByLabelText('settings.opensAt')[0], { target: { value: '23:00' } })

    await waitFor(() => expect(screen.getByText('settings.errorCloseBeforeOpen')).toBeInTheDocument())
    expect((screen.getByText('settings.save').closest('button') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('settings.save'))
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('bloquea guardar con un margen fuera de rango (500%)', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.change(screen.getByLabelText('settings.markupTitle'), { target: { value: '500' } })

    await waitFor(() => expect(screen.getByText('settings.errorMarkupRange')).toBeInTheDocument())
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('apagar un día lo manda cerrado, no con un rango vacío', async () => {
    renderDialog(channel({ config: { deliveryHours: HORARIO_GUARDADO } }))

    fireEvent.click(screen.getByLabelText('settings.day.monday'))
    fireEvent.click(screen.getByText('settings.save'))

    await waitFor(() => expect(mockUpdateChannel).toHaveBeenCalled())
    expect(mockUpdateChannel.mock.calls[0][2].config.deliveryHours.monday.enabled).toBe(false)
  })
})
