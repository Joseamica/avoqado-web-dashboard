import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PassConnectionView } from '@/types/passes'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({ connectTotalPass: vi.fn(), setPassConfirmMode: vi.fn(), disconnectPassProvider: vi.fn() }))
vi.mock('@/services/passes.service', () => svc)
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
const invalidateSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-passes', () => ({ useInvalidatePasses: () => invalidateSpy }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))
// El aviso de la pausa por el plan (R62) usa el CTA del paywall: permiso de contratar, ruta del venue y navegación.
const access = vi.hoisted(() => ({ allowed: [] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test' }) }))
const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateSpy,
}))

import { TotalPassCard } from '../TotalPassCard'

const base: PassConnectionView = {
  provider: 'TOTALPASS',
  available: true,
  status: null,
  externalPlaceName: null,
  confirmMode: 'AUTO',
  lastError: null,
  plans: [],
  productLinks: [],
  updatedAt: null,
}
const CONNECTED: PassConnectionView = {
  ...base,
  status: 'ACTIVE',
  externalPlaceName: 'Estudio Prueba',
  plans: [{ id: '305', name: 'Gold', code: 'ABCD' }],
}
const KEY = '11111111-2222-4333-8444-555555555555'
// El texto real que deja el server cuando TotalPass contesta 401 (`core/outbox.service.ts:184`).
const REVOKED_401 = 'El proveedor rechazó las llaves (401): hay que volver a conectar.'
// El botón del paywall (`FeatureGate`): «Mejora a {{tier}}», con el tier de la función (Pro).
const UPGRADE = 'billing:featureGate.upgrade:{"tier":"Pro"}'

function renderCard(connection: PassConnectionView, canManage = true, planPaused = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TotalPassCard venueId="v1" connection={connection} canManage={canManage} planPaused={planPaused} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  access.allowed = ['billing:subscriptions:manage']
  invalidateSpy.mockResolvedValue(undefined)
  svc.connectTotalPass.mockResolvedValue(CONNECTED)
  svc.setPassConfirmMode.mockResolvedValue(CONNECTED)
  svc.disconnectPassProvider.mockResolvedValue({ disconnected: true })
})

