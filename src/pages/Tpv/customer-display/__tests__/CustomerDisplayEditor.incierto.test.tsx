/**
 * Guardar y volver a fábrica con un resultado INCIERTO (ruling del coordinador tras B2, fix round 1): sin respuesta, un 5xx
 * genérico, o un 409/429 del REINTENTO automático de `src/api.ts` (el primer intento pudo haber guardado). El editor NO
 * reenvía nada: relee la vista y decide con lo que el servidor TIENE. Todas las respuestas se RETIENEN: así se mira el
 * editor mientras espera.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCustomerDisplay,
  previewCustomerDisplay,
  resetCustomerDisplay,
  saveCustomerDisplay,
  type CustomerDisplayFicha,
  type CustomerDisplayReset,
  type CustomerDisplaySaved,
  type CustomerDisplayView,
} from '@/services/customerDisplay.service'
import { DEFAULT_TPV_SETTINGS } from '@/services/tpv-settings.service'
import { CustomerDisplayEditor } from '../CustomerDisplayEditor'
import { DISENO_DE_FABRICA } from '../model'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/services/customerDisplay.service', () => ({
  getCustomerDisplay: vi.fn(),
  previewCustomerDisplay: vi.fn(),
  saveCustomerDisplay: vi.fn(),
  resetCustomerDisplay: vi.fn(),
  uploadCustomerDisplayLogo: vi.fn(),
}))
vi.mock('../medirImagen', () => ({ medirImagen: vi.fn() }))

const ficha = (extra: Partial<CustomerDisplayFicha> = {}): CustomerDisplayFicha => ({
  schemaVersion: 1,
  fingerprint: 'fp',
  theme: 'LIGHT',
  accent: { custom: false },
  logo: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  promotionCards: { enabled: false },
  poweredBy: true,
  ...extra,
})
function vistaDePrueba(extra: Partial<CustomerDisplayView> = {}): CustomerDisplayView {
  return {
    terminal: { id: 't1', name: 'Caja 1' },
    editToken: 'factory',
    design: { ...DISENO_DE_FABRICA },
    ficha: ficha(),
    entitlements: { slides: false, promotionCards: false },
    assetRejected: [],
    device: {
      presence: 'SUPPORTED',
      stale: false,
      capabilitiesObservedAt: null,
      lastHeartbeat: null,
      designVersion: 1,
      ack: null,
      installationWarning: false,
    },
    ...extra,
  }
}
const PROPIO = { ...DISENO_DE_FABRICA, theme: 'DARK' as const, welcomeText: 'Hola' }
const CLAVE = ['customer-display', 'v1', 't1'] as const
const MENSAJE_409 = 'Alguien más guardó este diseño mientras lo editabas.'

/** Sin respuesta: la red se cayó (también tras el reintento de `src/api.ts`). */
const perdida = () => ({ message: 'Network Error', config: { _retry: true } })
/** El 409 que contesta el REINTENTO automático: nuestro primer intento pudo haber cambiado el token. */
const conflictoDelReintento = () => ({
  response: { status: 409, data: { message: MENSAJE_409, code: 'CUSTOMER_DISPLAY_CONFLICT', details: { updatedById: 's1' } } },
  config: { _retry: true },
})
const error500 = () => ({ response: { status: 500, data: { message: 'Ocurrió un error inesperado en el servidor.' } } })

/** Una promesa que la prueba resuelve o rechaza cuando quiere: así se mira el estado MIENTRAS espera. */
function retenida<T>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((res, rej) => {
    resolver = res
    rechazar = rej
  })
  return { promesa, resolver, rechazar }
}

function pintar(view = vistaDePrueba()) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(CLAVE, view)
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <QueryClientProvider client={qc}>
          <CustomerDisplayEditor
            onClose={onClose}
            venueId="v1"
            terminalId="t1"
            deviceName="Caja 1"
            venueName="Testarudo"
            view={view}
            pasos={DEFAULT_TPV_SETTINGS}
            pasosConocidos
          />
        </QueryClientProvider>
      ),
    },
    { path: '/otra', element: <div>otra página</div> },
  ])
  render(<RouterProvider router={router} />)
  return { onClose, qc, router }
}
const guardarBtn = () => screen.getByRole('button', { name: 'editor.save' })
const guardandoBtn = () => screen.getByRole('button', { name: 'editor.saving' })
const bienvenida = () => screen.getByLabelText('editor.welcome')

