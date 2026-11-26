/**
 * La ficha de un POS de Windows enseña, sólo de lectura, cómo dibuja su computadora (hz:a5fa2439:D2): rendimiento,
 * gráficos, procesador, memoria y el modo de dibujo con su estado. Se prueba con i18next REAL para ver los textos que
 * lee el dueño en cada idioma; una terminal o una tablet se siguen viendo exactamente igual.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import commonEn from '@/locales/en/common.json'
import commonEs from '@/locales/es/common.json'
import tpvEn from '@/locales/en/tpv.json'
import tpvEs from '@/locales/es/tpv.json'
import TpvId from '../TpvId'

const { apiGet, aparato } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  aparato: { datos: {} as Record<string, unknown> },
}))

vi.mock('@/api', () => ({
  default: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'OWNER' } }) }))
vi.mock('@/context/BreadcrumbContext', () => ({
  useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }),
}))
vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: null, joinVenueRoom: () => {}, leaveVenueRoom: () => {} }),
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'venue-1',
    venueSlug: 'test-venue',
    venue: { timezone: 'America/Mexico_City' },
    fullBasePath: '/venues/test-venue',
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('../components/CommandHistoryTable', () => ({ CommandHistoryTable: () => <div /> }))
// La regla real de la inversión de pantalla (5 s mientras está pendiente): la ficha de Windows debe conservarla.
vi.mock('../components/DisplayModeRequestControl', async importOriginal => ({
  ...(await importOriginal<typeof import('../components/DisplayModeRequestControl')>()),
  DisplayModeRequestControl: () => <div />,
}))
vi.mock('../components/MessagesTab', () => ({ MessagesTab: () => <div /> }))
vi.mock('../components/RemoteCommandPanel', () => ({ RemoteCommandPanel: () => <div /> }))
vi.mock('@/pages/Settings/components/TpvSettingsForm', () => ({ TpvSettingsForm: () => <div /> }))
vi.mock('../customer-display/CustomerDisplaySection', () => ({ CustomerDisplaySection: () => <div /> }))
// El bloque «Configuración» pide la pantalla del cliente y los pasos del cobro: no es parte de esta sección.
vi.mock('../components/DeviceSetupBlock', () => ({ DeviceSetupBlock: () => <div /> }))

const PC_WINDOWS = {
  id: 'device-1',
  name: 'PC de caja',
  serialNumber: null,
  type: 'POS_ANDROID',
  status: 'ACTIVE',
  venueId: 'venue-1',
  osVersion: 'Android 14',
  modelIdentifier: 'Windows 11',
  model: 'Avoqado Windows 11',
  version: '2.30.0-escritorio',
  customerDisplayInverted: false,
  systemInfo: { memory: { total: 2048, used: 512 } },
}

const MEDICION_RAPIDA = {
  proc: 'abc',
  rev: 3,
  api: 'OPENGL',
  paintMs: 700,
  performance: 'LIGHT',
  drawingMode: 'FAST',
  forced: true,
  failed: false,
  manual: false,
  light: true,
  cpu: 'Intel Celeron N4020',
  cores: 2,
  ramGb: 4,
  screen: '1366x768',
  receivedAt: '2026-11-24T18:00:00.000Z',
}

let clienteActual: QueryClient

async function pintar(datos: Record<string, unknown>, lng: 'es' | 'en' = 'es') {
  aparato.datos = datos
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng,
    ns: ['tpv', 'common'],
    defaultNS: 'tpv',
    resources: { es: { tpv: tpvEs, common: commonEs }, en: { tpv: tpvEn, common: commonEn } },
    interpolation: { escapeValue: false },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
  clienteActual = queryClient
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/venues/test-venue/devices/device-1']}>
          <Routes>
            <Route path="/venues/:slug/devices/:tpvId" element={<TpvId />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
  const titulo = lng === 'es' ? 'Este dispositivo' : 'This device'
  return (await screen.findByRole('heading', { name: titulo })).closest('section') as HTMLElement
}

/** El valor (`dd`) del renglón cuya etiqueta es exactamente `etiqueta`. */
function renglon(seccion: HTMLElement, etiqueta: string): HTMLElement {
  const dt = within(seccion).getByText(etiqueta, { selector: 'dt' })
  return dt.parentElement?.querySelector('dd') as HTMLElement
}

