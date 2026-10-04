import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PassConnectionView } from '@/types/passes'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  connectTotalPass: vi.fn(),
  setPassConfirmMode: vi.fn(),
  setPassProductLinks: vi.fn(),
  disconnectPassProvider: vi.fn(),
}))
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
      <TotalPassCard
        venueId="v1"
        connection={connection}
        classProducts={{ items: [], total: 0 }}
        canManage={canManage}
        planPaused={planPaused}
      />
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
    // La llave no se queda en el formulario después de conectar.
    expect(screen.getByLabelText('totalpass.keyLabel')).toHaveValue('')
  })

  // Revisión final, Minor 7: la llave va oculta por default, pero el dueño puede verla para encontrar el carácter que sobra.
  // Al conectar vuelve a ocultarse; el campo sigue sin autocompletar.
  it('el ojo muestra y oculta la llave tecleada; al conectar vuelve a ocultarse', async () => {
    const user = userEvent.setup()
    renderCard(base)
    const input = screen.getByLabelText('totalpass.keyLabel')
    const eye = screen.getByRole('button', { name: 'totalpass.showKey' })
    expect(eye).toHaveAttribute('aria-pressed', 'false')
    await user.type(input, KEY)
    await user.click(eye)
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(eye).toHaveAttribute('aria-pressed', 'true')
    await user.click(eye)
    expect(input).toHaveAttribute('type', 'password')
    await user.click(eye)
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    await waitFor(() => expect(svc.connectTotalPass).toHaveBeenCalledWith('v1', KEY))
    await waitFor(() => expect(screen.getByLabelText('totalpass.keyLabel')).toHaveAttribute('type', 'password'))
    expect(screen.getByRole('button', { name: 'totalpass.showKey' })).toHaveAttribute('aria-pressed', 'false')
  })

  // El mensaje del server tal cual, y lo tecleado se queda para corregirlo. H1: aunque falle, el server pudo haber cambiado
  // de estado (PENDING con la sucursal reservada, o REVOKED si se interrumpió), así que la vista general se recarga.
  it('llave rechazada ⇒ el mensaje del servidor se ve, la llave no se borra y la vista general se recarga', async () => {
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
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
  })

  // H2: el error de la llave no se queda pegado después de soltar la sucursal con Desconectar.
  it('el error de la llave se borra al desconectar', async () => {
    const user = userEvent.setup()
    svc.connectTotalPass.mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'Este negocio ya está conectado a otra sucursal de TotalPass. Desconéctala primero.', code: 'PASS_OTHER_PLACE' },
      },
    })
    renderCard({ ...base, status: 'PENDING', externalPlaceName: 'Estudio Prueba' })
    await user.type(screen.getByLabelText('totalpass.keyLabel'), 'llave-de-otra-0000')
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    expect(await screen.findByText(/Desconéctala primero/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    await user.click(await screen.findByRole('button', { name: 'totalpass.disconnectConfirm' }))
    await waitFor(() => expect(svc.disconnectPassProvider).toHaveBeenCalledWith('v1', 'TOTALPASS'))
    await waitFor(() => expect(screen.queryByText(/Desconéctala primero/)).not.toBeInTheDocument())
  })

  // Una conexión que quedó a medias (PENDING + lastError) lo dice en claro y deja volver a intentar. H6: el texto técnico del
  // server va debajo, chico y atenuado (sirve para soporte), no como el mensaje principal.
  it('conexión incompleta (PENDING con lastError) ⇒ formulario + aviso claro + motivo técnico atenuado', () => {
    renderCard({ ...base, status: 'PENDING', lastError: 'HTTP_503: TotalPass HTTP 503' })
    expect(screen.getByText('totalpass.pendingHint')).toBeInTheDocument()
    expect(screen.getByText('HTTP_503: TotalPass HTTP 503')).toHaveClass('text-xs', 'text-muted-foreground')
    expect(screen.getByLabelText('totalpass.keyLabel')).toBeInTheDocument()
    // PENDING ya reservó la sucursal: se puede soltar para conectar otra (R41 del server).
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeInTheDocument()
  })

  // R2b-18: conectada, «Volver a pegar la llave» abre el mismo campo; conectar la MISMA sucursal hace upsert y re-lee los planes.
  it('conectada: «Volver a pegar la llave» abre el campo; conectar desde ahí manda la llave y cierra el campo al terminar', async () => {
    const user = userEvent.setup()
    renderCard(CONNECTED)
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    expect(screen.getByText('totalpass.rekeyHint')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.rekey' }))
    const input = screen.getByLabelText('totalpass.keyLabel')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByRole('button', { name: 'totalpass.showKey' })).toBeInTheDocument()
    await user.type(input, KEY)
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    await waitFor(() => expect(svc.connectTotalPass).toHaveBeenCalledWith('v1', KEY))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    await waitFor(() => expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'totalpass.rekey' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'totalpass.mode.label' })).toBeInTheDocument()
  })

  // R2b-18: una llave rechazada deja el campo abierto con el mensaje del servidor y la llave tecleada; Cancelar lo cierra.
  it('volver a pegar una llave rechazada ⇒ el campo sigue abierto con el error; Cancelar lo cierra y lo limpia', async () => {
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
    renderCard(CONNECTED)
    await user.click(screen.getByRole('button', { name: 'totalpass.rekey' }))
    await user.type(screen.getByLabelText('totalpass.keyLabel'), KEY)
    await user.click(screen.getByRole('button', { name: 'totalpass.connect' }))
    expect(await screen.findByText(/TotalPass no reconoce esa llave/)).toBeInTheDocument()
    expect(screen.getByLabelText('totalpass.keyLabel')).toHaveValue(KEY)
    await user.click(screen.getByRole('button', { name: 'common:cancel' }))
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    expect(screen.queryByText(/TotalPass no reconoce esa llave/)).not.toBeInTheDocument()
  })

  it('conectada: muestra la sucursal, el modo con su consecuencia, y cambiarlo guarda e invalida el overview', async () => {
    const user = userEvent.setup()
    renderCard(CONNECTED)
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.getByText('totalpass.mode.autoHint')).toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    // H5: el selector se anuncia con su etiqueta, no sólo con el valor elegido.
    await user.click(screen.getByRole('combobox', { name: 'totalpass.mode.label' }))
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
    // H4: mientras guarda se ve lo que se eligió, no el valor viejo.
    expect(screen.getByRole('combobox')).toHaveTextContent('totalpass.mode.onCheckin')
    expect(screen.getByText('totalpass.mode.onCheckinHint')).toBeInTheDocument()
    release()
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled())
  })

  // H1: si el server rechaza el modo (p. ej. la conexión se revocó en segundo plano), el mensaje sale tal cual y la vista se
  // recarga para que la tarjeta deje de decir «Conectada».
  it('cambiar el modo falla ⇒ toast con el mensaje del servidor y la vista general se recarga', async () => {
    const user = userEvent.setup()
    svc.setPassConfirmMode.mockRejectedValue({
      response: { status: 409, data: { message: 'Primero conecta TotalPass.', code: 'PASS_NOT_CONNECTED' } },
    })
    renderCard(CONNECTED)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'totalpass.mode.onCheckin' }))
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Primero conecta TotalPass.' })),
    )
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    // Al fallar, el selector vuelve al valor guardado (no se queda con lo que no se guardó).
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('totalpass.mode.auto'))
    expect(screen.getByText('totalpass.mode.autoHint')).toBeInTheDocument()
  })

  // Desconectar pide confirmación; un rechazo del server (socios próximos) se ve tal cual y en rojo.
  // C4: conectada (la llave funciona) ⇒ sin el aviso del portal.
  it('desconectar pasa por confirmación, sin el aviso del portal, y muestra el 409 BLOCKED del servidor como error', async () => {
    const user = userEvent.setup()
    svc.disconnectPassProvider.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: 'Todavía no se puede desconectar TotalPass: 2 reservas de socios próximas o en curso.',
          code: 'PASS_DISCONNECT_BLOCKED',
        },
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
        data: {
          message: 'Estamos quitando tus 2 clases de TotalPass. Vuelve a presionar Desconectar en unos minutos.',
          code: 'PASS_DISCONNECT_UNLINKING',
        },
      },
    })
    let release!: () => void
    invalidateSpy.mockReturnValueOnce(
      new Promise<void>(resolve => {
        release = resolve
      }),
    )
    renderCard(CONNECTED)
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    await user.click(await screen.findByRole('button', { name: 'totalpass.disconnectConfirm' }))
    const message = await screen.findByText(/Estamos quitando tus 2 clases de TotalPass/)
    expect(message.closest('[role="alert"]')).not.toHaveClass('text-destructive')
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith('v1', 'connection'))
    expect(toastSpy).not.toHaveBeenCalled()
    // H7 (P2-8): mientras la vista se recarga, Desconectar sigue deshabilitado; al llegar los datos, se puede volver a presionar.
    expect(screen.getByRole('button', { name: 'totalpass.disconnect' })).toBeDisabled()
    release()
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
    // R2b-18: volver a pegar la llave es configurar: sin permiso no se ofrece.
    expect(screen.queryByRole('button', { name: 'totalpass.rekey' })).not.toBeInTheDocument()
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
    expect(screen.getByText('totalpass.planPausedAuto')).toBeInTheDocument()
    expect(screen.getByText('Estudio Prueba')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'totalpass.rekey' })).not.toBeInTheDocument()
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
  // Revisión final, Minor 6: y el motivo del rechazo se ve YA, no hasta que el dueño mejora el plan.
  it('pausada por el plan (REVOKED por 401): el motivo a la vista, sin formulario de llave; el diálogo trae la línea del portal', async () => {
    const user = userEvent.setup()
    renderCard({ ...CONNECTED, status: 'REVOKED', lastError: REVOKED_401 }, true, true)
    expect(screen.getByText('totalpass.planPausedAuto')).toBeInTheDocument()
    expect(screen.getByText(REVOKED_401).closest('[role="alert"]')).toHaveClass('text-destructive')
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'totalpass.disconnect' }))
    expect(await screen.findByText('totalpass.disconnectNoKey')).toBeInTheDocument()
  })

  // Revisión final, Minor 6: un conectar a medias en la pausa se dice igual que fuera de ella (aviso claro + motivo atenuado).
  it('pausada por el plan con un conectar a medias (PENDING con lastError) ⇒ también el aviso de pendiente con su motivo', () => {
    renderCard({ ...CONNECTED, status: 'PENDING', lastError: 'HTTP_503: TotalPass HTTP 503' }, true, true)
    expect(screen.getByText('totalpass.planPausedAuto')).toBeInTheDocument()
    expect(screen.getByText('totalpass.pendingHint')).toBeInTheDocument()
    expect(screen.getByText('HTTP_503: TotalPass HTTP 503')).toHaveClass('text-xs', 'text-muted-foreground')
    expect(screen.queryByLabelText('totalpass.keyLabel')).not.toBeInTheDocument()
  })

  // Revisión final, Important 2: sin el plan el server sigue validando con TotalPass, pero confirmar desde «Pases» tiene
  // candado. En AUTO se confirman solos; en manual, al marcar la asistencia en Reservaciones (POS o kiosco) como siempre.
  it('pausada por el plan: el aviso dice cómo se confirman los check-ins según el modo', () => {
    const r1 = renderCard(CONNECTED, true, true)
    expect(screen.getByText('totalpass.planPausedAuto')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.planPausedOnCheckin')).not.toBeInTheDocument()
    r1.unmount()
    renderCard({ ...CONNECTED, confirmMode: 'ON_VENUE_CHECKIN' }, true, true)
    expect(screen.getByText('totalpass.planPausedOnCheckin')).toBeInTheDocument()
    expect(screen.queryByText('totalpass.planPausedAuto')).not.toBeInTheDocument()
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
