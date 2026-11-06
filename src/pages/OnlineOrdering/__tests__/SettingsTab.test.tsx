import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, string>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', venueSlug: 'taqueria', fullBasePath: '/venues/taqueria' }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => `T(${d})` }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/pages/Reservations/components/OperatingHoursEditor', () => ({
  OperatingHoursEditor: () => <div data-testid="hours-editor" />,
}))
vi.mock('qrcode.react', () => ({ QRCodeCanvas: ({ value }: { value: string }) => <canvas data-testid="qr" data-value={value} /> }))
const access = { denied: [] as string[], role: 'ADMIN' }
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => !access.denied.includes(p), canAny: () => true, canAll: () => true, role: access.role }),
}))
// El editor es el MISMO de Clientes y tiene sus propias pruebas: aquí sólo importa que se abra con el negocio y qué pasa al cerrarlo.
// `sigueMontado` imita la animación de salida de Radix (300 ms en el navegador): el editor sigue en el DOM tras cerrarse.
const editor = { sigueMontado: false }
vi.mock('@/pages/Customers/components/PrivacyNoticeModal', () => ({
  PrivacyNoticeModal: ({ venueId, open, onClose }: { venueId: string; open: boolean; onClose: () => void }) =>
    open || editor.sigueMontado ? (
      <div role="dialog" aria-label="editor-del-aviso" data-venue-id={venueId}>
        <button type="button" onClick={onClose}>
          cerrar-editor
        </button>
      </div>
    ) : null,
}))

const getSettings = vi.fn()
const updateSettings = vi.fn()
const getToPay = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return {
    ...actual,
    getSettings: (...a: unknown[]) => getSettings(...a),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
    getToPay: (...a: unknown[]) => getToPay(...a),
  }
})

import { SettingsTab } from '../components/SettingsTab'