beforeEach(() => {
  vi.mocked(previewCustomerDisplay).mockImplementation(async (_v, _t, design, previewSeq) => ({
    ficha: ficha({ theme: design.theme, welcomeText: design.welcomeText || null }),
    assetRejected: [],
    previewSeq,
  }))
})

/** Escribe «Hola», toca Guardar con el PUT retenido y devuelve las dos esperas (PUT y relectura). */
async function guardarConEsperas(user: ReturnType<typeof userEvent.setup>) {
  const put = retenida<CustomerDisplaySaved>()
  const relectura = retenida<CustomerDisplayView>()
  vi.mocked(saveCustomerDisplay).mockReturnValue(put.promesa)
  vi.mocked(getCustomerDisplay).mockReturnValue(relectura.promesa)
  await user.type(bienvenida(), 'Hola')
  await user.click(guardarBtn())
  await waitFor(() => expect(bienvenida()).toBeDisabled())
  return { put, relectura }
}

describe('CustomerDisplayEditor — guardar con resultado incierto', () => {
  it('🔴 respuesta PERDIDA y el servidor SÍ lo aplicó: mientras relee no afirma nada; después es «Guardado» y cierra, sin reenviar', async () => {
    const user = userEvent.setup()
    const { onClose, qc } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(perdida()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalledWith('v1', 't1'))
    // Releyendo: los campos siguen bloqueados y no hay ni «Guardado» ni error ni aviso todavía.
    expect(bienvenida()).toBeDisabled()
    expect(guardandoBtn()).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(screen.queryByText('editor.saveUncertain')).not.toBeInTheDocument()
    const enElServidor = vistaDePrueba({
      editToken: 'd1:7',
      design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' },
      ficha: ficha({ fingerprint: 'aplicada', welcomeText: 'Hola' }),
    })
    await act(async () => relectura.resolver(enElServidor))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith({ title: 'editor.saved {"name":"Caja 1"}' })
    expect(qc.getQueryData<CustomerDisplayView>(CLAVE)).toMatchObject({
      editToken: 'd1:7',
      design: { welcomeText: 'Hola' },
      ficha: { fingerprint: 'aplicada' },
    })
    expect(saveCustomerDisplay).toHaveBeenCalledTimes(1) // nunca se reenvía solo
    expect(screen.queryByText('editor.saveUncertain')).not.toBeInTheDocument()
  })

  it('🔴 respuesta PERDIDA y el servidor NO lo aplicó: el borrador se queda, se avisa, se ofrece recargar y reintentar va con el MISMO token', async () => {
    const user = userEvent.setup()
    const { onClose } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(perdida()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    expect(bienvenida()).toBeDisabled()
    await act(async () => relectura.resolver(vistaDePrueba())) // el servidor sigue de fábrica: no se guardó
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(bienvenida()).toHaveValue('Hola')
    expect(bienvenida()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'editor.reload' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(saveCustomerDisplay).toHaveBeenCalledTimes(1)
    // La persona decide reintentar: CAS con el token de lo que LEYÓ (si alguien más guardó, el server dirá 409).
    vi.mocked(saveCustomerDisplay).mockResolvedValue({
      editToken: 'd1:1',
      design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' },
      ficha: ficha(),
      assetRejected: [],
    })
    expect(guardarBtn()).toBeEnabled()
    await user.click(guardarBtn())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(vi.mocked(saveCustomerDisplay).mock.calls.map(c => c[2])).toEqual(['factory', 'factory'])
  })

  it('«Recargar lo guardado» tras el aviso trae lo del servidor y quita el aviso', async () => {
    const user = userEvent.setup()
    pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(perdida()))
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:9', design: { ...DISENO_DE_FABRICA, welcomeText: 'Otro' } })))
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(bienvenida()).toHaveValue('Hola')
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vistaDePrueba({ editToken: 'd1:9', design: { ...DISENO_DE_FABRICA, welcomeText: 'Otro' } }),
    )
    await user.click(screen.getByRole('button', { name: 'editor.reload' }))
    await waitFor(() => expect(bienvenida()).toHaveValue('Otro'))
    expect(screen.queryByText('editor.saveUncertain')).not.toBeInTheDocument()
  })

  it('🔴 un 409 del REINTENTO automático se reconcilia: si quedó lo nuestro es «Guardado», nunca «alguien más guardó»', async () => {
    const user = userEvent.setup()
    const { onClose } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(conflictoDelReintento()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    expect(screen.queryByText(MENSAJE_409)).not.toBeInTheDocument()
    expect(bienvenida()).toBeDisabled()
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:4', design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' } })))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith({ title: 'editor.saved {"name":"Caja 1"}' })
    expect(screen.queryByText(MENSAJE_409)).not.toBeInTheDocument()
    expect(saveCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('un 409 del reintento que NO quedó: el aviso es «no pudimos confirmar», no el «alguien más guardó» del reintento', async () => {
    const user = userEvent.setup()
    const { onClose } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(conflictoDelReintento()))
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:4', design: { ...DISENO_DE_FABRICA, welcomeText: 'Ajeno' } })))
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(screen.queryByText(MENSAJE_409)).not.toBeInTheDocument()
    expect(bienvenida()).toHaveValue('Hola')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('si la relectura TAMBIÉN falla, el borrador se queda y se avisa igual (sin reenviar)', async () => {
    const user = userEvent.setup()
    const { onClose } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(perdida()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    expect(bienvenida()).toBeDisabled()
    await act(async () => relectura.rechazar(perdida()))
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(bienvenida()).toHaveValue('Hola')
    expect(bienvenida()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'editor.reload' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(saveCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('un 500 genérico es incierto: se relee; el aviso lleva el texto del servidor como detalle y no hay toast de error', async () => {
    const user = userEvent.setup()
    pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(error500()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    await act(async () => relectura.resolver(vistaDePrueba()))
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(screen.getByText('Ocurrió un error inesperado en el servidor.')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
    expect(bienvenida()).toHaveValue('Hola')
  })

  it('🔴 navegar mientras se reconcilia ESPERA; si quedó guardado, sigue sola sin preguntar', async () => {
    const user = userEvent.setup()
    const { router } = pintar()
    const { put, relectura } = await guardarConEsperas(user)
    await act(async () => put.rechazar(perdida()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    await act(async () => {
      void router.navigate('/otra')
    })
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByText('editor.leaveTitle')).not.toBeInTheDocument()
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:7', design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' } })))
    await waitFor(() => expect(router.state.location.pathname).toBe('/otra'))
  })
})

describe('CustomerDisplayEditor — volver a fábrica con resultado incierto', () => {
  async function restablecerConEsperas(user: ReturnType<typeof userEvent.setup>) {
    const post = retenida<CustomerDisplayReset>()
    const relectura = retenida<CustomerDisplayView>()
    vi.mocked(resetCustomerDisplay).mockReturnValue(post.promesa)
    vi.mocked(getCustomerDisplay).mockReturnValue(relectura.promesa)
    await user.click(screen.getByRole('button', { name: 'editor.factory' }))
    await user.click(await screen.findByRole('button', { name: 'editor.factoryConfirm' }))
    await waitFor(() => expect(bienvenida()).toBeDisabled())
    return { post, relectura }
  }

  it('🔴 respuesta PERDIDA y el servidor YA está de fábrica: se da por hecho (borrador, tarjeta y aviso de listo)', async () => {
    const user = userEvent.setup()
    const { qc } = pintar(vistaDePrueba({ editToken: 'd1:2', design: PROPIO }))
    const { post, relectura } = await restablecerConEsperas(user)
    await act(async () => post.rechazar(perdida()))
    await waitFor(() => expect(getCustomerDisplay).toHaveBeenCalled())
    expect(bienvenida()).toBeDisabled()
    expect(toast).not.toHaveBeenCalled()
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:3' })))
    await waitFor(() => expect(bienvenida()).toHaveValue(''))
    expect(toast).toHaveBeenCalledWith({ title: 'editor.factoryDone {"name":"Caja 1"}' })
    expect(qc.getQueryData<CustomerDisplayView>(CLAVE)).toMatchObject({ editToken: 'd1:3', design: DISENO_DE_FABRICA })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('editor.saveUncertain')).not.toBeInTheDocument()
    expect(resetCustomerDisplay).toHaveBeenCalledTimes(1)
  })

  it('respuesta PERDIDA y el servidor NO quedó de fábrica: el borrador se queda y se avisa (sin reenviar)', async () => {
    const user = userEvent.setup()
    pintar(vistaDePrueba({ editToken: 'd1:2', design: PROPIO }))
    const { post, relectura } = await restablecerConEsperas(user)
    await act(async () => post.rechazar(perdida()))
    await act(async () => relectura.resolver(vistaDePrueba({ editToken: 'd1:2', design: PROPIO })))
    expect(await screen.findByText('editor.saveUncertain')).toBeInTheDocument()
    expect(bienvenida()).toHaveValue('Hola')
    expect(bienvenida()).toBeEnabled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
    expect(resetCustomerDisplay).toHaveBeenCalledTimes(1)
  })
})
