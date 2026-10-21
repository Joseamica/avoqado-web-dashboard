import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCustomerDisplay,
  previewCustomerDisplay,
  resetCustomerDisplay,
  saveCustomerDisplay,
  uploadCustomerDisplayLogo,
  type CustomerDisplayAsset,
  type CustomerDisplayFicha,
  type CustomerDisplayReset,
  type CustomerDisplaySaved,
  type CustomerDisplayView,
} from '@/services/customerDisplay.service'
import { DEFAULT_TPV_SETTINGS } from '@/services/tpv-settings.service'
import { CustomerDisplayEditor } from '../CustomerDisplayEditor'
import { medirImagen } from '../medirImagen'
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
const conflicto = (code: string, message: string) => ({
  response: { status: 409, data: { message, code, details: { updatedById: 's2' } } },
})
/** Una promesa que la prueba resuelve cuando quiere: así se mira el estado MIENTRAS espera (Codex, tabla de pruebas). */
function retenida<T>() {
  let resolver!: (v: T) => void
  const promesa = new Promise<T>(r => (resolver = r))
  return { promesa, resolver }
}

/**
 * `desmontarAlCerrar`: como en la tarjeta (`{editando && <CustomerDisplayEditor …/>}`), cerrar DESMONTA el editor; ahí se
 * ve si una navegación retenida sobrevive al cierre.
 */
async function pintar(view = vistaDePrueba(), { desmontarAlCerrar = false }: { desmontarAlCerrar?: boolean } = {}) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(CLAVE, view)
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <QueryClientProvider client={qc}>
          <Montaje onClose={onClose} view={view} desmontarAlCerrar={desmontarAlCerrar} />
        </QueryClientProvider>
      ),
    },
    { path: '/otra', element: <div>otra página</div> },
  ])
  await act(async () => {
    render(<RouterProvider router={router} future={{ v7_startTransition: true }} />)
  })
  return { onClose, qc, router }
}
function Montaje({ onClose, view, desmontarAlCerrar }: { onClose: () => void; view: CustomerDisplayView; desmontarAlCerrar: boolean }) {
  const [abierto, setAbierto] = useState(true)
  if (!abierto) return <div>tarjeta</div>
  return (
    <CustomerDisplayEditor
      onClose={() => {
        onClose()
        if (desmontarAlCerrar) setAbierto(false)
      }}
      venueId="v1"
      terminalId="t1"
      deviceName="Caja 1"
      venueName="Testarudo"
      view={view}
      pasos={DEFAULT_TPV_SETTINGS}
      pasosConocidos
    />
  )
}
const guardarBtn = () => screen.getByRole('button', { name: 'editor.save' })
const bienvenida = () => screen.getByLabelText('editor.welcome')

beforeEach(() => {
  vi.mocked(previewCustomerDisplay).mockImplementation(async (_v, _t, design, previewSeq) => ({
    ficha: ficha({ theme: design.theme, welcomeText: design.welcomeText || null }),
    assetRejected: [],
    previewSeq,
  }))
})

