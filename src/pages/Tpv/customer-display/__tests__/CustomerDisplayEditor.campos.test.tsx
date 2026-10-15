import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  previewCustomerDisplay,
  uploadCustomerDisplayLogo,
  type CustomerDisplayFicha,
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

function pintar(view = vistaDePrueba(), pasos = DEFAULT_TPV_SETTINGS, pasosConocidos = true) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  // Dentro de un router de DATOS, como en la app: el editor detiene la navegación con cambios (useBlocker).
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
            pasos={pasos}
            pasosConocidos={pasosConocidos}
          />
        </QueryClientProvider>
      ),
    },
  ])
  render(<RouterProvider router={router} />)
  return { onClose }
}
const ultimoCuerpo = () => vi.mocked(previewCustomerDisplay).mock.lastCall?.[2]

beforeEach(() => {
  // El server «pinta» lo que le mandan: así la prueba ve que la vista previa sale de SU respuesta.
  vi.mocked(previewCustomerDisplay).mockImplementation(async (_v, _t, design, previewSeq) => ({
    ficha: ficha({
      fingerprint: `fp-${previewSeq}`,
      theme: design.theme,
      welcomeText: design.welcomeText || null,
      accent: design.accentColor ? { custom: true, color: '#0A5C4C', on: '#FFFFFF' } : { custom: false },
    }),
    assetRejected: [],
    previewSeq,
  }))
})