/** Cada cuánto se refresca sola la consulta de la ficha, tal como la decide la página con lo que ya leyó. */
function intervaloDeLaFicha(): unknown {
  const consulta = clienteActual.getQueryCache().find({ queryKey: ['tpv', 'venue-1', 'device-1'] })
  const opcion = consulta?.observers[0]?.options.refetchInterval
  return typeof opcion === 'function' ? (opcion as (q: unknown) => unknown)(consulta) : opcion
}

const INVERSION_PENDIENTE = {
  requestId: 'req-1',
  desiredInverted: true,
  status: 'PENDING',
  requestedAt: '2026-11-25T12:00:00.000Z',
  requestedBy: 'staff-1',
  expiresAt: '2026-11-25T12:05:00.000Z',
}

function etiquetas(seccion: HTMLElement): string[] {
  return within(seccion)
    .getAllByRole('term')
    .map(dt => dt.textContent ?? '')
}

describe('ficha del aparato — rendimiento y modo de dibujo del POS de Windows', () => {
  beforeEach(() => {
    apiGet.mockImplementation(async (path: string) =>
      path === '/api/v1/dashboard/venues/venue-1/tpv/device-1' ? { data: aparato.datos } : { data: { data: [] } },
    )
  })

  it('con la medición completa enseña cada dato, el modo activo y dónde se cambia', async () => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: MEDICION_RAPIDA })

    const rendimiento = renglon(seccion, 'Rendimiento')
    expect(within(rendimiento).getByText('Modo rápido')).toBeInTheDocument()
    expect(within(rendimiento).getByText('Esta computadora dibuja sin la tarjeta de video y con menos animaciones.')).toBeInTheDocument()
    expect(within(rendimiento).getByText('Tarda 0.7 s en dibujar al abrir')).toBeInTheDocument()
    expect(within(rendimiento).getByText(/^Actualizado el .*2026/)).toBeInTheDocument()
    expect(renglon(seccion, 'Gráficos')).toHaveTextContent('Tarjeta de video (OpenGL)')
    expect(renglon(seccion, 'Procesador')).toHaveTextContent('Intel Celeron N4020')
    expect(renglon(seccion, 'Memoria de la computadora')).toHaveTextContent('4 GB')

    const modo = renglon(seccion, 'Modo de dibujo')
    expect(within(modo).getByText('Modo rápido')).toBeInTheDocument()
    expect(within(modo).getByText('Activo.')).toBeInTheDocument()
    expect(
      within(modo).getByText('Se cambia en la computadora: en el aviso «Activar modo rápido» o en Más › Modo de dibujo.'),
    ).toBeInTheDocument()

    // La memoria de la app sigue en su renglón, aparte de la de la computadora.
    expect(renglon(seccion, 'Memoria de la app')).toHaveTextContent('512 MB de 2048 MB')
    // Sólo de lectura: ningún botón ni interruptor en la sección.
    expect(within(seccion).queryAllByRole('button')).toHaveLength(0)
    expect(within(seccion).queryAllByRole('switch')).toHaveLength(0)
  })

  it('en inglés dice lo mismo', async () => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: MEDICION_RAPIDA }, 'en')

    const rendimiento = renglon(seccion, 'Performance')
    expect(within(rendimiento).getByText('Fast mode')).toBeInTheDocument()
    expect(within(rendimiento).getByText('This computer draws without the graphics card and with fewer animations.')).toBeInTheDocument()
    expect(within(rendimiento).getByText('Takes 0.7 s to draw on open')).toBeInTheDocument()
    expect(within(rendimiento).getByText(/^Updated on .*2026/)).toBeInTheDocument()
    expect(renglon(seccion, 'Graphics')).toHaveTextContent('Graphics card (OpenGL)')
    expect(renglon(seccion, 'Processor')).toHaveTextContent('Intel Celeron N4020')
    expect(renglon(seccion, 'Computer memory')).toHaveTextContent('4 GB')
    const modo = renglon(seccion, 'Drawing mode')
    expect(within(modo).getByText('Fast mode')).toBeInTheDocument()
    expect(within(modo).getByText('Active.')).toBeInTheDocument()
    expect(
      within(modo).getByText('It is changed on the computer: in the "Turn on fast mode" notice or in More › Drawing mode.'),
    ).toBeInTheDocument()
  })

  it('una PC lenta en automático dice «No alcanza» y el modo automático, con la pista', async () => {
    const seccion = await pintar({
      ...PC_WINDOWS,
      deviceDiagnostics: { ...MEDICION_RAPIDA, performance: 'INSUFFICIENT', drawingMode: 'AUTO', forced: false, paintMs: 4200 },
    })

    const rendimiento = renglon(seccion, 'Rendimiento')
    // Texto de aviso legible en claro y en oscuro: `text-warning` a secas da ~2:1 sobre la tarjeta.
    expect(within(rendimiento).getByText('No alcanza')).toHaveClass('text-warning-foreground', 'dark:text-warning')
    expect(
      within(rendimiento).getByText('Esta computadora tarda demasiado en dibujar la pantalla. La app va a responder lento.'),
    ).toBeInTheDocument()
    expect(within(rendimiento).getByText('Tarda 4.2 s en dibujar al abrir')).toBeInTheDocument()
    const modo = renglon(seccion, 'Modo de dibujo')
    expect(within(modo).getByText('Automático')).toBeInTheDocument()
    expect(within(modo).getByText(/^Se cambia en la computadora/)).toBeInTheDocument()
    expect(within(modo).queryByText('Activo.')).not.toBeInTheDocument()
  })

  it.each([
    ['FAILED', { failed: true }, 'El modo rápido no funcionó en esta computadora: regresó sola al modo automático.'],
    ['MANUAL', { manual: true }, 'Fijado a mano en la computadora.'],
    ['PENDING_RESTART', { forced: false }, 'Se aplica la próxima vez que abran el POS.'],
  ])('el estado %s se lee junto al modo', async (_estado, campos, texto) => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, ...campos } })
    expect(within(renglon(seccion, 'Modo de dibujo')).getByText(texto)).toBeInTheDocument()
  })

  it('el aviso de que el modo rápido no funcionó se lee en claro y en oscuro', async () => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, failed: true } })
    const aviso = within(renglon(seccion, 'Modo de dibujo')).getByText(
      'El modo rápido no funcionó en esta computadora: regresó sola al modo automático.',
    )
    expect(aviso).toHaveClass('text-warning-foreground', 'dark:text-warning')
  })

  it.each([
    ['DIRECT3D', 'Tarjeta de video (Direct3D)'],
    ['OPENGL', 'Tarjeta de video (OpenGL)'],
    ['SOFTWARE_FAST', 'Sin tarjeta de video (procesador)'],
    ['SOFTWARE_COMPAT', 'Sin tarjeta de video (procesador, compatible)'],
  ])('«Gráficos» dice %s en llano', async (api, texto) => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, api } })
    expect(renglon(seccion, 'Gráficos')).toHaveTextContent(texto)
  })

  it('unos gráficos desconocidos no pintan el renglón', async () => {
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, api: 'VULKAN' } })
    expect(etiquetas(seccion)).not.toContain('Gráficos')
    expect(within(seccion).queryByText('VULKAN')).not.toBeInTheDocument()
  })

  it.each(['2026-11-24 18:00:00', 'Tue, 24 Nov 2026 18:00:00 GMT'])(
    'una fecha que no es ISO («%s») no pinta «Actualizado el…» (ni «Invalid DateTime»)',
    async receivedAt => {
      const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, receivedAt } })
      expect(within(seccion).queryByText(/^Actualizado el/)).not.toBeInTheDocument()
      expect(within(seccion).queryByText(/Invalid DateTime/)).not.toBeInTheDocument()
    },
  )

  it('un procesador con nombre largo envuelve dentro de su renglón', async () => {
    const cpu = 'Intel(R) Celeron(R) N4020 CPU @ 1.10GHz con un nombre de fabricante larguísimo-sin-espacios-que-no-cabe'
    const seccion = await pintar({ ...PC_WINDOWS, deviceDiagnostics: { ...MEDICION_RAPIDA, cpu } })
    expect(within(renglon(seccion, 'Procesador')).getByText(cpu)).toHaveClass('min-w-0', 'break-words')
  })

  it('una PC de Windows sin medición dice «Sin medir todavía» y no enseña el modo', async () => {
    const seccion = await pintar(PC_WINDOWS)

    const rendimiento = renglon(seccion, 'Rendimiento')
    expect(within(rendimiento).getByText('Sin medir todavía')).toBeInTheDocument()
    expect(
      within(rendimiento).getByText('Se mide sola la próxima vez que se abra el POS en esta computadora, con la versión más reciente.'),
    ).toBeInTheDocument()
    for (const etiqueta of ['Modo de dibujo', 'Gráficos', 'Procesador', 'Memoria de la computadora']) {
      expect(etiquetas(seccion)).not.toContain(etiqueta)
    }
  })

  it.each([
    ['una terminal', { type: 'TPV_ANDROID', osVersion: 'Android 10', modelIdentifier: 'A910S', model: 'A910S', version: '2.22.2' }],
    ['una tablet', { type: 'POS_ANDROID', osVersion: 'Android 14', modelIdentifier: 'SM-X200', model: 'Galaxy Tab', version: '2.30.0' }],
  ])('%s se ve igual que hoy, aunque traiga una medición', async (_caso, cambios) => {
    const seccion = await pintar({ ...PC_WINDOWS, ...cambios, deviceDiagnostics: MEDICION_RAPIDA })

    expect(etiquetas(seccion)).toEqual(['Batería', 'Sistema', 'App', 'Memoria de la app', 'Activación', 'Última conexión'])
    expect(renglon(seccion, 'Memoria de la app')).toHaveTextContent('512 MB de 2048 MB')
    expect(within(seccion).queryAllByRole('button')).toHaveLength(0)
  })

  it('la ficha de una computadora se refresca sola cada 15 s para ver su modo de dibujo sin recargar', async () => {
    await pintar({ ...PC_WINDOWS, deviceDiagnostics: MEDICION_RAPIDA })
    expect(intervaloDeLaFicha()).toBe(15_000)
  })

  it.each([
    ['una terminal', { type: 'TPV_ANDROID', osVersion: 'Android 10', modelIdentifier: 'A910S', model: 'A910S', version: '2.22.2' }],
    ['una tablet', { type: 'POS_ANDROID', osVersion: 'Android 14', modelIdentifier: 'SM-X200', model: 'Galaxy Tab', version: '2.30.0' }],
  ])('la ficha de %s no gana refresco', async (_caso, cambios) => {
    await pintar({ ...PC_WINDOWS, ...cambios, deviceDiagnostics: MEDICION_RAPIDA })
    expect(intervaloDeLaFicha()).toBe(false)
  })

  it.each([
    ['una computadora', {}],
    ['una terminal', { type: 'TPV_ANDROID', osVersion: 'Android 10', modelIdentifier: 'A910S', model: 'A910S', version: '2.22.2' }],
  ])('con una inversión de pantalla pendiente, %s conserva los 5 s', async (_caso, cambios) => {
    await pintar({ ...PC_WINDOWS, ...cambios, customerDisplayRequest: INVERSION_PENDIENTE })
    expect(intervaloDeLaFicha()).toBe(5000)
  })

  it('las llaves nuevas existen en los dos idiomas', () => {
    const llaves = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? llaves(v).map(s => `${k}.${s}`) : [k]))
    expect(llaves(tpvEn.device.performance).sort()).toEqual(llaves(tpvEs.device.performance).sort())
    expect(llaves(tpvEn.device.drawingMode).sort()).toEqual(llaves(tpvEs.device.drawingMode).sort())
    expect(Object.keys(tpvEn.device.fields).sort()).toEqual(Object.keys(tpvEs.device.fields).sort())
    expect(Object.keys(tpvEn.device.graphics).sort()).toEqual(Object.keys(tpvEs.device.graphics).sort())
  })
})
