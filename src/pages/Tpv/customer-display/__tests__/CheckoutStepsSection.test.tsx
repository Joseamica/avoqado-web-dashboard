import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TPV_SETTINGS, tpvSettingsService, type TpvSettings } from '@/services/tpv-settings.service'
import { CheckoutStepsSection } from '../CheckoutStepsSection'

const permisos = new Set<string>()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => permisos.has(p) }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/services/tpv-settings.service', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/tpv-settings.service')>()
  return { ...real, tpvSettingsService: { getSettings: vi.fn(), updateSettings: vi.fn() } }
})

const servicio = vi.mocked(tpvSettingsService)
function pintar(tipo = 'POS_ANDROID') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CheckoutStepsSection tpvId="t1" deviceType={tipo} versionCode={null} />
    </QueryClientProvider>,
  )
  return { qc }
}
/** Una promesa que la prueba resuelve cuando quiere: así se ve el estado MIENTRAS el PUT o el GET esperan (Codex, tabla). */
function retenida<T>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((r, x) => {
    resolver = r
    rechazar = x
  })
  return { promesa, resolver, rechazar }
}
const interruptor = (nombre: string) => screen.getByRole('switch', { name: nombre })

// Un «server» de mentiras con memoria: lo que se guarda es lo que se vuelve a leer.
let guardado: TpvSettings
beforeEach(() => {
  permisos.clear()
  toast.mockClear()
  guardado = { ...DEFAULT_TPV_SETTINGS, tipSuggestions: [10, 15, 20], defaultTipPercentage: 20 }
  servicio.getSettings.mockReset()
  servicio.updateSettings.mockReset()
  servicio.getSettings.mockImplementation(async () => ({ ...guardado }))
  servicio.updateSettings.mockImplementation(async (_id, cambio) => {
    guardado = { ...guardado, ...cambio } as TpvSettings
    return guardado
  })
})