describe('CustomerDisplayEditor — guardar', () => {
  it('«Guardar» sólo se prende con un cambio de verdad', async () => {
    const user = userEvent.setup()
    await pintar()
    expect(guardarBtn()).toBeDisabled()
    await user.type(bienvenida(), ' ')
    expect(guardarBtn()).toBeDisabled()
    await user.type(bienvenida(), 'Hola')
    expect(guardarBtn()).toBeEnabled()
  })

  it('🔴 mientras guarda, los campos se bloquean (nada escrito se pierde); al confirmar publica la vista nueva y cierra (Codex #5)', async () => {
    const espera = retenida<CustomerDisplaySaved>()
    vi.mocked(saveCustomerDisplay).mockReturnValue(espera.promesa)
    const user = userEvent.setup()
    const { onClose, qc } = await pintar()
    // «Otro logo» sin subir nada todavía: el borrador no cambia (sigue sin logo), pero ya existe el selector de archivo.
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    await user.type(bienvenida(), 'Hola')
    await user.click(guardarBtn())
    await waitFor(() => expect(bienvenida()).toBeDisabled())
    expect(screen.getByRole('button', { name: 'editor.themeDark' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'editor.colors.azul' })).toBeDisabled()
    // 🔴 Codex #2: el selector de archivo OCULTO también se bloquea (no sólo su botón) y Tab no llega a él; un archivo
    // elegido durante el guardado no arranca otra subida que cambiaría el borrador ya enviado.
    const selector = screen.getByTestId('customer-display-logo-input')
    expect(screen.getByRole('button', { name: 'editor.logoPick' })).toBeDisabled()
    expect(selector).toBeDisabled()
    expect(selector).toHaveAttribute('tabindex', '-1')
    await user.upload(selector, new File([new Uint8Array(10)], 'tarde.png', { type: 'image/png' }))
    expect(medirImagen).not.toHaveBeenCalled()
    expect(uploadCustomerDisplayLogo).not.toHaveBeenCalled()
    expect(saveCustomerDisplay).toHaveBeenCalledWith('v1', 't1', 'factory', {
      theme: 'LIGHT',
      accentColor: null,
      logoAssetId: null,
      welcomeText: 'Hola',
      thanksText: '',
    })
    const guardado = { ...DISENO_DE_FABRICA, welcomeText: 'Hola' }
    await act(async () =>
      espera.resolver({ editToken: 'd1:1', design: guardado, ficha: ficha({ fingerprint: 'nueva' }), assetRejected: [] }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(qc.getQueryData<CustomerDisplayView>(CLAVE)).toMatchObject({
      editToken: 'd1:1',
      design: guardado,
      ficha: { fingerprint: 'nueva' },
    })
    expect(toast).toHaveBeenCalledWith({ title: 'editor.saved {"name":"Caja 1"}' })
  })

  it('🔴 409 CONFLICT: el mensaje del SERVIDOR, «Guardar» bloqueado, «Recargar lo guardado» trae lo nuevo y el siguiente guardado usa el token NUEVO', async () => {
    vi.mocked(saveCustomerDisplay).mockRejectedValueOnce(
      conflicto('CUSTOMER_DISPLAY_CONFLICT', 'Alguien más guardó este diseño mientras lo editabas.'),
    )
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vistaDePrueba({ editToken: 'd1:5', design: { ...DISENO_DE_FABRICA, welcomeText: 'De otra persona' } }),
    )
    const user = userEvent.setup()
    const { onClose } = await pintar()
    await user.type(bienvenida(), 'Mío')
    await user.click(guardarBtn())
    expect(await screen.findByText('Alguien más guardó este diseño mientras lo editabas.')).toBeInTheDocument()
    expect(guardarBtn()).toBeDisabled()
    expect(saveCustomerDisplay).toHaveBeenCalledTimes(1) // no se reintenta solo
    await user.click(screen.getByRole('button', { name: 'editor.reload' }))
    await waitFor(() => expect(bienvenida()).toHaveValue('De otra persona'))
    expect(screen.queryByText('Alguien más guardó este diseño mientras lo editabas.')).not.toBeInTheDocument()
    vi.mocked(saveCustomerDisplay).mockResolvedValue({ editToken: 'd1:6', design: DISENO_DE_FABRICA, ficha: ficha(), assetRejected: [] })
    await user.type(bienvenida(), '!')
    await user.click(guardarBtn())
    await waitFor(() => expect(saveCustomerDisplay).toHaveBeenLastCalledWith('v1', 't1', 'd1:5', expect.anything()))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('409 BUSY: dice el mensaje y deja reintentar con el mismo token', async () => {
    vi.mocked(saveCustomerDisplay)
      .mockRejectedValueOnce(conflicto('CUSTOMER_DISPLAY_BUSY', 'Otro cambio se cruzó; vuelve a intentarlo.'))
      .mockResolvedValueOnce({ editToken: 'd1:1', design: DISENO_DE_FABRICA, ficha: ficha(), assetRejected: [] })
    const user = userEvent.setup()
    const { onClose } = await pintar()
    await user.type(bienvenida(), 'Hola')
    await user.click(guardarBtn())
    expect(await screen.findByText('Otro cambio se cruzó; vuelve a intentarlo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'editor.reload' })).not.toBeInTheDocument()
    await user.click(guardarBtn())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(vi.mocked(saveCustomerDisplay).mock.calls.map(c => c[2])).toEqual(['factory', 'factory'])
  })

  it('el dispositivo se mudó (404): el mensaje del servidor y el editor NO se cierra en silencio', async () => {
    vi.mocked(saveCustomerDisplay).mockRejectedValue({ response: { status: 404, data: { message: 'Dispositivo no encontrado' } } })
    const user = userEvent.setup()
    const { onClose } = await pintar()
    await user.type(bienvenida(), 'Hola')
    await user.click(guardarBtn())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'editor.saveError', description: 'Dispositivo no encontrado' }),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('🔴 mientras sube un logo no se puede volver al del negocio ni guardar; al terminar, el borrador usa el activo (Codex #6)', async () => {
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    const subida = retenida<CustomerDisplayAsset>()
    vi.mocked(uploadCustomerDisplayLogo).mockReturnValue(subida.promesa)
    const user = userEvent.setup()
    await pintar(vistaDePrueba({ editToken: 'd1:2', design: PROPIO }))
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    await user.upload(screen.getByTestId('customer-display-logo-input'), new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'editor.factory' })).toBeDisabled()
    expect(guardarBtn()).toBeDisabled()
    await act(async () =>
      subida.resolver({ assetId: 'asset-1', url: 'https://storage.googleapis.com/b/x.png', sha256: 'h', width: 800, height: 800 }),
    )
    await waitFor(() => expect(vi.mocked(previewCustomerDisplay).mock.lastCall?.[2]).toMatchObject({ logoAssetId: 'asset-1' }))
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeEnabled()
  })
})

describe('CustomerDisplayEditor — salir y volver a fábrica', () => {
  it('cerrar sin cambios cierra; con cambios pregunta; «Seguir editando» conserva; «Salir sin guardar» cierra sin mandar nada', async () => {
    const user = userEvent.setup()
    const { onClose } = await pintar()
    await user.click(screen.getByTestId('customer-display-editor-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.type(screen.getByLabelText('editor.thanks'), 'Vuelve pronto')
    await user.click(screen.getByTestId('customer-display-editor-close'))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('editor.leaveTitle')
    await user.click(screen.getByRole('button', { name: 'editor.leaveStay' }))
    expect(screen.getByLabelText('editor.thanks')).toHaveValue('Vuelve pronto')
    await user.click(screen.getByTestId('customer-display-editor-close'))
    await user.click(await screen.findByRole('button', { name: 'editor.leaveGo' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(saveCustomerDisplay).not.toHaveBeenCalled()
  })

  it.each([
    ['CONFLICT', 'CUSTOMER_DISPLAY_CONFLICT', 'Alguien más guardó este diseño mientras lo editabas.'],
    ['BUSY', 'CUSTOMER_DISPLAY_BUSY', 'Otro cambio se cruzó; vuelve a intentarlo.'],
  ])('🔴 tras un 409 %s, Atrás o un enlace PREGUNTAN; no se cancelan en silencio (Codex #7)', async (_n, code, mensaje) => {
    vi.mocked(saveCustomerDisplay).mockRejectedValue(conflicto(code, mensaje))
    const user = userEvent.setup()
    const { router } = await pintar()
    await user.type(bienvenida(), 'Mío')
    await user.click(guardarBtn())
    await screen.findByText(mensaje)
    await act(async () => {
      void router.navigate('/otra')
    })
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('editor.leaveTitle')
    await user.click(screen.getByRole('button', { name: 'editor.leaveGo' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/otra'))
  })

  it('🔴 navegar mientras restablece ESPERA, y al terminar (ya sin cambios) sigue sola', async () => {
    const espera = retenida<CustomerDisplayReset>()
    vi.mocked(resetCustomerDisplay).mockReturnValue(espera.promesa)
    const user = userEvent.setup()
    const { router } = await pintar(vistaDePrueba({ editToken: 'd1:2', design: PROPIO }))
    await user.click(screen.getByRole('button', { name: 'editor.factory' }))
    await user.click(await screen.findByRole('button', { name: 'editor.factoryConfirm' }))
    await waitFor(() => expect(bienvenida()).toBeDisabled())
    await act(async () => {
      void router.navigate('/otra')
    })
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByText('editor.leaveTitle')).not.toBeInTheDocument()
    await act(async () => espera.resolver({ editToken: 'd1:3', design: DISENO_DE_FABRICA, ficha: ficha() }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/otra'))
  })

  it('«Volver al diseño de fábrica» no aparece si ya es de fábrica', async () => {
    await pintar()
    expect(screen.queryByRole('button', { name: 'editor.factory' })).not.toBeInTheDocument()
  })

  it('volver a fábrica pide confirmación, manda el token y deja el borrador y la tarjeta en fábrica', async () => {
    vi.mocked(resetCustomerDisplay).mockResolvedValue({ editToken: 'd1:3', design: DISENO_DE_FABRICA, ficha: ficha() })
    const user = userEvent.setup()
    const { qc } = await pintar(vistaDePrueba({ editToken: 'd1:2', design: PROPIO }))
    await user.click(screen.getByRole('button', { name: 'editor.factory' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('editor.factoryTitle')
    expect(resetCustomerDisplay).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'editor.factoryConfirm' }))
    await waitFor(() => expect(resetCustomerDisplay).toHaveBeenCalledWith('v1', 't1', 'd1:2'))
    await waitFor(() => expect(bienvenida()).toHaveValue(''))
    expect(qc.getQueryData<CustomerDisplayView>(CLAVE)).toMatchObject({ editToken: 'd1:3', design: DISENO_DE_FABRICA })
    expect(toast).toHaveBeenCalledWith({ title: 'editor.factoryDone {"name":"Caja 1"}' })
  })
})

describe('CustomerDisplayEditor — ronda 1 de la revisión de B3', () => {
  it('🔴 navegar mientras guarda ESPERA; al guardarse, la navegación SIGUE aunque cerrar desmonte el editor (como en la tarjeta)', async () => {
    const espera = retenida<CustomerDisplaySaved>()
    vi.mocked(saveCustomerDisplay).mockReturnValue(espera.promesa)
    const user = userEvent.setup()
    const { onClose, router } = await pintar(vistaDePrueba(), { desmontarAlCerrar: true })
    await user.type(bienvenida(), 'Hola')
    await user.click(guardarBtn())
    await waitFor(() => expect(bienvenida()).toBeDisabled())
    await act(async () => {
      void router.navigate('/otra')
    })
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByText('editor.leaveTitle')).not.toBeInTheDocument()
    await act(async () =>
      espera.resolver({ editToken: 'd1:1', design: { ...DISENO_DE_FABRICA, welcomeText: 'Hola' }, ficha: ficha(), assetRejected: [] }),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/otra'))
    expect(onClose).toHaveBeenCalled()
    expect(await screen.findByText('otra página')).toBeInTheDocument()
  })

  it('🔴 «Recargar lo guardado» mientras sube un logo: la subida que llega DESPUÉS ya no cambia el borrador', async () => {
    vi.mocked(saveCustomerDisplay).mockRejectedValueOnce(
      conflicto('CUSTOMER_DISPLAY_CONFLICT', 'Alguien más guardó este diseño mientras lo editabas.'),
    )
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vistaDePrueba({ editToken: 'd1:5', design: { ...DISENO_DE_FABRICA, welcomeText: 'De otra persona' } }),
    )
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    const subida = retenida<CustomerDisplayAsset>()
    vi.mocked(uploadCustomerDisplayLogo).mockReturnValue(subida.promesa)
    const user = userEvent.setup()
    await pintar()
    await user.type(bienvenida(), 'Mío')
    await user.click(guardarBtn())
    await screen.findByText('Alguien más guardó este diseño mientras lo editabas.')
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    await user.upload(screen.getByTestId('customer-display-logo-input'), new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'editor.reload' }))
    await waitFor(() => expect(bienvenida()).toHaveValue('De otra persona'))
    await act(async () =>
      subida.resolver({ assetId: 'tarde', url: 'https://storage.googleapis.com/b/t.png', sha256: 'h', width: 800, height: 800 }),
    )
    await waitFor(() => expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeEnabled())
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeChecked()
    // Más que el debounce de la vista previa, dentro de `act`: la que salga se resuelve aquí y no ensucia la salida.
    await act(async () => {
      await new Promise(r => setTimeout(r, 400))
    })
    expect(vi.mocked(previewCustomerDisplay).mock.calls.some(c => c[2].logoAssetId === 'tarde')).toBe(false)
    expect(guardarBtn()).toBeDisabled() // nada cambió respecto a lo recargado
  })

  it('🔴 dos subidas retenidas: la vieja resuelve DESPUÉS de que empezó la nueva y NO apaga el indicador; sólo la nueva lo apaga', async () => {
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    const vieja = retenida<CustomerDisplayAsset>()
    const nueva = retenida<CustomerDisplayAsset>()
    vi.mocked(uploadCustomerDisplayLogo).mockReturnValueOnce(vieja.promesa).mockReturnValueOnce(nueva.promesa)
    const user = userEvent.setup()
    await pintar()
    await user.type(bienvenida(), 'Hola') // hay un cambio: sin subida en vuelo, «Guardar» estaría prendido
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    const entrada = screen.getByTestId('customer-display-logo-input')
    await user.upload(entrada, new File([new Uint8Array(10)], 'vieja.png', { type: 'image/png' }))
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalledTimes(1))
    // La UI ya no ofrece una segunda subida mientras la primera va en camino (Codex #2: el selector se bloquea)…
    await waitFor(() => expect(entrada).toBeDisabled())
    // …pero el número de subida sigue como defensa: un `change` programático (sin pasar por la UI) arranca la segunda.
    fireEvent.change(entrada, { target: { files: [new File([new Uint8Array(10)], 'nueva.png', { type: 'image/png' })] } })
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalledTimes(2))
    expect(screen.getByText('editor.logoUploading')).toBeInTheDocument()
    expect(guardarBtn()).toBeDisabled()

    await act(async () =>
      vieja.resolver({ assetId: 'vieja', url: 'https://storage.googleapis.com/b/v.png', sha256: 'h', width: 800, height: 800 }),
    )
    // Su resultado ya no aplica y su `finally` no es de la subida que sigue en vuelo.
    expect(screen.getByText('editor.logoUploading')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeDisabled()
    expect(guardarBtn()).toBeDisabled()

    await act(async () =>
      nueva.resolver({ assetId: 'nueva', url: 'https://storage.googleapis.com/b/n.png', sha256: 'h', width: 800, height: 800 }),
    )
    await waitFor(() => expect(guardarBtn()).toBeEnabled())
    expect(screen.queryByText('editor.logoUploading')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeEnabled()
    await waitFor(() => expect(vi.mocked(previewCustomerDisplay).mock.lastCall?.[2]).toMatchObject({ logoAssetId: 'nueva' }))
    expect(vi.mocked(previewCustomerDisplay).mock.calls.some(c => c[2].logoAssetId === 'vieja')).toBe(false)
  })

  it('🔴 «Recargar lo guardado» con una subida en vuelo: el indicador se apaga al recargar, sin esperar a que la subida termine', async () => {
    vi.mocked(saveCustomerDisplay).mockRejectedValueOnce(
      conflicto('CUSTOMER_DISPLAY_CONFLICT', 'Alguien más guardó este diseño mientras lo editabas.'),
    )
    vi.mocked(getCustomerDisplay).mockResolvedValue(
      vistaDePrueba({ editToken: 'd1:5', design: { ...DISENO_DE_FABRICA, welcomeText: 'De otra persona' } }),
    )
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    const subida = retenida<CustomerDisplayAsset>()
    vi.mocked(uploadCustomerDisplayLogo).mockReturnValue(subida.promesa)
    const user = userEvent.setup()
    await pintar()
    await user.type(bienvenida(), 'Mío')
    await user.click(guardarBtn())
    await screen.findByText('Alguien más guardó este diseño mientras lo editabas.')
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    await user.upload(screen.getByTestId('customer-display-logo-input'), new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' }))
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'editor.reload' }))
    await waitFor(() => expect(bienvenida()).toHaveValue('De otra persona'))
    // La subida SIGUE retenida: lo recargado ya la descartó, así que nada debe quedar «subiendo».
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'editor.factory' })).toBeEnabled()
    await user.type(bienvenida(), '!')
    expect(guardarBtn()).toBeEnabled()

    await act(async () =>
      subida.resolver({ assetId: 'tarde', url: 'https://storage.googleapis.com/b/t.png', sha256: 'h', width: 800, height: 800 }),
    )
    expect(screen.getByRole('radio', { name: 'editor.logoVenue' })).toBeChecked()
    expect(guardarBtn()).toBeEnabled()
    await act(async () => {
      await new Promise(r => setTimeout(r, 400))
    })
    expect(vi.mocked(previewCustomerDisplay).mock.calls.some(c => c[2].logoAssetId === 'tarde')).toBe(false)
  })
})