describe('CustomerDisplayEditor — campos y vista previa', () => {
  it('un texto viaja a /preview y la tablet pinta lo que devuelve el server', async () => {
    const user = userEvent.setup()
    pintar()
    await user.type(screen.getByLabelText('editor.welcome'), '¡Hola!')
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ welcomeText: '¡Hola!' }))
    expect(await screen.findByText('¡Hola!', { selector: 'p' })).toBeInTheDocument()
  })

  it('🔴 sólo viajan los cinco campos de F1 (nunca imágenes ni promos)', async () => {
    pintar(vistaDePrueba({ design: { ...DISENO_DE_FABRICA, slides: [{ assetId: 'a1' }], showPromotions: true } }))
    await waitFor(() => expect(previewCustomerDisplay).toHaveBeenCalled())
    expect(Object.keys(ultimoCuerpo()!).sort()).toEqual(['accentColor', 'logoAssetId', 'thanksText', 'theme', 'welcomeText'])
  })

  it('Review Focus 2: un emoji cuenta como uno y el campo no pasa de 40', async () => {
    const user = userEvent.setup()
    pintar()
    const campo = screen.getByLabelText('editor.thanks')
    await user.click(campo)
    await user.paste('😀'.repeat(45))
    expect(campo).toHaveValue('😀'.repeat(40))
    expect(screen.getAllByText('editor.counter {"count":40,"max":40}').length).toBeGreaterThan(0)
  })

  it('Review Focus 3: un color a medio escribir no viaja; uno completo en minúsculas viaja en mayúsculas', async () => {
    const user = userEvent.setup()
    pintar()
    const hex = screen.getByLabelText('editor.hexLabel')
    await user.type(hex, '#0e7')
    expect(screen.getByText('editor.hexInvalid')).toBeInTheDocument()
    await new Promise(r => setTimeout(r, 400))
    expect(vi.mocked(previewCustomerDisplay).mock.calls.some(c => c[2].accentColor === '#0e7' || c[2].accentColor === '#0E7')).toBe(false)
    await user.type(hex, 'c66')
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ accentColor: '#0E7C66' }))
    expect(screen.queryByText('editor.hexInvalid')).not.toBeInTheDocument()
  })

  it('una muestra fija el color y «El de siempre» lo quita', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'editor.colors.azul' }))
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ accentColor: '#2563EB' }))
    expect(screen.getByLabelText('editor.hexLabel')).toHaveValue('#2563EB')
    await user.click(screen.getByRole('button', { name: 'editor.colors.deSiempre' }))
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ accentColor: null }))
  })

  it('el tema se elige con dos botones y la tablet cambia', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('button', { name: 'editor.themeDark' }))
    await waitFor(() => expect(screen.getByTestId('tablet-preview')).toHaveAttribute('data-tema', 'DARK'))
  })

  it('subir otro logo: manda el archivo y el borrador usa el activo nuevo', async () => {
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    vi.mocked(uploadCustomerDisplayLogo).mockResolvedValue({
      assetId: 'asset-1',
      url: 'https://storage.googleapis.com/b/x.png',
      sha256: 'h',
      width: 800,
      height: 800,
    })
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    const archivo = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByTestId('customer-display-logo-input'), archivo)
    await waitFor(() => expect(uploadCustomerDisplayLogo).toHaveBeenCalledWith('v1', 't1', archivo))
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ logoAssetId: 'asset-1' }))
    await user.click(screen.getByRole('radio', { name: 'editor.logoVenue' }))
    await waitFor(() => expect(ultimoCuerpo()).toMatchObject({ logoAssetId: null }))
  })

  it('una imagen pesada o chica se avisa ANTES de subirla', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    const pesada = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByTestId('customer-display-logo-input'), pesada)
    expect(await screen.findByText('editor.logoErrors.peso')).toBeInTheDocument()
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 200, alto: 200 })
    await user.upload(screen.getByTestId('customer-display-logo-input'), new File([new Uint8Array(10)], 'chica.png', { type: 'image/png' }))
    expect(await screen.findByText('editor.logoErrors.medidas')).toBeInTheDocument()
    expect(uploadCustomerDisplayLogo).not.toHaveBeenCalled()
  })

  it('si el server rechaza la subida, se ve SU mensaje', async () => {
    vi.mocked(medirImagen).mockResolvedValue({ ancho: 800, alto: 800 })
    vi.mocked(uploadCustomerDisplayLogo).mockRejectedValue({
      response: { status: 400, data: { message: 'El archivo no es una imagen PNG, JPG o WEBP válida' } },
    })
    const user = userEvent.setup()
    pintar()
    await user.click(screen.getByRole('radio', { name: 'editor.logoOwn' }))
    await user.upload(screen.getByTestId('customer-display-logo-input'), new File([new Uint8Array(10)], 'x.png', { type: 'image/png' }))
    expect(await screen.findByText('El archivo no es una imagen PNG, JPG o WEBP válida')).toBeInTheDocument()
  })

  it('un logo que el server ya no acepta (assetRejected) se explica', async () => {
    vi.mocked(previewCustomerDisplay).mockImplementation(async (_v, _t, _d, previewSeq) => ({
      ficha: ficha(),
      assetRejected: ['viejo'],
      previewSeq,
    }))
    pintar(vistaDePrueba({ design: { ...DISENO_DE_FABRICA, logoAssetId: 'viejo' }, assetRejected: ['viejo'] }))
    expect(await screen.findByText('editor.assetRejected')).toBeInTheDocument()
    await waitFor(() => expect(previewCustomerDisplay).toHaveBeenCalled())
    expect(screen.getByText('editor.assetRejected')).toBeInTheDocument()
  })

  it('promos en reposo: se ven con candado, sin botón de compra; el texto depende del plan', () => {
    pintar()
    expect(screen.getByText('editor.promosPro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /planes|plans/i })).not.toBeInTheDocument()
  })

  it('si el negocio ya tiene el código, el candado dice que viene incluido', () => {
    pintar(vistaDePrueba({ entitlements: { slides: true, promotionCards: true } }))
    expect(screen.getByText('editor.promosIncluded')).toBeInTheDocument()
  })

  it('con las estrellas apagadas no se ofrece el momento «Calificar»', () => {
    pintar(vistaDePrueba(), { ...DEFAULT_TPV_SETTINGS, showReviewScreen: false })
    expect(screen.getByRole('button', { name: 'preview.moments.carrito' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'preview.moments.calificar' })).not.toBeInTheDocument()
  })

  it('🔴 si no se pudieron leer los pasos del dispositivo, la vista previa lo dice en vez de presentarlos como conocidos', () => {
    pintar(vistaDePrueba(), DEFAULT_TPV_SETTINGS, false)
    expect(screen.getByText('preview.stepsUnknown')).toBeInTheDocument()
  })

  it('con los pasos leídos no hay aviso', () => {
    pintar()
    expect(screen.queryByText('preview.stepsUnknown')).not.toBeInTheDocument()
  })
})