describe('CheckoutStepsSection', () => {
  it('sin tpv-settings:read: lo explica y NO consulta', () => {
    pintar()
    expect(screen.getByText('steps.noReadPermission')).toBeInTheDocument()
    expect(servicio.getSettings).not.toHaveBeenCalled()
  })

  it('🔴 optimista DE VERDAD: con el PUT retenido ya se ve apagado; al confirmar queda lo que dijo el SERVIDOR', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    const put = retenida<TpvSettings>()
    servicio.updateSettings.mockReturnValue(put.promesa)
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('switch', { name: 'steps.tip' }))
    await waitFor(() => expect(servicio.updateSettings).toHaveBeenCalledWith('t1', { showTipScreen: false })) // SÓLO su llave
    await waitFor(() => expect(interruptor('steps.tip')).toHaveAttribute('aria-checked', 'false')) // el PUT sigue sin respuesta
    // La respuesta trae TODO lo guardado: incluso las estrellas que otra pestaña apagó. Manda la respuesta, no la suposición.
    await act(async () => put.resolver({ ...guardado, showTipScreen: false, showReviewScreen: false }))
    await waitFor(() => expect(interruptor('steps.review')).toHaveAttribute('aria-checked', 'false'))
    expect(interruptor('steps.tip')).toHaveAttribute('aria-checked', 'false')
    expect(servicio.getSettings).toHaveBeenCalledTimes(1) // no hizo falta releer
    expect(toast).toHaveBeenCalledWith({ title: 'steps.savedOff {"step":"steps.names.showTipScreen"}' })
  })

  it('🔴 rechazo CONFIRMADO: vuelve a como estaba ANTES de releer (el GET sigue retenido) y dice el mensaje del servidor', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    servicio.updateSettings.mockRejectedValue({ response: { status: 404, data: { message: 'Terminal no encontrada' } } })
    const user = userEvent.setup()
    pintar()
    const estrellas = await screen.findByRole('switch', { name: 'steps.review' })
    const get = retenida<TpvSettings>()
    servicio.getSettings.mockReturnValue(get.promesa)
    await user.click(estrellas)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'steps.saveError', description: 'Terminal no encontrada' }))
    await waitFor(() => expect(interruptor('steps.review')).toHaveAttribute('aria-checked', 'true')) // el GET sigue retenido
    await act(async () => get.resolver({ ...guardado }))
    expect(interruptor('steps.review')).toHaveAttribute('aria-checked', 'true')
  })

  it.each([
    ['se perdió la respuesta', new Error('Network Error')],
    ['500 genérico: no acredita que se deshizo (Codex r2)', { response: { status: 500, data: { message: 'Ocurrió un error inesperado en el servidor.' } } }],
    ['409 del REINTENTO automático de api.ts: el primer intento pudo guardar', { response: { status: 409, data: { message: 'Conflicto' } }, config: { _retry: true } }],
  ])('🔴 resultado INCIERTO (%s): no se «restaura» lo de antes; se relee y se ve lo que el server tiene (Codex #4)', async (_n, falla) => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    servicio.updateSettings.mockRejectedValue(falla)
    const user = userEvent.setup()
    pintar()
    const propina = await screen.findByRole('switch', { name: 'steps.tip' })
    const get = retenida<TpvSettings>()
    servicio.getSettings.mockReturnValue(get.promesa)
    await user.click(propina)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'steps.saveError', description: 'steps.uncertain' }))
    // Mientras no se sepa, los pasos NO se presentan como conocidos (ni el valor viejo ni el supuesto).
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'steps.tip' })).not.toBeInTheDocument())
    // El server SÍ lo había guardado:
    await act(async () => get.resolver({ ...guardado, showTipScreen: false }))
    await waitFor(() => expect(interruptor('steps.tip')).toHaveAttribute('aria-checked', 'false'))
  })

  it('🔴 incierto con el PUT y el GET RETENIDOS: optimista, luego «sin confirmar» (sin interruptores), luego lo que el server TIENE', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    const put = retenida<TpvSettings>()
    servicio.updateSettings.mockReturnValue(put.promesa)
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('switch', { name: 'steps.tip' }))
    // 1. Mientras el PUT espera: se ve lo supuesto (optimista).
    await waitFor(() => expect(interruptor('steps.tip')).toHaveAttribute('aria-checked', 'false'))
    // 2. Se pierde la respuesta con la relectura RETENIDA: cada paso dice «sin confirmar» y no hay interruptor que mienta.
    const get = retenida<TpvSettings>()
    servicio.getSettings.mockReturnValue(get.promesa)
    await act(async () => put.rechazar(new Error('Network Error')))
    await waitFor(() => expect(screen.getAllByText('steps.unconfirmed')).toHaveLength(3))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText('steps.tip')).toBeInTheDocument()
    expect(screen.queryByText('steps.loadError')).not.toBeInTheDocument()
    // 3. El server NO lo había guardado: se ve prendida (lo de antes, pero porque el server lo DICE, no por suposición).
    await act(async () => get.resolver({ ...guardado }))
    await waitFor(() => expect(interruptor('steps.tip')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByText('steps.unconfirmed')).not.toBeInTheDocument()
    expect(servicio.updateSettings).toHaveBeenCalledTimes(1) // nunca se reenvía solo
  })

  it('incierto y la relectura también falla: se dice que no se pudieron cargar (nunca un valor inventado)', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    servicio.updateSettings.mockRejectedValue(new Error('Network Error'))
    const user = userEvent.setup()
    pintar()
    const propina = await screen.findByRole('switch', { name: 'steps.tip' })
    servicio.getSettings.mockRejectedValue(new Error('Network Error'))
    await user.click(propina)
    expect(await screen.findByText('steps.loadError')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'steps.tip' })).not.toBeInTheDocument()
    expect(screen.queryByText('steps.unconfirmed')).not.toBeInTheDocument()
  })

  it('el guardado conserva en la caché compartida lo que el PUT no devuelve (`trackPromoterLocationOverride`, de TpvSettingsForm)', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    guardado = { ...guardado, trackPromoterLocationOverride: true }
    // El PUT real devuelve `config.settings` mezclado: sin el override tri-estado, que sólo arma el GET.
    servicio.updateSettings.mockImplementation(async (_id, cambio) => {
      guardado = { ...guardado, ...cambio } as TpvSettings
      const { trackPromoterLocationOverride: _soloDelGet, ...sinElOverride } = guardado
      return sinElOverride as TpvSettings
    })
    const user = userEvent.setup()
    const { qc } = pintar()
    await user.click(await screen.findByRole('switch', { name: 'steps.review' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'steps.savedOff {"step":"steps.names.showReviewScreen"}' }))
    expect(qc.getQueryData<TpvSettings>(['tpvSettings', 't1'])).toMatchObject({ showReviewScreen: false, trackPromoterLocationOverride: true })
  })

  it('sólo lectura: interruptores deshabilitados y sin editor de porcentajes', async () => {
    permisos.add('tpv-settings:read')
    pintar()
    expect(await screen.findByRole('switch', { name: 'steps.tip' })).toBeDisabled()
    expect(screen.getByText('steps.readOnly')).toBeInTheDocument()
    expect(screen.queryByLabelText('steps.tipAddLabel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'steps.tipRemove {"percent":20}' })).not.toBeInTheDocument()
  })

  it('porcentajes: agregar uno válido manda la lista ordenada; uno inválido se explica y no se manda', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    const user = userEvent.setup()
    pintar()
    const campo = await screen.findByLabelText('steps.tipAddLabel')
    await user.type(campo, '0')
    await user.click(screen.getByRole('button', { name: 'steps.tipAdd' }))
    expect(screen.getByText('steps.tipInvalid')).toBeInTheDocument()
    expect(servicio.updateSettings).not.toHaveBeenCalled()
    await user.clear(campo)
    await user.type(campo, '18{Enter}')
    await waitFor(() => expect(servicio.updateSettings).toHaveBeenCalledWith('t1', { tipSuggestions: [10, 15, 18, 20] }))
  })

  it('quitar el porcentaje que era el predeterminado también lo limpia', async () => {
    permisos.add('tpv-settings:read').add('tpv-settings:update')
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'steps.tipRemove {"percent":20}' }))
    await waitFor(() => expect(servicio.updateSettings).toHaveBeenCalledWith('t1', { tipSuggestions: [10, 15], defaultTipPercentage: null }))
  })

  it('«Ofrecer recibo» avisa que hay que actualizar la app en POS; en una TPV no', async () => {
    permisos.add('tpv-settings:read')
    pintar('POS_IOS')
    expect(await screen.findByText('steps.receiptNeedsUpdate')).toBeInTheDocument()
  })
})