const base = (over: Record<string, unknown> = {}) => ({
  enabled: false,
  minOrderAmount: 50,
  defaultPrepMinutes: 20,
  acceptsPayAtPickup: true,
  acceptsCardOnline: false,
  card: { enabled: false, merchantStatus: 'NOT_CONNECTED' },
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

/**
 * Espera a que el formulario tenga lo que mandó el servidor. Va después de CADA `renderTab()` que carga datos.
 * `values` de react-hook-form se copia en un EFECTO (`useForm`, 7.66), así que el primer render con datos todavía trae el
 * formulario vacío: interruptores apagados, «Encender» bloqueado y el mínimo sin número. En una máquina lenta la prueba
 * alcanzaba a mirar ese cuadro (CI del 21-oct: dos pruebas distintas en rojo), y «pedido mínimo vacío» pasaba sin probar
 * nada porque vaciaba un campo que todavía estaba vacío.
 * 🔴 No se «arregla» escondiendo ese primer cuadro (esqueleto hasta que cargue): el Controller del mínimo se monta en él y se
 * queda con «vacío» como respaldo, y eso es lo que deja borrar el número; montado ya con 50, al borrarlo vuelve el 50.
 */
const formularioCargado = () => waitFor(() => expect(screen.getByLabelText('settings.minOrder')).not.toHaveValue(null))

/** El renglón de un paso de la lista («Antes de encender la tienda»). */
const paso = (r: string) => screen.getByText(`settings.requirements.${r}.label`).closest('li') as HTMLElement

describe('SettingsTab', () => {
  beforeEach(() => {
    getSettings.mockReset()
    updateSettings.mockReset()
    getToPay.mockReset()
    toast.mockReset()
    access.denied = []
    access.role = 'ADMIN'
    editor.sigueMontado = false
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rehidrata el formulario y Guardar empieza deshabilitado', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    expect(screen.getByLabelText('settings.minOrder')).toHaveValue(50)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    expect(screen.queryByTestId('hours-editor')).toBeNull()
  })

  it('pausada por muchos pedidos (TOO_BUSY) no dice «Pausada desde Configuración»', async () => {
    getSettings.mockResolvedValue(
      base({ enabled: true, store: { status: 'PAUSED', reason: 'TOO_BUSY', pausedUntil: null, manualPause: false } }),
    )
    renderTab()
    await formularioCargado()
    expect(await screen.findByText('settings.status.pausedBusy')).toBeInTheDocument()
    expect(screen.queryByText('settings.status.pausedManual')).toBeNull()
  })

  it('guardar manda sólo lo cambiado', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockResolvedValue(base({ minOrderAmount: 80 }))
    renderTab()
    await formularioCargado()
    const input = await screen.findByLabelText('settings.minOrder')
    fireEvent.change(input, { target: { value: '80' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { minOrderAmount: 80 }))
  })

  it('🔴 guardar con la respuesta REAL del PUT (sin store ni requirements) no tira la pestaña y vuelve a pedir el GET', async () => {
    getSettings.mockResolvedValueOnce(base()).mockResolvedValue(base({ minOrderAmount: 80 }))
    updateSettings.mockResolvedValue(putToday({ minOrderAmount: 80 }))
    renderTab()
    await formularioCargado()
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
    await formularioCargado()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.status.OPEN|OPEN')).toBeInTheDocument()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
  })

  it('si el servidor llega a contestar sin store, la pestaña no truena', async () => {
    getSettings.mockResolvedValue(putToday())
    renderTab()
    await formularioCargado()
    expect(screen.getByLabelText('settings.minOrder')).toHaveValue(50)
    expect(screen.getByText('settings.status.label', { exact: false })).toBeInTheDocument()
    // Sin `requirements` no se sabe qué falta: no se inventa un «Todo listo» con tres ✅.
    expect(screen.queryByText('settings.requirements.allSet')).toBeNull()
    expect(screen.queryByText('settings.requirements.title')).toBeNull()
  })

  it('pedido mínimo vacío no manda 0', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockResolvedValue(base({ defaultPrepMinutes: 20, manualPause: true }))
    renderTab()
    await formularioCargado()
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
    await formularioCargado()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '200000' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.minOrderErrors.range')).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('pedido mínimo con 3 decimales muestra error de decimales', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '80.555' } })
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('settings.minOrderErrors.decimals')).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('vaciar el mínimo sin otro cambio deja Guardar deshabilitado', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    fireEvent.change(await screen.findByLabelText('settings.minOrder'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
  })

  // ── Lista de pasos para encender la tienda (aviso de privacidad sin salir de Pedidos en línea, 20-oct) ──
  it('lista de pasos con lo que falta: domicilio ✅, teléfono ⬜ con su liga, aviso ✅; «Encender» deshabilitado', async () => {
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    expect(await screen.findByRole('switch', { name: 'settings.enable' })).toBeDisabled()
    expect(screen.getByText('settings.enableBlocked')).toBeInTheDocument()
    expect(screen.getByText('settings.requirements.title')).toBeInTheDocument()
    expect(within(paso('address')).getByText('settings.requirements.done')).toBeInTheDocument()
    expect(within(paso('address')).queryByRole('link')).toBeNull()
    expect(within(paso('phone')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(within(paso('phone')).getByRole('link', { name: 'settings.requirements.phone.link' })).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.done')).toBeInTheDocument()
    expect(within(paso('privacyNotice')).queryByRole('button')).toBeNull()
  })

  it('cada dato faltante liga a la pestaña donde se captura: domicilio → Información básica, teléfono → Contacto e Imágenes', async () => {
    getSettings.mockResolvedValue(base({ requirements: { address: false, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    await screen.findByRole('switch', { name: 'settings.enable' })
    expect(within(paso('address')).getByRole('link', { name: 'settings.requirements.address.link' })).toHaveAttribute(
      'href',
      '/venues/taqueria/settings/local/basic-info',
    )
    expect(within(paso('phone')).getByRole('link', { name: 'settings.requirements.phone.link' })).toHaveAttribute(
      'href',
      '/venues/taqueria/settings/local/contact-images',
    )
  })

  it('con todo listo y la tienda apagada la lista sigue: cuatro ✅ (con la forma de cobro) y «Todo listo», y «Encender» se puede usar', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    expect(await screen.findByRole('switch', { name: 'settings.enable' })).toBeEnabled()
    expect(screen.getByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(screen.queryByText('settings.requirements.title')).toBeNull()
    expect(screen.queryByText(/settings\.requirements\.payment\.hint/)).toBeNull()
    for (const r of ['address', 'phone', 'privacyNotice', 'payment']) {
      expect(within(paso(r)).getByText('settings.requirements.done')).toBeInTheDocument()
      expect(within(paso(r)).queryByRole('link')).toBeNull()
      expect(within(paso(r)).queryByRole('button')).toBeNull()
      // `text-success` no se genera (el @theme no registra --color-success): el verde va por la variable `--success`.
      expect(paso(r).querySelector('svg')).toHaveClass('text-(--success)')
    }
    expect(screen.getByText('settings.enableHelp')).toBeInTheDocument()
    // Un aviso cortés (status), no una alarma (alert) en cada visita; y la lista se anuncia como lista aunque no lleve viñetas.
    expect(within(screen.getByRole('status')).getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('settings.requirements.allSet')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // ── El botón de «Todo listo»: el interruptor apagado casi no se veía en tema oscuro ──
  const botonEncender = () => within(screen.getByRole('status')).queryByRole('button', { name: 'settings.enable' })

  it('con todo listo, «Encender la tienda» prende y guarda por el mismo camino: un PUT, su aviso, y el foco pasa al interruptor', async () => {
    getSettings.mockResolvedValueOnce(base())
    getSettings.mockResolvedValue(base({ enabled: true }))
    updateSettings.mockResolvedValue(putToday({ enabled: true }))
    renderTab()
    await formularioCargado()
    await userEvent.click(botonEncender()!)
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { enabled: true }))
    expect(updateSettings).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'settings.saved' }))
    await waitFor(() => expect(screen.queryByText('settings.requirements.allSet')).toBeNull())
    const interruptor = screen.getByRole('switch', { name: 'settings.enable' })
    expect(interruptor).toBeChecked()
    expect(interruptor).toHaveFocus()
  })

  it('no se pierde lo que estaba sin guardar: el botón guarda también el cambio pendiente', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockResolvedValue(putToday({ enabled: true, minOrderAmount: 80 }))
    renderTab()
    await formularioCargado()
    const minimo = screen.getByLabelText('settings.minOrder')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, '80')
    await userEvent.click(botonEncender()!)
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { enabled: true, minOrderAmount: 80 }))
  })

  it('sin todo listo no hay botón; apagar «Pagar al recoger» sin guardar lo quita', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    expect(botonEncender()).not.toBeNull()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
    expect(botonEncender()).toBeNull()
  })

  it('con la tienda encendida no hay lista ni botón', async () => {
    getSettings.mockResolvedValue(base({ enabled: true }))
    renderTab()
    await formularioCargado()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'settings.enable' })).toBeNull()
  })

  it('mientras guarda se deshabilita, igual que «Guardar», y no manda dos veces', async () => {
    getSettings.mockResolvedValue(base())
    let terminar: (v: unknown) => void = () => {}
    updateSettings.mockReturnValue(new Promise(r => (terminar = r)))
    renderTab()
    await formularioCargado()
    const boton = botonEncender()!
    await userEvent.click(boton)
    await waitFor(() => expect(boton).toBeDisabled())
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    await userEvent.click(boton)
    expect(updateSettings).toHaveBeenCalledTimes(1)
    terminar(putToday({ enabled: true }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
  })

  it('con un horario inválido se deshabilita, igual que «Guardar»: nada se manda', async () => {
    getSettings.mockResolvedValue(base({ hours: { monday: { enabled: true, ranges: [{ open: '09:00', close: '09:00' }] } } }))
    renderTab()
    await formularioCargado()
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    expect(botonEncender()).toBeDisabled()
  })

  it('STORE_REQUIREMENTS_MISSING al usar el botón: pinta lo que falta, como con el interruptor', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({
      response: { data: { code: 'STORE_REQUIREMENTS_MISSING', details: { missing: ['privacyNotice'] } } },
    })
    renderTab()
    await formularioCargado()
    await userEvent.click(botonEncender()!)
    expect(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' })).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(botonEncender()).toBeNull()
  })

  it('un error del servidor al usar el botón sale en el mismo aviso que al guardar', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({ response: { data: { error: 'Tu plan no incluye la tienda' } } })
    renderTab()
    await formularioCargado()
    await userEvent.click(botonEncender()!)
    expect(await screen.findByText('Tu plan no incluye la tienda')).toBeInTheDocument()
  })

  it('un error del servidor no borra lo que estaba sin guardar: reintentar manda todo otra vez', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValueOnce({ response: { data: { error: 'No se pudo guardar' } } })
    updateSettings.mockResolvedValueOnce(putToday({ enabled: true, minOrderAmount: 80 }))
    renderTab()
    await formularioCargado()
    const minimo = screen.getByLabelText('settings.minOrder')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, '80')
    await userEvent.click(botonEncender()!)
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByLabelText('settings.minOrder')).toHaveValue(80)
    await userEvent.click(botonEncender()!)
    await waitFor(() => expect(updateSettings).toHaveBeenLastCalledWith('venue-1', { enabled: true, minOrderAmount: 80 }))
  })

  it('en tema oscuro, los interruptores apagados de esta pantalla (también los del horario) se distinguen de la tarjeta', async () => {
    getSettings.mockResolvedValue(base())
    const { container } = renderTab()
    await formularioCargado()
    expect(container.querySelector('form')).toHaveClass('dark:[&_[role=switch][data-state=unchecked]]:bg-muted-foreground/60')
  })

  // ── La forma de cobro (Codex r1): el servidor rechaza una tienda encendida sin medio de pago (`NO_PAYMENT_MODE`) ──
  it('con los tres datos listos, apagar «Pagar al recoger» sin guardar quita el «Todo listo»: falta una forma de cobro y no deja encender', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.payAtPickup' }))
    expect(screen.getByText('settings.requirements.title')).toBeInTheDocument()
    expect(screen.queryByText('settings.requirements.allSet')).toBeNull()
    expect(within(paso('payment')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(within(paso('payment')).getByText('settings.requirements.payment.hint|settings.payAtPickup')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeDisabled()
    expect(screen.getByText('settings.enableBlocked')).toBeInTheDocument()
  })

  it('con «Pagar al recoger» guardado apagado, el cobro está ⬜; al prenderlo dice «Todo listo» y encender + guardar manda los dos', async () => {
    getSettings.mockResolvedValue(base({ acceptsPayAtPickup: false }))
    updateSettings.mockResolvedValue(base({ enabled: true, acceptsPayAtPickup: true }))
    renderTab()
    await formularioCargado()
    expect(await screen.findByRole('switch', { name: 'settings.enable' })).toBeDisabled()
    expect(within(paso('payment')).getByText('settings.requirements.pending')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
    expect(screen.getByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(within(paso('payment')).getByText('settings.requirements.done')).toBeInTheDocument()
    const encender = screen.getByRole('switch', { name: 'settings.enable' })
    expect(encender).toBeEnabled()
    await userEvent.click(encender)
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { acceptsPayAtPickup: true, enabled: true }))
  })

  it('con la tienda guardada encendida, apagar «Pagar al recoger» sin guardar no bloquea «Encender» ni muestra la lista', async () => {
    const open = { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false }
    getSettings.mockResolvedValue(base({ enabled: true, store: open }))
    renderTab()
    await formularioCargado()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeEnabled()
    expect(screen.queryByText('settings.requirements.title')).toBeNull()
    expect(screen.queryByText('settings.requirements.allSet')).toBeNull()
  })

  it('sin acceso a la configuración del negocio (sólo ADMIN o más), domicilio y teléfono piden a quien administra, sin liga sin salida', async () => {
    access.role = 'MANAGER'
    getSettings.mockResolvedValue(base({ requirements: { address: false, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    expect(await screen.findByText('settings.requirements.address.askAdmin')).toBeInTheDocument()
    expect(screen.getByText('settings.requirements.phone.askAdmin')).toBeInTheDocument()
    expect(within(paso('address')).queryByRole('link')).toBeNull()
    expect(within(paso('phone')).queryByRole('link')).toBeNull()
  })

  it('con la tienda guardada encendida, apagarla sin guardar no bloquea el interruptor ni apunta a una lista escondida', async () => {
    const open = { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false }
    getSettings.mockResolvedValue(base({ enabled: true, store: open, requirements: { address: true, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    const interruptor = screen.getByRole('switch', { name: 'settings.enable' })
    await userEvent.click(interruptor)
    expect(interruptor).not.toBeChecked()
    expect(interruptor).toBeEnabled()
    expect(screen.queryByText('settings.enableBlocked')).toBeNull()
    expect(screen.getByText('settings.enableHelp')).toBeInTheDocument()
  })

  it('con la tienda ya encendida no hay lista de pasos aunque falte algo (los requisitos sólo cuentan para encenderla)', async () => {
    const open = { status: 'OPEN', reason: null, pausedUntil: null, manualPause: false }
    getSettings.mockResolvedValue(base({ enabled: true, store: open, requirements: { address: true, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeChecked()
    expect(screen.queryByText('settings.requirements.title')).toBeNull()
    expect(screen.queryByText('settings.requirements.allSet')).toBeNull()
  })

  it('aviso faltante: ya no manda a Clientes; «Escribir y publicar aviso» abre el editor AHÍ MISMO con el negocio', async () => {
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
    renderTab()
    await formularioCargado()
    const boton = await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' })
    expect(within(paso('privacyNotice')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /privacyNotice/ })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'editor-del-aviso' })).toBeNull()
    // Con un cambio pendiente en el formulario: si el botón lo mandara (botón «submit» dentro del <form>), se vería aquí.
    fireEvent.change(screen.getByLabelText('settings.minOrder'), { target: { value: '80' } })
    await userEvent.click(boton)
    expect(screen.getByRole('dialog', { name: 'editor-del-aviso' })).toHaveAttribute('data-venue-id', 'venue-1')
    await new Promise(r => setTimeout(r, 30))
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('al cerrar el editor se vuelven a pedir los ajustes: el aviso pasa a ✅ y lo demás que falte sigue ⬜', async () => {
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: false, privacyNotice: false } }))
      .mockResolvedValue(base({ requirements: { address: true, phone: false, privacyNotice: true } }))
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    expect(getSettings).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog', { name: 'editor-del-aviso' })).toBeNull()
    await waitFor(() => expect(within(paso('privacyNotice')).getByText('settings.requirements.done')).toBeInTheDocument())
    expect(within(paso('phone')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeDisabled()
  })

  it('si el aviso era lo único que faltaba, al cerrar el editor pasa a ✅, dice «Todo listo» y «Encender» se habilita solo', async () => {
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
      .mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    expect(await screen.findByRole('switch', { name: 'settings.enable' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeEnabled())
    expect(screen.getByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.done')).toBeInTheDocument()
    expect(getSettings).toHaveBeenCalledTimes(2)
  })

  it('al publicar aquí el botón desaparece: el foco pasa a la lista de pasos (que ahora dice «Todo listo»), no a <body>', async () => {
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
      .mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(document.activeElement).toHaveTextContent('settings.requirements.allSet'))
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toContainElement(screen.getByRole('status'))
  })

  it('si se cierra el editor sin publicar, el foco vuelve al botón «Escribir y publicar aviso» (el editor no lo devuelve solo)', async () => {
    // El doble del editor no devuelve el foco, igual que el real (Radix sin `Dialog.Trigger`): lo pone el componente.
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'settings.requirements.privacyNotice.action' })),
    )
  })

  it('N-4: si el foco está en el botón que abrió el editor y la recarga dice publicado, pasa a la lista (el botón se va)', async () => {
    let soltar: (v: unknown) => void = () => {}
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
      .mockImplementationOnce(() => new Promise(r => (soltar = r)))
    renderTab()
    await formularioCargado()
    const abrir = await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' })
    await userEvent.click(abrir)
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    abrir.focus()
    soltar(base())
    await waitFor(() => expect(document.activeElement).toHaveAttribute('tabindex', '-1'))
    expect(document.activeElement).toContainElement(screen.getByRole('status'))
  })

  it('N-6: con el editor aún montado (su animación de salida) y el foco en su botón cuando llega la recarga, el foco pasa a la lista', async () => {
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
      .mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    editor.sigueMontado = true
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(document.activeElement).toHaveAttribute('tabindex', '-1'))
    expect(document.activeElement).toContainElement(screen.getByRole('status'))
  })

  it('si el foco ya se movió a otro lado cuando llega la recarga, no se lo roba', async () => {
    let soltar: (v: unknown) => void = () => {}
    getSettings
      .mockResolvedValueOnce(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
      .mockImplementationOnce(() => new Promise(r => (soltar = r)))
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    const minimo = screen.getByLabelText('settings.minOrder')
    minimo.focus()
    soltar(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    await new Promise(r => setTimeout(r, 30))
    expect(document.activeElement).toBe(minimo)
  })

  it('sin marketing:manage no hay botón: dice que lo publique quien administra el negocio', async () => {
    access.denied = ['marketing:manage']
    getSettings.mockResolvedValue(base({ requirements: { address: true, phone: true, privacyNotice: false } }))
    renderTab()
    await formularioCargado()
    expect(await screen.findByText('settings.requirements.privacyNotice.askAdmin')).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'settings.requirements.privacyNotice.action' })).toBeNull()
  })

  it('STORE_REQUIREMENTS_MISSING pinta la lista que manda el servidor', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({
      response: { data: { code: 'STORE_REQUIREMENTS_MISSING', details: { missing: ['privacyNotice'] } } },
    })
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' })).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.pending')).toBeInTheDocument()
  })

  it('🔴 tras un STORE_REQUIREMENTS_MISSING, publicar el aviso y cerrar el editor lo quita de lo que falta (manda el GET nuevo)', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({
      response: { data: { code: 'STORE_REQUIREMENTS_MISSING', details: { missing: ['privacyNotice'] } } },
    })
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await userEvent.click(await screen.findByRole('button', { name: 'settings.requirements.privacyNotice.action' }))
    await userEvent.click(screen.getByRole('button', { name: 'cerrar-editor' }))
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(within(paso('privacyNotice')).getByText('settings.requirements.done')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'settings.requirements.privacyNotice.action' })).toBeNull()
    // Lo que el usuario ya había movido en el formulario sigue ahí para volver a guardar.
    expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeChecked()
  })

  it('NO_PAYMENT_MODE muestra el mensaje del servidor', async () => {
    getSettings.mockResolvedValue(base())
    updateSettings.mockRejectedValue({ response: { data: { code: 'NO_PAYMENT_MODE', message: 'Activa un modo de pago' } } })
    renderTab()
    await formularioCargado()
    await userEvent.click(await screen.findByRole('switch', { name: 'settings.enable' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(await screen.findByText('Activa un modo de pago')).toBeInTheDocument()
  })

  // ── Fase 2: la tarjeta en línea (el switch es real; cobrar depende del Stripe del negocio) ──
  const tarjeta = () => screen.getByRole('switch', { name: 'settings.cardOnline' })

  it('sin Stripe: el switch sale apagado y en gris, con el alta en Stripe y «Próximamente: Mercado Pago»', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
    expect(tarjeta()).toBeDisabled()
    expect(tarjeta()).not.toBeChecked()
    expect(screen.getByText('settings.card.notConnected')).toBeInTheDocument()
    expect(screen.getByText('settings.card.mercadoPagoSoon')).toBeInTheDocument()
    expect(screen.queryByText('settings.card.off')).toBeNull()
  })

  it('con Stripe listo y la tarjeta apagada: el switch se puede usar, dice «Apagado…» y no promete Mercado Pago', async () => {
    getSettings.mockResolvedValue(base({ card: { enabled: true, merchantStatus: 'READY' } }))
    renderTab()
    await formularioCargado()
    expect(tarjeta()).toBeEnabled()
    expect(tarjeta()).not.toBeChecked()
    expect(screen.getByText('settings.card.off')).toBeInTheDocument()
    expect(screen.queryByText('settings.card.mercadoPagoSoon')).toBeNull()
  })

  it('tarjeta prendida con Stripe listo: «Tus clientes pueden pagar con tarjeta.» y sin liga', async () => {
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'READY' } }))
    renderTab()
    await formularioCargado()
    expect(tarjeta()).toBeChecked()
    expect(tarjeta()).toBeEnabled()
    expect(screen.getByText('settings.card.ready')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /settings\.card\./ })).toBeNull()
  })

  it('guardada prendida (de fábrica) pero sin Stripe: se ve apagada y en gris, con la liga «Conectar Stripe» a Integraciones', async () => {
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'NOT_CONNECTED' } }))
    renderTab()
    await formularioCargado()
    expect(tarjeta()).not.toBeChecked()
    expect(tarjeta()).toBeDisabled()
    expect(screen.getByText('settings.card.notConnected')).toBeInTheDocument()
    expect(screen.getByText('settings.card.mercadoPagoSoon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'settings.card.connect' })).toHaveAttribute('href', '/venues/taqueria/settings/integrations')
  })

  it('tarjeta prendida con Stripe que no cobra: «todavía no puede cobrar» con la liga «Revisar Stripe»', async () => {
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'NOT_CHARGEABLE' } }))
    renderTab()
    await formularioCargado()
    expect(tarjeta()).not.toBeChecked()
    expect(tarjeta()).toBeDisabled()
    expect(screen.getByText('settings.card.notChargeable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'settings.card.review' })).toHaveAttribute('href', '/venues/taqueria/settings/integrations')
  })

  it('sin acceso a Integraciones (sólo ADMIN o más) no hay liga sin salida', async () => {
    access.role = 'MANAGER'
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'NOT_CONNECTED' } }))
    renderTab()
    await formularioCargado()
    expect(screen.getByText('settings.card.notConnected')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'settings.card.connect' })).toBeNull()
  })

  it('con Stripe listo, prender la tarjeta y guardar manda acceptsCardOnline: true', async () => {
    getSettings.mockResolvedValue(base({ card: { enabled: true, merchantStatus: 'READY' } }))
    updateSettings.mockResolvedValue(putToday({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'READY' } }))
    renderTab()
    await formularioCargado()
    await userEvent.click(tarjeta())
    expect(screen.getByText('settings.card.ready')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { acceptsCardOnline: true }))
  })

  it('sin Stripe, guardar otro cambio no apaga la tarjeta guardada prendida: queda lista para cuando conecte Stripe', async () => {
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'NOT_CONNECTED' } }))
    updateSettings.mockResolvedValue(putToday({ acceptsCardOnline: true, acceptsPayAtPickup: false }))
    renderTab()
    await formularioCargado()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { acceptsPayAtPickup: false }))
  })

  it('con la tarjeta prendida y Stripe listo, quitar «Pagar al recoger» sigue dejando encender (la tarjeta es forma de cobro)', async () => {
    getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'READY' } }))
    updateSettings.mockResolvedValue(putToday({ enabled: true, acceptsPayAtPickup: false, acceptsCardOnline: true }))
    renderTab()
    await formularioCargado()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
    expect(screen.getByText('settings.requirements.allSet')).toBeInTheDocument()
    expect(within(paso('payment')).getByText('settings.requirements.done')).toBeInTheDocument()
    const encender = screen.getByRole('switch', { name: 'settings.enable' })
    expect(encender).toBeEnabled()
    await userEvent.click(encender)
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { enabled: true, acceptsPayAtPickup: false }))
  })

  it.each(['NOT_CONNECTED', 'NOT_CHARGEABLE'])(
    'con la tarjeta prendida pero Stripe %s, quitar «Pagar al recoger» NO deja encender',
    async st => {
      getSettings.mockResolvedValue(base({ acceptsCardOnline: true, card: { enabled: true, merchantStatus: st } }))
      renderTab()
      await formularioCargado()
      await userEvent.click(screen.getByRole('switch', { name: 'settings.payAtPickup' }))
      expect(within(paso('payment')).getByText('settings.requirements.pending')).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeDisabled()
      expect(screen.getByText('settings.enableBlocked')).toBeInTheDocument()
    },
  )

  it('«Usar horario» muestra el editor y un 09:00–09:00 bloquea guardar; apagar manda hours:null', async () => {
    const week = Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => [
        d,
        { enabled: true, ranges: [{ open: '09:00', close: '09:00' }] },
      ]),
    )
    getSettings.mockResolvedValue(base({ enabled: true, hours: week }))
    updateSettings.mockResolvedValue(base({ enabled: true, hours: null }))
    renderTab()
    await formularioCargado()
    expect(await screen.findByTestId('hours-editor')).toBeInTheDocument()
    expect(screen.getByText('settings.hours.errors.sameTime')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'settings.hours.use' }))
    await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { hours: null }))
  })

  it('compartir: liga, snippet de script (sin iframe) y QR con el slug', async () => {
    getSettings.mockResolvedValue(base())
    renderTab()
    await formularioCargado()
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
    await formularioCargado()
    expect(await screen.findByTitle('settings.share.previewTitle')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'settings.share.openInTab' })).toBeNull()
  })

  it.each(['https://otro.example.com', 'https://dashboard.avoqado.io.evil.example', 'http://dashboard.avoqado.io'])(
    '🔴 desde %s (origen que la tienda no deja enmarcar) no hay iframe: hay una liga «Abrir la tienda en otra pestaña»',
    async origin => {
      openedFrom(origin)
      getSettings.mockResolvedValue(base())
      renderTab()
      await formularioCargado()
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
    await formularioCargado()
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

  // ── Tienda híbrida · D1: «¿Quién confirma los pedidos?» ──
  describe('¿Quién confirma los pedidos?', () => {
    const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
    const week = Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => [
        d,
        { enabled: true, ranges: [{ open: '07:00', close: '21:00' }] },
      ]),
    )
    const nadie = (over: Record<string, unknown> = {}) => base({ requiresAcceptance: false, ...over })
    const radio = (k: 'team' | 'noOne') => screen.getByRole('radio', { name: `settings.confirm.${k}.label` })

    it('elegir «Nadie» manda sólo requiresAcceptance:false', async () => {
      getSettings.mockResolvedValue(base({ requiresAcceptance: true }))
      updateSettings.mockResolvedValue(nadie())
      renderTab()
      await formularioCargado()
      expect(radio('team')).toBeChecked()
      await userEvent.click(radio('noOne'))
      await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
      await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { requiresAcceptance: false }))
    })

    it('cada opción trae su ayuda y su caminito', async () => {
      getSettings.mockResolvedValue(base())
      renderTab()
      await formularioCargado()
      for (const k of ['team', 'noOne']) {
        expect(screen.getByText(`settings.confirm.${k}.help`)).toBeInTheDocument()
        expect(screen.getByText(`settings.confirm.${k}.path`)).toBeInTheDocument()
      }
      expect(screen.queryByText('settings.confirm.noOneNote')).toBeNull()
    })

    it('R66 (a): sin ajustes guardados y el giro sugiere «Nadie»: viene marcado, «Sugerido para tu giro» y «Cambios sin guardar» hasta Guardar', async () => {
      getSettings.mockResolvedValue(base({ requiresAcceptance: true, suggestedRequiresAcceptance: false, hasSavedSettings: false }))
      updateSettings.mockResolvedValue(nadie({ suggestedRequiresAcceptance: false, hasSavedSettings: true }))
      renderTab()
      await formularioCargado()
      await waitFor(() => expect(radio('noOne')).toBeChecked())
      expect(screen.getByText('settings.confirm.suggested')).toBeInTheDocument()
      expect(screen.getByText('settings.unsaved')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
      await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { requiresAcceptance: false }))
    })

    it.each([[true], [undefined]])(
      'R66 (b): hasSavedSettings=%s con «Mi equipo» guardado: se queda en «Mi equipo», sin «Cambios sin guardar», y guardar otro campo no manda requiresAcceptance',
      async has => {
        getSettings.mockResolvedValue(base({ requiresAcceptance: true, suggestedRequiresAcceptance: false, hasSavedSettings: has }))
        updateSettings.mockResolvedValue(base({ minOrderAmount: 80 }))
        renderTab()
        await formularioCargado()
        expect(radio('team')).toBeChecked()
        expect(screen.queryByText('settings.unsaved')).toBeNull()
        fireEvent.change(screen.getByLabelText('settings.minOrder'), { target: { value: '80' } })
        await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
        await waitFor(() => expect(updateSettings).toHaveBeenCalledWith('venue-1', { minOrderAmount: 80 }))
      },
    )

    it('R66 (c): hasSavedSettings=true con «Nadie» guardado: «Nadie» marcado, sin marca de preselección', async () => {
      getSettings.mockResolvedValue(nadie({ hasSavedSettings: true, suggestedRequiresAcceptance: true }))
      renderTab()
      await formularioCargado()
      expect(radio('noOne')).toBeChecked()
      expect(screen.queryByText('settings.unsaved')).toBeNull()
      expect(screen.queryByText('settings.confirm.suggested')).toBeNull()
    })

    it('bajo «Nadie»: la nota de R51, «Pagar en caja» prendido y en gris, y la tarjeta en gris con su razón', async () => {
      getSettings.mockResolvedValue(
        nadie({ acceptsPayAtPickup: false, acceptsCardOnline: true, card: { enabled: true, merchantStatus: 'READY' } }),
      )
      renderTab()
      await formularioCargado()
      expect(screen.getByText('settings.confirm.noOneNote')).toBeInTheDocument()
      const pay = screen.getByRole('switch', { name: 'settings.payAtPickup' })
      expect(pay).toBeChecked()
      expect(pay).toBeDisabled()
      expect(screen.getByText('settings.confirm.payNoOne')).toBeInTheDocument()
      const card = screen.getByRole('switch', { name: 'settings.cardOnline' })
      expect(card).not.toBeChecked()
      expect(card).toBeDisabled()
      expect(screen.getByText('settings.confirm.cardNoOne')).toBeInTheDocument()
    })

    it('lista «Para recibir pedidos con Nadie»: horario y «Un aparato que cobra folios se conectó hace N min»', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: ago(3) }))
      renderTab()
      await formularioCargado()
      expect(screen.getByText('settings.confirm.checklistTitle')).toBeInTheDocument()
      expect(screen.getByText('settings.confirm.hoursOk|settings.confirm.allWeek,07:00,21:00')).toBeInTheDocument()
      expect(screen.getByText('settings.confirm.deviceOk|3')).toBeInTheDocument()
      expect(screen.queryByText('settings.confirm.deviceMissing')).toBeNull()
    })

    it('sin aparato que cobre folios: avisa, dice qué hacer y «Encender la tienda» sale en gris con su razón', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: null }))
      renderTab()
      await formularioCargado()
      expect(screen.getByText('settings.confirm.deviceMissing')).toBeInTheDocument()
      expect(screen.getByText('settings.confirm.deviceWhatToDo')).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeDisabled()
      expect(screen.getByText('settings.confirm.enableNoDevice')).toBeInTheDocument()
      expect(screen.queryByText('settings.requirements.allSet')).toBeNull()
    })

    it('un aparato visto hace más de 7 días cuenta como ninguno', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: ago(8 * 24 * 60) }))
      renderTab()
      await formularioCargado()
      expect(screen.getByText('settings.confirm.deviceMissing')).toBeInTheDocument()
    })

    it('con aparato, «Encender» queda libre', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: ago(1) }))
      renderTab()
      await formularioCargado()
      expect(screen.getByRole('switch', { name: 'settings.enable' })).toBeEnabled()
    })

    it('sin horario, el renglón del horario pide ponerlo y liga al apartado de Horario', async () => {
      getSettings.mockResolvedValue(nadie({ hours: null, lastToPayPollAt: ago(1) }))
      renderTab()
      await formularioCargado()
      expect(screen.getByText('settings.confirm.hoursMissing')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'settings.confirm.hoursLink' })).toHaveAttribute('href', '#oo-hours-card')
    })

    it.each([
      ['NO_FOLIO_DEVICE', 'settings.confirm.errors.NO_FOLIO_DEVICE'],
      ['HOURS_REQUIRED', 'settings.confirm.errors.HOURS_REQUIRED'],
      ['PAY_AT_PICKUP_REQUIRED', 'settings.confirm.errors.PAY_AT_PICKUP_REQUIRED'],
    ])('el código %s muestra su texto traducido (no el del servidor)', async (code, text) => {
      getSettings.mockResolvedValue(base())
      updateSettings.mockRejectedValue({ response: { status: 409, data: { code, message: 'texto crudo del servidor' } } })
      renderTab()
      await formularioCargado()
      await userEvent.click(radio('noOne'))
      await userEvent.click(screen.getByRole('button', { name: 'settings.save' }))
      expect(await screen.findByText(text)).toBeInTheDocument()
      expect(screen.queryByText('texto crudo del servidor')).toBeNull()
    })

    it('volver a «Mi equipo» con folios por pagar avisa cuántos y que siguen en la terminal y el POS', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: ago(1) }))
      getToPay.mockResolvedValue({
        counts: { toPay: 3, toDeliver: 0 },
        toPay: [],
        toDeliver: [],
        nextCursors: { toPay: null, toDeliver: null },
      })
      renderTab()
      await formularioCargado()
      expect(screen.queryByText('settings.confirm.toPayNotice.title|3')).toBeNull()
      await userEvent.click(radio('team'))
      expect(await screen.findByText('settings.confirm.toPayNotice.title|3')).toBeInTheDocument()
      expect(screen.getByText('settings.confirm.toPayNotice.body')).toBeInTheDocument()
      expect(getToPay).toHaveBeenCalledWith('venue-1')
    })

    it('volver a «Mi equipo» sin folios por pagar no avisa nada', async () => {
      getSettings.mockResolvedValue(nadie({ hours: week, lastToPayPollAt: ago(1) }))
      getToPay.mockResolvedValue({
        counts: { toPay: 0, toDeliver: 2 },
        toPay: [],
        toDeliver: [],
        nextCursors: { toPay: null, toDeliver: null },
      })
      renderTab()
      await formularioCargado()
      await userEvent.click(radio('team'))
      await waitFor(() => expect(getToPay).toHaveBeenCalled())
      expect(screen.queryByText('settings.confirm.toPayNotice.body')).toBeNull()
    })
  })
})