describe('TotalPassCard', () => {
  it('sin conexión: campo de llave tipo password, Conectar manda la llave e invalida el overview; nada que desconectar', async () => {
    const user = userEvent.setup()
    renderCard(base)
    const input = screen.getByLabelText('totalpass.keyLabel')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'totalpass.connect' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'totalpass.disconnect' })).not.toBeInTheDocument()
    await user.type(input, `  ${KEY} `)
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    await waitFor(() => expect(svc.connectTotalPass).toHaveBeenCalledWith('v1', `  ${KEY} `))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'totalpass.connected' }))
  })

  // El mensaje del server tal cual, y lo tecleado se queda para corregirlo.
  it('llave rechazada ⇒ el mensaje del servidor se ve en la tarjeta y la llave no se borra', async () => {
    const user = userEvent.setup()
    svc.connectTotalPass.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: 'TotalPass no reconoce esa llave. Revisa que sea la «place_api_key» de esta sucursal y vuelve a pegarla.',
          code: 'PASS_KEY_REJECTED',
        },
      },
    })
    renderCard(base)
    await user.type(screen.getByLabelText('totalpass.keyLabel'), 'llave-mala-0000')
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    expect(await screen.findByText(/TotalPass no reconoce esa llave/)).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toHaveValue('llave-mala-0000')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  // Una conexión que quedó a medias (PENDING + lastError) enseña el motivo y deja volver a intentar.
  it('conexión incompleta (PENDING con lastError) ⇒ formulario + motivo', () => {
    renderCard({ ...base, status: 'PENDING', lastError: 'HTTP_503: TotalPass HTTP 503' })
    expect(screen.getByText('HTTP_503: TotalPass HTTP 503')).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    // PENDING ya reservó la sucursal: se puede soltar para conectar otra (R41 del server).
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeInTheDocument()
  })

  it('conectada: muestra la sucursal, el modo con su consecuencia, y cambiarlo guarda e invalida el overview', async () => {
    const user = userEvent.setup()
    renderCard(CONNECTED)
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.getByText('totalpass.mode.autoHint')).toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'totalpass.mode.onCheckin' }))
    await waitFor(() => expect(svc.setPassConfirmMode).toHaveBeenCalledWith('v1', 'TOTALPASS', 'ON_VENUE_CHECKIN'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
  })

  // P2-8: el control sigue deshabilitado hasta que la invalidación (el refetch) termina, no sólo hasta que el PUT contestó.
  it('cambiar el modo deja el selector deshabilitado hasta que los datos nuevos llegaron', async () => {
    const user = userEvent.setup()
    let release!: () => void
    invalidateSpy.mockReturnValueOnce(
      new Promise<void>(resolve => {
        release = resolve
      }),
    )
    renderCard(CONNECTED)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'totalpass.mode.onCheckin' }))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(screen.getByRole('combobox')).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled())
  })

  // Desconectar pide confirmación; un rechazo del server (socios próximos) se ve tal cual y en rojo.
  // C4: conectada (la llave funciona) ⇒ sin el aviso del portal.
  it('desconectar pasa por confirmación, sin el aviso del portal, y muestra el 409 BLOCKED del servidor como error', async () => {
    const user = userEvent.setup()
    svc.disconnectPassProvider.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Todavía no se puede desconectar TotalPass: 2 reservas de socios próximas o en curso.', code: 'PASS_DISCONNECT_BLOCKED' },
      },
    })
    renderCard(CONNECTED)
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    expect(svc.disconnectPassProvider).not.toHaveBeenCalled()
    expect(await screen.findByText('totalpass.disconnectBody')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.disconnectNoKey')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnectConfirm' }))
    const message = await screen.findByText(/2 reservas de socios próximas/)
    expect(message.closest('[role="alert"]')).toHaveClass('text-destructive')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  // R2b-1 (R65 del server): con clases ligadas el server las desliga en esa misma llamada y pide volver a presionar.
  // No es un error: aviso neutral con su texto, y el overview se refresca (las clases ya no están ligadas).
  it('desconectar con clases ligadas (409 UNLINKING) ⇒ aviso neutral con el texto del servidor e invalida el overview', async () => {
    const user = userEvent.setup()
    svc.disconnectPassProvider.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Estamos quitando tus 2 clases de TotalPass. Vuelve a presionar Desconectar en unos minutos.', code: 'PASS_DISCONNECT_UNLINKING' },
      },
    })
    renderCard(CONNECTED)
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    await user.click(await screen.findByRole('button', { name: 'totalpass.disconnectConfirm' }))
    const message = await screen.findByText(/Estamos quitando tus 2 clases de TotalPass/)
    expect(message.closest('[role="alert"]')).not.toHaveClass('text-destructive')
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(toastSpy).not.toHaveBeenCalled()
    // Volver a presionar sigue disponible.
    await waitFor(() => expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeEnabled())
  })

  // P2-9: PAUSED no es «conectada» (modo y clases exigen ACTIVE en la API): se reconecta pegando otra llave, y se puede desconectar.
  it('pausada: sin modo ni clases; formulario de llave para reconectar y Desconectar', () => {
    renderCard({ ...CONNECTED, status: 'PAUSED' })
    expect(screen.getByText('totalpass.status.paused')).toBeInTheDocument()
    expect(screen.getByText('totalpass.pausedHint')).toBeInTheDocument()
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeInTheDocument()
  })

  // P2-9 + C1: REVOKED por un 401 (deja sucursal, credencial y `lastError`): Desconectar limpia; o pegar otra llave.
  it('revocada por un 401: aviso con la sucursal, Desconectar para limpiar y formulario para reconectar', () => {
    renderCard({ ...CONNECTED, status: 'REVOKED', lastError: REVOKED_401 })
    expect(screen.getByText('totalpass.status.revoked')).toBeInTheDocument()
    expect(screen.getByText('totalpass.revokedHint:{"place":"Estudio Prueba"}')).toBeInTheDocument()
    expect(screen.getByText(REVOKED_401)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  // C4 (R41 del server): desconectar sin llave válida no se bloquea, pero lo publicado en TotalPass sigue allá; el diálogo lo dice.
  it('revocada: el diálogo de Desconectar avisa que lo publicado en TotalPass se borra desde su portal, y desconecta', async () => {
    const user = userEvent.setup()
    renderCard({ ...CONNECTED, status: 'REVOKED', lastError: REVOKED_401 })
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    expect(await screen.findByText('totalpass.disconnectNoKey')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnectConfirm' }))
    await waitFor(() => expect(svc.disconnectPassProvider).toHaveBeenCalledWith('v1', 'TOTALPASS'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
  })

  // P2-9: REVOKED ya limpia (desconectada): no hay nada que desconectar; para el dueño es «sin conectar».
  it('revocada y limpia: sólo el formulario de llave, sin Desconectar', () => {
    renderCard({ ...base, status: 'REVOKED' })
    expect(screen.getByText('totalpass.status.notConnected')).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'totalpass.disconnect' })).not.toBeInTheDocument()
    expect(screen.queryByText('totalpass.status.revoked')).not.toBeInTheDocument()
  })

  // C1 (ronda 2): desconectar NO borra `externalPlaceName`; una REVOKED con nombre pero sin `lastError` ya está limpia.
  it('revocada con el nombre de la sucursal y sin lastError (ya desconectada): «sin conectar», sin «Llave rechazada» ni Desconectar', () => {
    renderCard({ ...CONNECTED, status: 'REVOKED', lastError: null })
    expect(screen.getByText('totalpass.status.notConnected')).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.status.revoked')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'totalpass.disconnect' })).not.toBeInTheDocument()
    expect(screen.queryByText('Estudio Prueba')).not.toBeInTheDocument()
  })

  it('sin permiso de configurar: todo deshabilitado, nada se esconde', () => {
    const r1 = renderCard(CONNECTED, false)
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeDisabled()
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    r1.unmount()
    renderCard({ ...CONNECTED, status: 'PAUSED' }, false)
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeDisabled()
  })

  // R62 (pausa suave): sin plan y conectada ⇒ aviso, el CTA del paywall y Desconectar; nada de llave, modo ni clases.
  it('pausada por el plan (ACTIVE): aviso, «Mejora a Pro» lleva a Suscripciones y Desconectar sin el aviso del portal', async () => {
    const user = userEvent.setup()
    renderCard(CONNECTED, true, true)
    expect(screen.getByText('totalpass.status.planPaused')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.status.connected')).not.toBeInTheDocument()
    expect(screen.getByText('totalpass.planPaused')).toBeInTheDocument()
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: UPGRADE }))
    expect(navigateSpy).toHaveBeenCalledWith('/venues/test/settings/billing/subscriptions')
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    expect(await screen.findByText('totalpass.disconnectBody')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.disconnectNoKey')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnectConfirm' }))
    await waitFor(() => expect(svc.disconnectPassProvider).toHaveBeenCalledWith('v1', 'TOTALPASS'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
  })

  // R62 + C4: pausada por el plan con la llave ya rechazada ⇒ el diálogo dice que lo publicado se borra en el portal.
  it('pausada por el plan (REVOKED por 401): sin formulario de llave; el diálogo de Desconectar trae la línea del portal', async () => {
    const user = userEvent.setup()
    renderCard({ ...CONNECTED, status: 'REVOKED', lastError: REVOKED_401 }, true, true)
    expect(screen.getByText('totalpass.planPaused')).toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    expect(await screen.findByText('totalpass.disconnectNoKey')).toBeInTheDocument()
  })

  // R62: quien no puede contratar no ve el botón; se le dice a quién pedírselo (igual que el paywall).
  it('pausada por el plan sin permiso de contratar: «pídesela al dueño» en vez del botón; Desconectar sigue la regla de canManage', () => {
    access.allowed = []
    renderCard(CONNECTED, false, true)
    expect(screen.getByText('billing:featureGate.askOwner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: UPGRADE })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeDisabled()
  })
})
