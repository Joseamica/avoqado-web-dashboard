import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  SHOPIFY_AVISOS,
  SHOPIFY_ENVIOS,
  SHOPIFY_PERMISOS_APP,
  type ShopifyConnection,
  type ShopifyOverview,
  type ShopifyReview,
} from '@/types/shopify'

const access = vi.hoisted(() => ({ allowed: [] as string[], cargando: false }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (p: string) => access.allowed.includes(p),
    canFeature: () => true,
    role: 'ADMIN',
    isWhiteLabelEnabled: false,
    isLoading: access.cargando,
  }),
}))
// Mutable: la prueba de cambio de sucursal cambia el negocio sin desmontar la página (el Outlet real no lleva key).
const venue = vi.hoisted(() => ({ id: 'v1' }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: venue.id, fullBasePath: '/venues/test', venue: { id: venue.id, status: 'ACTIVE' } }),
}))
// useVenueTier es el REAL (Codex N2): decide con lo que el server concede en `/plan-tier` (accessSchemaVersion 1). La
// respuesta es la MISMA del E2E (la re-exporta e2e/fixtures/shopify-plan-tier.ts) y pasa por el parser real (Codex R2-3): un campo que el contrato exige y falta truena aquí.
const plan = vi.hoisted(() => ({ granted: [] as string[] }))
vi.mock('@/services/features.service', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/features.service')>()
  const { planTierShopify } = await import('./components/shopify/__tests__/planTierShopify')
  return {
    ...real,
    getVenuePlanTierInfo: vi.fn(async () => real.parseVenuePlanTierInfo(planTierShopify(plan.granted))),
    getVenueFeatures: vi.fn(),
  }
})
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/utils/datetime', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils/datetime')>()),
  useVenueDateTime: () => ({ formatDateTime: (d: unknown) => `fecha:${String(d)}`, formatTime: (d: unknown) => `hora:${String(d)}` }),
}))
// La llave y sus valores simples: así la prueba ve los números que se pintan («review.shopify 7»).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? [k, ...Object.values(o).filter(v => typeof v !== 'object')].join(' ') : k),
  }),
}))
// Las 15 llamadas del servicio se mockean; lo demás (`explicarErrorShopify`, `textoDeErrorShopify`) es el REAL de C7: así los textos
// y las acciones de los errores salen del mapa de verdad y no de uno inventado por la prueba (requisito 2 de C7 → C8).
const svc = vi.hoisted(() => ({
  getShopifyOverview: vi.fn(),
  startShopifyConnect: vi.fn(),
  reauthorizeShopify: vi.fn(),
  connectShopifyOwnApp: vi.fn(),
  getShopifyLocations: vi.fn(),
  confirmShopifyConnect: vi.fn(),
  getShopifyConnectReview: vi.fn(),
  applyShopifyConnect: vi.fn(),
  saveShopifyConnectChoices: vi.fn(),
  disconnectShopify: vi.fn(),
  resyncShopify: vi.fn(),
  listShopifyReviews: vi.fn(),
  getShopifyReviewEnvios: vi.fn(),
  resolveShopifyReview: vi.fn(),
  listShopifyIssues: vi.fn(),
}))
vi.mock('@/services/shopify.service', async () => ({
  ...(await vi.importActual<typeof import('@/services/shopify.service')>('@/services/shopify.service')),
  ...svc,
}))

import { parseVenuePlanTierInfo } from '@/services/features.service'
import { planTierShopify } from './components/shopify/__tests__/planTierShopify'
import ShopifyIntegration from './ShopifyIntegration'

const CONTEOS = { emparejados: 118, pendientes: 0, atorados: 0, inciertos: 0, porRevisar: 1, sinPareja: 2 }
const conexion = (o: Partial<ShopifyConnection> = {}): ShopifyConnection => ({
  fase: 'ACTIVE',
  pausedFrom: null,
  estado: 'ACTIVA',
  shopDomain: 'mi-tienda.myshopify.com',
  locationName: 'Tienda México',
  importacion: { variantes: 120, error: null },
  aplicacion: null,
  conteos: CONTEOS,
  retrasoMin: null,
  cuadre: { pendiente: false, ultimo: '2026-10-08T12:00:00.000Z' },
  proximoIntento: null,
  ...o,
})
const pausada = (o: Partial<ShopifyConnection> = {}) => conexion({ fase: 'PAUSED', pausedFrom: 'ACTIVE', estado: 'PAUSADA', ...o })
const resumen = (c: ShopifyConnection | null, planActive = true): ShopifyOverview => ({ planActive, connection: c })
const pagina = <T,>(items: T[], total = items.length, nextOffset: number | null = null) => ({ items, total, nextOffset })
const VACIA = pagina([])
const REVISION: ShopifyReview = {
  id: 'r1',
  status: 'OPEN',
  reason: 'DIFERENCIA',
  avoqadoQty: '5',
  shopifyQty: 4,
  atorados: 0,
  suggestion: 'SHOPIFY',
  choice: null,
  envio: null,
  createdAt: '2026-10-08T12:00:00.000Z',
  product: { id: 'p1', name: 'Camisa · M', sku: 'CAM-M' },
}
const ISSUE = {
  id: 'i1',
  title: 'Gorra',
  sku: null,
  reason: 'SIN_SKU',
  detail: null,
  productId: null,
  createdAt: '2026-10-08T12:00:00.000Z',
}
const VISTA = {
  variantLinkId: 'vl1',
  productId: 'p1',
  name: 'Camisa · M',
  sku: 'CAM-M',
  avoqadoQty: '3',
  shopifyQty: 5,
  nuevo: false,
  quedara: '4',
}
const RESUMEN_VISTA = { emparejados: 30, cambian: 30, nuevos: 2, sinPareja: 1 }
const VISTA_CONEXION = { linkId: 'l1', generation: 1, tokenVersion: 1 }
const errorHttp = (status: number, data: Record<string, unknown>) => Object.assign(new Error('http'), { response: { status, data } })
const ESPERA_REINTENTO = { timeout: 4000 } // las consultas pesadas reintentan 1 vez (retry: 1) antes de mostrar el error
const navegar = vi.fn()
const scrollIntoView = vi.fn()

function renderPage(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ShopifyIntegration navegar={navegar} />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const view = render(tree())
  return { ...view, client, tree }
}

/** 5a: las llaves que pega el dueño en el bloque de la app de su tienda. */
async function llenarLlaves() {
  await userEvent.type(screen.getByLabelText('connect.appPropia.clientIdLabel'), 'cid_123')
  await userEvent.type(screen.getByLabelText('connect.appPropia.clientSecretLabel'), 'shpss_secreto')
}
/** 5a: «Conectar» con el dominio y el server contesta que esta tienda se conecta con SU app. */
async function abrirAppPropia(dominio = 'Mi-Tienda.myshopify.com') {
  svc.startShopifyConnect.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_USA_APP_PROPIA', message: 'usa tu app' }))
  renderPage()
  await userEvent.type(await screen.findByPlaceholderText('connect.domainPlaceholder'), dominio)
  await userEvent.click(screen.getByRole('button', { name: 'connect.submit' }))
  expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
}

beforeEach(() => {
  vi.clearAllMocks()
  venue.id = 'v1'
  access.allowed = ['inventory:read', 'inventory:adjust', 'settings:manage']
  access.cargando = false
  plan.granted = ['CHATBOT', 'SHOPIFY_INTEGRATION']
  Element.prototype.scrollIntoView = scrollIntoView
  svc.getShopifyOverview.mockResolvedValue(resumen(null))
  svc.listShopifyReviews.mockResolvedValue(VACIA)
  // El sondeo de envíos contesta lo que sabe el server: una elección en camino sigue en camino. (Un id que NO vuelve se marca
  // desaparecida, Z7 de C7: un `{ items: [] }` vacío ya no es «sigue pendiente».)
  svc.getShopifyReviewEnvios.mockImplementation(async (_venueId: string, ids: string[]) => ({
    items: ids.map(id => ({ id, status: 'RESOLVED', choice: 'AVOQADO', envio: 'PENDIENTE' })),
  }))
  svc.listShopifyIssues.mockResolvedValue(VACIA)
})

describe('ShopifyIntegration — conectar', () => {
  it('sin conexión y con acceso: pide el dominio y va a Shopify por `navegar` (nunca toca window.location)', async () => {
    svc.startShopifyConnect.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=s' })
    renderPage()
    await userEvent.type(await screen.findByPlaceholderText('connect.domainPlaceholder'), 'mi-tienda.myshopify.com')
    await userEvent.click(screen.getByRole('button', { name: 'connect.submit' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=s'))
    expect(svc.startShopifyConnect).toHaveBeenCalledWith('v1', 'mi-tienda.myshopify.com')
  })

  it('🔴 requisito 11: el dominio se valida en el cliente (no vacío y termina en .myshopify.com); no se manda uno inválido', async () => {
    renderPage()
    const dominio = await screen.findByPlaceholderText('connect.domainPlaceholder')
    const enviar = screen.getByRole('button', { name: 'connect.submit' })
    expect(enviar).toBeDisabled() // vacío
    await userEvent.type(dominio, 'mi-tienda.com')
    expect(enviar).toBeDisabled()
    expect(screen.getByText('errors.codes.SHOPIFY_DOMINIO_INVALIDO')).toBeInTheDocument()
    await userEvent.click(enviar)
    expect(svc.startShopifyConnect).not.toHaveBeenCalled()
    await userEvent.clear(dominio)
    await userEvent.type(dominio, '  Mi-Tienda.MyShopify.com ')
    expect(enviar).toBeEnabled()
    expect(screen.queryByText('errors.codes.SHOPIFY_DOMINIO_INVALIDO')).toBeNull()
  })

  it('una tienda fuera del piloto: lo explica en la página (con el texto del mapa de errores) y no navega', async () => {
    svc.startShopifyConnect.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_SOLO_PILOTO', message: 'Sólo piloto' }))
    renderPage()
    await userEvent.type(await screen.findByPlaceholderText('connect.domainPlaceholder'), 'otra.myshopify.com')
    await userEvent.click(screen.getByRole('button', { name: 'connect.submit' }))
    expect(await screen.findByText('connect.soloPilotoTitle')).toBeInTheDocument()
    expect(screen.getByText('errors.codes.SHOPIFY_SOLO_PILOTO')).toBeInTheDocument()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('🔴 un Premium COMERCIAL sin la función: «Shopify está en piloto» y contacto, sin formulario ni promesa de compra (N2)', async () => {
    plan.granted = ['CHATBOT', 'CFDI', 'INVENTORY_TRACKING']
    renderPage()
    expect(await screen.findByText('piloto.title')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'piloto.contact' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\//))
    expect(screen.queryByPlaceholderText('connect.domainPlaceholder')).toBeNull()
    expect(screen.queryByText(/featureGate\./)).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/premium/i)
  })

  it('🔴 requisito 11: el servidor dice `planActive: false` y no hay conexión ⇒ la tarjeta del piloto, aunque el plan-tier lo conceda', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(null, false))
    renderPage()
    expect(await screen.findByText('piloto.title')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('connect.domainPlaceholder')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/premium/i)
  })

  it('sin `settings:manage` la tarjeta del piloto no ofrece escribirnos: dice a quién pedirlo', async () => {
    access.allowed = ['inventory:read']
    plan.granted = ['CHATBOT']
    renderPage()
    expect(await screen.findByText('piloto.askOwner')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'piloto.contact' })).toBeNull()
  })

  it('🔴 la respuesta de /plan-tier de estas pruebas y del E2E pasa por el parser real; sin `accessObservedAt` no (R2-3)', () => {
    for (const granted of [['SHOPIFY_INTEGRATION'], ['CHATBOT', 'CFDI', 'INVENTORY_TRACKING']]) {
      expect(parseVenuePlanTierInfo(planTierShopify(granted))).toMatchObject({ accessSchemaVersion: 1, grantedFeatureCodes: granted })
    }
    expect(() => parseVenuePlanTierInfo({ ...planTierShopify([]), accessObservedAt: undefined })).toThrow()
  })

  it('regreso del OAuth con ?intent=: elige la ubicación y confirma SÓLO con su id (el nombre lo pone el servidor)', async () => {
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    svc.confirmShopifyConnect.mockResolvedValue({ locationLinkId: 'l1' })
    renderPage('/?intent=intent-firmado')
    await userEvent.click(await screen.findByRole('button', { name: 'Tienda México' }))
    await waitFor(() =>
      expect(svc.confirmShopifyConnect).toHaveBeenCalledWith('v1', { intent: 'intent-firmado', locationId: 'gid://shopify/Location/1' }),
    )
    expect(svc.getShopifyLocations).toHaveBeenCalledWith('v1', 'intent-firmado')
  })

  it('🔴 al confirmar la ubicación NO se vuelven a pedir las ubicaciones con el intent ya usado (C10: daba un 409 «Esta conexión ya se usó»)', async () => {
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    svc.confirmShopifyConnect.mockResolvedValue({ locationLinkId: 'l1' })
    renderPage('/?intent=intent-firmado')
    await userEvent.click(await screen.findByRole('button', { name: 'Tienda México' }))
    await waitFor(() => expect(svc.confirmShopifyConnect).toHaveBeenCalledTimes(1))
    // La confirmación invalida lo del conector: el resumen se vuelve a pedir, las ubicaciones del intent usado no.
    await waitFor(() => expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThanOrEqual(2))
    await new Promise(r => setTimeout(r, 50))
    expect(svc.getShopifyLocations).toHaveBeenCalledTimes(1)
  })

  it('🔴 requisito 1: dentro del asistente, un 403 SHOPIFY_FALTA_PERMISO (REAUTORIZAR) no ofrece «Volver a dar permiso» sino «Volver a empezar»', async () => {
    svc.getShopifyLocations.mockRejectedValue(errorHttp(403, { code: 'SHOPIFY_FALTA_PERMISO', message: 'falta' }))
    renderPage('/?intent=intent-firmado')
    expect(await screen.findByText('errors.codes.SHOPIFY_FALTA_PERMISO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'connect.restart' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'avisos.reauthorize' })).toBeNull()
  })

  it('🔴 requisito 1: «Volver a empezar» suelta el intent y deja empezar un OAuth nuevo (el formulario del dominio)', async () => {
    svc.getShopifyLocations.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_INTENT_EXPIRADO', message: 'venció' }))
    renderPage('/?intent=intent-firmado')
    expect(await screen.findByText('errors.codes.SHOPIFY_INTENT_EXPIRADO')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'connect.restart' }))
    expect(await screen.findByPlaceholderText('connect.domainPlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('errors.codes.SHOPIFY_INTENT_EXPIRADO')).toBeNull()
  })

  it('🔴 requisito 1 (T6): confirmar con envíos en camino (REINTENTAR_LUEGO) lo explica y CONSERVA el intent; sin reintento solo', async () => {
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    svc.confirmShopifyConnect.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_ENVIO_EN_CAMINO', message: 'en camino' }))
    renderPage('/?intent=intent-firmado')
    await userEvent.click(await screen.findByRole('button', { name: 'Tienda México' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_ENVIO_EN_CAMINO' }))
    // Sigue en el asistente, con la misma ubicación a un toque, y no volvió a mandar nada por su cuenta.
    expect(screen.getByRole('button', { name: 'Tienda México' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'connect.restart' })).toBeNull()
    await new Promise(r => setTimeout(r, 300))
    expect(svc.confirmShopifyConnect).toHaveBeenCalledTimes(1)
  })

  it('🔴 requisito 1: confirmar con un intent vencido (VOLVER_A_EMPEZAR) lo dice y ofrece «Volver a empezar»', async () => {
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    svc.confirmShopifyConnect.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_INTENT_EXPIRADO', message: 'venció' }))
    renderPage('/?intent=intent-firmado')
    await userEvent.click(await screen.findByRole('button', { name: 'Tienda México' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_INTENT_EXPIRADO' }))
    expect(await screen.findByRole('button', { name: 'connect.restart' })).toBeEnabled()
  })

  it('🔴 «Volver a empezar» también relee el resumen: si el asistente murió porque la sucursal YA estaba conectada, se ve la conexión', async () => {
    svc.getShopifyOverview.mockResolvedValueOnce(resumen(null)).mockResolvedValue(resumen(conexion()))
    svc.getShopifyLocations.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_YA_CONECTADA', message: 'ya' }))
    renderPage('/?intent=intent-firmado')
    expect(await screen.findByText('errors.codes.SHOPIFY_YA_CONECTADA')).toBeInTheDocument()
    const antes = svc.getShopifyOverview.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'connect.restart' }))
    expect(await screen.findByText('status.store')).toBeInTheDocument()
    expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThan(antes)
    expect(screen.queryByPlaceholderText('connect.domainPlaceholder')).toBeNull()
  })

  it('regreso con ?error=USADO: lo dice con su texto y limpia la URL', async () => {
    renderPage('/?error=USADO')
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'connect.callbackErrors.USADO' }))
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('regreso con ?reautorizada=1: avisa que Shopify volvió a dar permiso', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    renderPage('/?reautorizada=1')
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'connect.reauthorized' }))
  })

  it('🔴 requisito 1: reautorizar cuando la sucursal ya no tiene tienda (CONECTAR) invalida el resumen y vuelve a ofrecer «Conectar»', async () => {
    svc.getShopifyOverview.mockResolvedValueOnce(resumen(conexion({ estado: 'REVOCADA' }))).mockResolvedValue(resumen(null))
    svc.reauthorizeShopify.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_REAUTORIZAR_SIN_TIENDA', message: 'sin tienda' }))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.reconnect' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_REAUTORIZAR_SIN_TIENDA' }),
    )
    expect(await screen.findByRole('button', { name: 'connect.submit' })).toBeInTheDocument()
  })

  it.each([
    ['SHOPIFY_YA_CONECTADA', 409],
    ['SHOPIFY_SIN_PLAN', 403],
  ])(
    '🔴 C7-M(1): un %s al conectar (RELEER) invalida el resumen: se vuelve a leer en vez de quedarse con lo viejo',
    async (code, status) => {
      svc.startShopifyConnect.mockRejectedValue(errorHttp(status, { code, message: 'x' }))
      renderPage()
      await userEvent.type(await screen.findByPlaceholderText('connect.domainPlaceholder'), 'mi-tienda.myshopify.com')
      const antes = svc.getShopifyOverview.mock.calls.length
      await userEvent.click(screen.getByRole('button', { name: 'connect.submit' }))
      await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: `errors.codes.${code}` }))
      await waitFor(() => expect(svc.getShopifyOverview.mock.calls.length).toBe(antes + 1))
    },
  )

  it('🔴 C7-M(1): el 403 del candado del plan a media sesión (planRequired) dice el texto del piloto e invalida el resumen', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.resyncShopify.mockRejectedValue(
      errorHttp(403, { error: 'Feature not available', message: 'Please subscribe', featureCode: 'SHOPIFY_INTEGRATION' }),
    )
    renderPage()
    const antes = svc.getShopifyOverview.mock.calls.length
    await userEvent.click(await screen.findByRole('button', { name: 'status.resync' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.planRequired' }))
    await waitFor(() => expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThan(antes))
  })

  it('sin `settings:manage`: la tarjeta de conectar se ve, DESHABILITADA, y la página dice por qué y a quién pedirlo', async () => {
    access.allowed = ['inventory:read']
    renderPage()
    expect(await screen.findByRole('button', { name: 'connect.submit' })).toBeDisabled()
    expect(screen.getByText('page.readOnly')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('connect.domainPlaceholder')).toBeDisabled()
    expect(svc.startShopifyConnect).not.toHaveBeenCalled()
  })

  it('🔴 mientras los permisos cargan se ve «cargando»: ni «No tienes permiso» ni el aviso de sólo lectura destellan; al llegar, la página aparece', async () => {
    access.allowed = []
    access.cargando = true
    const v = renderPage()
    expect(screen.getByRole('status', { name: 'common:loading' })).toBeInTheDocument()
    expect(screen.queryByText('errors.forbidden')).toBeNull()
    expect(screen.queryByText('page.readOnly')).toBeNull()
    expect(svc.getShopifyOverview).not.toHaveBeenCalled()
    // Aunque el hook ya contestara `inventory:read` (caché) con el resto todavía cargando, el aviso de sólo lectura espera.
    access.allowed = ['inventory:read']
    v.rerender(v.tree())
    expect(screen.queryByText('page.readOnly')).toBeNull()
    access.allowed = ['inventory:read', 'inventory:adjust', 'settings:manage']
    access.cargando = false
    v.rerender(v.tree())
    expect(await screen.findByPlaceholderText('connect.domainPlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('errors.forbidden')).toBeNull()
    expect(screen.queryByText('page.readOnly')).toBeNull()
  })

  it('sin `inventory:read` no se muestra nada de la conexión: se dice que no tiene permiso', async () => {
    access.allowed = []
    renderPage()
    expect(await screen.findByText('errors.forbidden')).toBeInTheDocument()
    expect(svc.getShopifyOverview).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('connect.domainPlaceholder')).toBeNull()
  })
})

describe('ShopifyIntegration — conectar con la app de la tienda (5a)', () => {
  it('🔴 SHOPIFY_USA_APP_PROPIA abre el bloque bajo el dominio (ya fijo): 6 pasos, los permisos, el secret oculto y sin autocompletar; con el intent sigue la ubicación de siempre', async () => {
    svc.connectShopifyOwnApp.mockResolvedValue({ intent: 'intent-app-propia' })
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    await abrirAppPropia()
    expect(screen.getByPlaceholderText('connect.domainPlaceholder')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'connect.submit' })).toBeNull()
    for (const p of ['1', '2', '3', '4', '5', '6']) expect(screen.getByText(`connect.appPropia.pasos.${p}`)).toBeInTheDocument()
    expect(screen.getByText(SHOPIFY_PERMISOS_APP.join(','))).toBeInTheDocument()
    const secret = screen.getByLabelText('connect.appPropia.clientSecretLabel')
    expect(secret).toHaveAttribute('type', 'password')
    // Chrome ignora autocomplete="off" en un password y, con un campo de texto + uno de contraseña, lo trata como un inicio de sesión:
    // podría rellenar el correo y la contraseña de Avoqado aquí (y mandar esa contraseña a Shopify) u ofrecer guardar las llaves.
    expect(secret).toHaveAttribute('autocomplete', 'new-password')
    const clientId = screen.getByLabelText('connect.appPropia.clientIdLabel')
    expect(clientId).toHaveAttribute('autocomplete', 'off')
    for (const campo of [clientId, secret]) {
      expect(campo).toHaveAttribute('data-1p-ignore')
      expect(campo).toHaveAttribute('data-lpignore', 'true')
      expect(campo).toHaveAttribute('data-bwignore')
    }
    const conectar = screen.getByRole('button', { name: 'connect.appPropia.submit' })
    expect(conectar).toBeDisabled()
    await llenarLlaves()
    await userEvent.click(conectar)
    await waitFor(() =>
      expect(svc.connectShopifyOwnApp).toHaveBeenCalledWith('v1', 'CONNECT', {
        shopDomain: 'mi-tienda.myshopify.com',
        clientId: 'cid_123',
        clientSecret: 'shpss_secreto',
      }),
    )
    expect(await screen.findByRole('button', { name: 'Tienda México' })).toBeInTheDocument()
    expect(svc.getShopifyLocations).toHaveBeenCalledWith('v1', 'intent-app-propia')
    expect(navegar).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('«Copiar los permisos» copia los 7 de una vez y lo dice', async () => {
    await abrirAppPropia()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'connect.appPropia.copiar' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'connect.appPropia.copiados' }))
    expect(writeText).toHaveBeenCalledWith(
      'read_products,write_products,read_inventory,write_inventory,read_locations,read_orders,read_fulfillments',
    )
  })

  it('🔴 llaves que Shopify rechaza: lo dice con su texto y el bloque se queda con lo escrito para corregirlo; «Volver» deja cambiar el dominio', async () => {
    svc.connectShopifyOwnApp.mockRejectedValue(errorHttp(422, { code: 'SHOPIFY_APP_SECRET_INVALIDO', message: 'malo' }))
    await abrirAppPropia()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_APP_SECRET_INVALIDO' }))
    expect(screen.getByText('connect.appPropia.title')).toBeInTheDocument()
    expect(screen.getByLabelText('connect.appPropia.clientIdLabel')).toHaveValue('cid_123')
    // El secret no se queda en el estado cuando la petición terminó (también si falló): se vuelve a pegar.
    expect(screen.getByLabelText('connect.appPropia.clientSecretLabel')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Tienda México' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.cancel' }))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
    expect(screen.getByPlaceholderText('connect.domainPlaceholder')).toBeEnabled()
  })

  it('🔴 ruling P2-6: dos intentos seguidos sin salir de la página: el «Volver a empezar» de un intent vencido no se queda pegado al intent nuevo', async () => {
    svc.getShopifyLocations.mockResolvedValue([{ id: 'gid://shopify/Location/1', name: 'Tienda México', countryCode: 'MX' }])
    svc.confirmShopifyConnect.mockRejectedValueOnce(errorHttp(409, { code: 'SHOPIFY_INTENT_EXPIRADO', message: 'venció' }))
    renderPage('/?intent=intent-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Tienda México' }))
    await userEvent.click(await screen.findByRole('button', { name: 'connect.restart' }))
    // Segundo intento, sin desmontar la página: con la app de la tienda, el intent nuevo llega en la respuesta.
    svc.startShopifyConnect.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_USA_APP_PROPIA', message: 'usa tu app' }))
    svc.connectShopifyOwnApp.mockResolvedValue({ intent: 'intent-2' })
    await userEvent.type(await screen.findByPlaceholderText('connect.domainPlaceholder'), 'mi-tienda.myshopify.com')
    await userEvent.click(screen.getByRole('button', { name: 'connect.submit' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    expect(await screen.findByRole('button', { name: 'Tienda México' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'connect.restart' })).toBeNull()
    expect(screen.queryByText('errors.codes.SHOPIFY_INTENT_EXPIRADO')).toBeNull()
    expect(svc.getShopifyLocations).toHaveBeenLastCalledWith('v1', 'intent-2')
  })
})

describe('ShopifyIntegration — importar y aplicar', () => {
  it('trayendo el catálogo: avance, sin listas', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 40, error: null } })),
    )
    renderPage()
    expect(await screen.findByText('connect.importing')).toBeInTheDocument()
    expect(screen.getByText('connect.importedCount 40')).toBeInTheDocument()
    expect(svc.listShopifyReviews).not.toHaveBeenCalled()
  })

  it('🔴 requisito 10 (Z6): un error de importación que el worker reintenta (no es de los 3 terminales) NO detiene: avance y texto genérico', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 7, error: 'VARIANTE_FALLO' } })),
    )
    renderPage()
    expect(await screen.findByText('connect.importing')).toBeInTheDocument()
    expect(screen.getByText('connect.importErrors.generic')).toBeInTheDocument()
    expect(screen.queryByText('connect.importStopped')).toBeNull()
  })

  it('🔴 catálogo de más de 20,000 variantes: se DETIENE (sin avance) y deja cancelar la conexión (N7)', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'CATALOGO_MUY_GRANDE' } })),
    )
    svc.disconnectShopify.mockResolvedValue({ desconectado: true })
    renderPage()
    expect(await screen.findByText('connect.importStopped')).toBeInTheDocument()
    expect(screen.getByText('connect.importErrors.CATALOGO_MUY_GRANDE')).toBeInTheDocument()
    expect(screen.queryByText('connect.importing')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'preview.cancel' }))
    await userEvent.click(await screen.findByRole('button', { name: 'preview.cancelConfirm' }))
    await waitFor(() => expect(svc.disconnectShopify).toHaveBeenCalledWith('v1'))
  })

  it('🔴 el diálogo de «Cancelar la conexión» no tiene un botón «Cancelar» suelto: la salida dice «Seguir conectando» y no desconecta (C10)', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 0, error: 'CATALOGO_MUY_GRANDE' } })),
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'preview.cancel' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).queryByRole('button', { name: 'common:cancel' })).toBeNull()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'preview.cancelKeep' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(svc.disconnectShopify).not.toHaveBeenCalled()
  })

  it('🔴 la organización encendió el catálogo maestro: se DETIENE, ofrece cancelar y escribirnos, sin «volver a dar permiso»', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 12, error: 'CATALOGO_MAESTRO' } })),
    )
    renderPage()
    expect(await screen.findByText('connect.importStopped')).toBeInTheDocument()
    expect(screen.getByText('connect.importErrors.CATALOGO_MAESTRO')).toBeInTheDocument()
    expect(screen.queryByText('connect.importing')).toBeNull()
    expect(screen.getByRole('button', { name: 'preview.cancel' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'piloto.contact' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'avisos.reauthorize' })).toBeNull()
  })

  it('🔴 falta un permiso de Shopify: se DETIENE y deja volver a dar permiso (N7)', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 10, error: 'FALTA_PERMISO' } })),
    )
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=p' })
    renderPage()
    expect(await screen.findByText('connect.importErrors.FALTA_PERMISO')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'avisos.reauthorize' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=p'))
  })

  it('importación detenida sin `settings:manage`: los botones se ven deshabilitados y dice a quién pedirlo', async () => {
    access.allowed = ['inventory:read']
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 10, error: 'FALTA_PERMISO' } })),
    )
    renderPage()
    expect(await screen.findByText('connect.importStoppedAskAdmin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'avisos.reauthorize' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'preview.cancel' })).toBeDisabled()
  })

  it('vista previa: «así quedará tu stock» paginada y filtrada en el SERVIDOR; «Aplicar» pasa por un diálogo', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockResolvedValue({ ...pagina([VISTA], 30, 20), resumen: RESUMEN_VISTA })
    svc.applyShopifyConnect.mockResolvedValue({ solicitado: true })
    renderPage()
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 0, filtro: 'CAMBIAN' })
    expect(screen.getByText('list.total 1 30')).toBeInTheDocument()
    // «Así quedará» (lo de Shopify al importar con lo vendido mientras se conectaba) junto a lo de hoy; Shopify crudo, aparte
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('preview.enShopify 5')).toBeInTheDocument()
    expect(screen.getByText('preview.quedara')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0) // un servidor sin D1 se ve como antes
    await userEvent.click(screen.getByRole('button', { name: 'list.loadMore' }))
    await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 20, filtro: 'CAMBIAN' }))
    await userEvent.click(screen.getByRole('button', { name: 'preview.filtros.TODOS' }))
    await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 0, filtro: 'TODOS' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.apply' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'preview.apply' }))
    expect(await screen.findByText('preview.applyBody')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'preview.applyConfirm' }))
    await waitFor(() => expect(svc.applyShopifyConnect).toHaveBeenCalledWith('v1'))
  })

  it('🔴 D1: un producto que ya tenías y no coincide pide elegir: los dos números, el resultado de cada opción y nada marcado; «Aplicar» espera a que elijas en todos', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 1, porDecidir: 0 })
    renderPage()
    expect(await screen.findByText('preview.ambos 5 6')).toBeInTheDocument()
    const [avoqado, shopify] = screen.getAllByRole('radio')
    expect(avoqado).toHaveTextContent('preview.usarAvoqado')
    expect(avoqado).toHaveTextContent('preview.quedanEnLosDos 5')
    expect(shopify).toHaveTextContent('preview.usarShopify')
    expect(shopify).toHaveTextContent('preview.quedanEnLosDos 6')
    expect(avoqado).toHaveAttribute('aria-checked', 'false')
    expect(shopify).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('preview.porDecidir 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preview.apply' })).toBeDisabled()
    // Elige: viaja con los números y la conexión que VIO; la vista previa se vuelve a pedir y ya no falta nada.
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([{ ...DECIDE, eleccion: 'AVOQADO' }], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    await userEvent.click(avoqado)
    await waitFor(() =>
      expect(svc.saveShopifyConnectChoices).toHaveBeenCalledWith('v1', {
        vista: VISTA_CONEXION,
        elecciones: [{ variantLinkId: 'vl1', choice: 'AVOQADO', expectedAvoqadoQty: '5', expectedShopifyQty: 6 }],
      }),
    )
    await waitFor(() => expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByText('preview.porDecidir 1')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.apply' })).toBeEnabled())
  })

  it('🔴 D1: «en los que faltan» manda UNA opción para los que faltan (también páginas sin abrir) y dice cuántos son; nada viene marcado', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 40, 20),
      resumen: { ...RESUMEN_VISTA, porDecidir: 40 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 40, porDecidir: 0 })
    renderPage()
    expect(await screen.findByText('preview.todosAyuda 40')).toBeInTheDocument()
    expect(screen.getAllByRole('radio').every(r => r.getAttribute('aria-checked') === 'false')).toBe(true)
    const antes = svc.getShopifyConnectReview.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'preview.todosAvoqado' }))
    await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenCalledWith('v1', { vista: VISTA_CONEXION, todos: 'AVOQADO' }))
    await waitFor(() => expect(svc.getShopifyConnectReview.mock.calls.length).toBeGreaterThan(antes))
    // La otra opción viaja igual de explícita.
    await userEvent.click(screen.getByRole('button', { name: 'preview.todosShopify' }))
    await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenLastCalledWith('v1', { vista: VISTA_CONEXION, todos: 'SHOPIFY' }))
  })

  it('D1: si «Usar Avoqado en los que faltan» no alcanzó a todos (se salta los de piezas con decimales), lo dice sin alarma y los deja pendientes', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 3),
      resumen: { ...RESUMEN_VISTA, porDecidir: 3 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 1, porDecidir: 2 })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'preview.todosAvoqado' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'preview.todosQuedaron 1 2' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    expect(screen.getByRole('button', { name: 'preview.apply' })).toBeDisabled()
  })

  it('D1: con todo elegido no hay botones «en los que faltan» ni contador, y «Aplicar» queda habilitado', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const ELEGIDO = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: 'SHOPIFY' }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([ELEGIDO], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    renderPage()
    expect(await screen.findByText('preview.ambos 5 6')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('button', { name: 'preview.todosAvoqado' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'preview.todosShopify' })).toBeNull()
    expect(screen.queryByText(/preview\.porDecidir/)).toBeNull()
    expect(screen.queryByText('preview.todosQuedaronDetalle')).toBeNull() // sin productos por elegir no hay nada que explicar
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.apply' })).toBeEnabled())
  })

  it('🔴 D1: si los números o la conexión cambiaron al elegir (409), lo dice y vuelve a pedir la vista previa', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
      conexion: VISTA_CONEXION,
    })
    for (const code of ['SHOPIFY_REVISION_CAMBIO', 'SHOPIFY_CONEXION_CAMBIO']) {
      svc.saveShopifyConnectChoices.mockRejectedValueOnce(errorHttp(409, { code, message: 'cambió' }))
    }
    renderPage()
    await screen.findByText('preview.ambos 5 6')
    for (const code of ['SHOPIFY_REVISION_CAMBIO', 'SHOPIFY_CONEXION_CAMBIO']) {
      const antes = svc.getShopifyConnectReview.mock.calls.length
      await userEvent.click(screen.getAllByRole('radio')[1])
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: `errors.codes.${code}` })),
      )
      await waitFor(() => expect(svc.getShopifyConnectReview.mock.calls.length).toBeGreaterThan(antes))
    }
  })

  it('D1: «Aplicar» con decisiones que faltan (422, una venta las invalidó) lo dice y vuelve a leer la vista previa', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([VISTA], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    svc.applyShopifyConnect.mockRejectedValue(errorHttp(422, { code: 'SHOPIFY_FALTAN_DECISIONES', message: 'faltan' }))
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.apply' })).toBeEnabled())
    const antes = svc.getShopifyConnectReview.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'preview.apply' }))
    await userEvent.click(await screen.findByRole('button', { name: 'preview.applyConfirm' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.codes.SHOPIFY_FALTAN_DECISIONES' })))
    await waitFor(() => expect(svc.getShopifyConnectReview.mock.calls.length).toBeGreaterThan(antes))
  })

  it('W4: en una primera conexión (nada «Cambian») abre en «Nuevos»; sin nuevos, en «Todos»; lo que elige la persona manda', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const sinCambios = { emparejados: 17, cambian: 0, nuevos: 17, sinPareja: 25 }
    svc.getShopifyConnectReview.mockResolvedValue({ ...pagina([VISTA], 17, 20), resumen: sinCambios })
    renderPage()
    await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 0, filtro: 'NUEVOS' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.filtros.NUEVOS' })).toHaveAttribute('aria-pressed', 'true'))
    // La persona vuelve a «Cambian»: se queda ahí aunque esté vacía (la elección automática es sólo la primera vez).
    await userEvent.click(screen.getByRole('button', { name: 'preview.filtros.CAMBIAN' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.filtros.CAMBIAN' })).toHaveAttribute('aria-pressed', 'true'))
    await new Promise(r => setTimeout(r, 50))
    expect(screen.getByRole('button', { name: 'preview.filtros.CAMBIAN' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('W4: sin cambios ni nuevos, abre en «Todos»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([VISTA], 3, 20),
      resumen: { emparejados: 3, cambian: 0, nuevos: 0, sinPareja: 0 },
    })
    renderPage()
    await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 0, filtro: 'TODOS' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'preview.filtros.TODOS' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('🔴 vista previa todavía cargando: «Aplicar» deshabilitado y NO se manda nada; cancelar sí se puede (N3)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockReturnValue(new Promise(() => {}))
    renderPage()
    const aplicar = await screen.findByRole('button', { name: 'preview.apply' })
    expect(aplicar).toBeDisabled()
    await userEvent.click(aplicar)
    expect(screen.queryByText('preview.applyBody')).toBeNull()
    expect(svc.applyShopifyConnect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'preview.cancel' })).toBeEnabled()
    expect(screen.getByText('preview.applyBlocked')).toBeInTheDocument()
  })

  it('🔴 vista previa que falla: error con reintento, «Aplicar» deshabilitado y NO se manda nada (N3)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockRejectedValue(errorHttp(500, {}))
    renderPage()
    expect(await screen.findByText('preview.loadError', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:retry' })).toBeEnabled()
    const aplicar = screen.getByRole('button', { name: 'preview.apply' })
    expect(aplicar).toBeDisabled()
    await userEvent.click(aplicar)
    expect(svc.applyShopifyConnect).not.toHaveBeenCalled()
  })

  it('vista previa sin `settings:manage`: se ve el título, «Aplicar» y «Cancelar» deshabilitados y quién puede', async () => {
    access.allowed = ['inventory:read']
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    renderPage()
    expect(await screen.findByText('preview.readOnly')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'preview.apply' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'preview.cancel' })).toBeDisabled()
    expect(svc.getShopifyConnectReview).not.toHaveBeenCalled()
  })

  it('🔴 requisito 4: lista para revisar pero Shopify le quitó un permiso (FALTA_PERMISO): se DETIENE y ofrece volver a dar permiso, no «Aplicar»', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR', importacion: { variantes: 10, error: 'FALTA_PERMISO' } })),
    )
    renderPage()
    expect(await screen.findByText('connect.importStopped')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'avisos.reauthorize' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'preview.apply' })).toBeNull()
    expect(svc.getShopifyConnectReview).not.toHaveBeenCalled()
  })

  it('aplicando: avance hechas de total', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'APLICANDO', aplicacion: { hechas: 10, total: 30 } })),
    )
    renderPage()
    expect(await screen.findByText('preview.applying 10 30')).toBeInTheDocument()
  })

  it('🔴 requisito 8: al pasar de APLICANDO a ACTIVA se invalidan las listas (las filas de antes no se quedan)', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'APLICANDO', aplicacion: { hechas: 10, total: 30 } })),
    )
    const { client } = renderPage()
    expect(await screen.findByText('preview.applying 10 30')).toBeInTheDocument()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['shopify', 'v1', 'reviews'] }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['shopify', 'v1', 'issues'] })
    expect(await screen.findByText('status.store')).toBeInTheDocument()
  })

  it('🔴 D1: si la aplicación regresa a «Así quedará» (APLICANDO → POR_APLICAR) lo dice en la página y vuelve a pedir la vista previa', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'APLICANDO', aplicacion: { hechas: 10, total: 30 } })),
    )
    const { client } = renderPage()
    expect(await screen.findByText('preview.applying 10 30')).toBeInTheDocument()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([VISTA], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
      conexion: { linkId: 'l1', generation: 1, tokenVersion: 1 },
    })
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['shopify', 'v1', 'connect-review'] }))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'preview.devuelta' }))
    expect(await screen.findByText('preview.porDecidir 1')).toBeInTheDocument()
  })

  it('D1: el regreso a la vista previa avisa UNA sola vez (un resumen que se repite en POR_APLICAR no vuelve a avisar ni a pedir la vista previa)', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'APLICANDO', aplicacion: { hechas: 10, total: 30 } })),
    )
    svc.getShopifyConnectReview.mockResolvedValue({ ...pagina([VISTA], 1), resumen: RESUMEN_VISTA })
    const { client } = renderPage()
    expect(await screen.findByText('preview.applying 10 30')).toBeInTheDocument()
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    expect(toast.mock.calls.filter(([a]) => a?.title === 'preview.devuelta')).toHaveLength(1)
    expect(invalidar.mock.calls.filter(([a]) => JSON.stringify(a?.queryKey) === '["shopify","v1","connect-review"]')).toHaveLength(0)
  })

  it('🔴 D1: quien NO tiene `settings:manage` no recibe el aviso de «regresó a la vista previa» (no puede elegir ni aplicar), pero la vista previa sí se vuelve a leer', async () => {
    access.allowed = ['inventory:read', 'inventory:adjust']
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'REVIEWING', estado: 'APLICANDO', aplicacion: { hechas: 10, total: 30 } })),
    )
    const { client } = renderPage()
    expect(await screen.findByText('preview.applying 10 30')).toBeInTheDocument()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['shopify', 'v1', 'connect-review'] }))
    expect(await screen.findByText('preview.readOnly')).toBeInTheDocument() // ya está en la vista previa, de sólo lectura
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'preview.devuelta' }))
    expect(toast).not.toHaveBeenCalled()
  })

  it('D1: llegar a la vista previa sin venir de «aplicando» (la primera carga, o venir de importar) no dice que «regresó»', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 40, error: null } })),
    )
    svc.getShopifyConnectReview.mockResolvedValue({ ...pagina([VISTA], 1), resumen: RESUMEN_VISTA })
    const { client } = renderPage()
    expect(await screen.findByText('connect.importing')).toBeInTheDocument()
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'preview.devuelta' }))
  })

  it('D1: la explicación de los decimales está SIEMPRE a la vista mientras falten productos por elegir (sin tocar nada), como línea de ayuda de los botones', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 3),
      resumen: { ...RESUMEN_VISTA, porDecidir: 3 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 1, porDecidir: 2 })
    renderPage()
    await screen.findByText('preview.todosAyuda 3')
    // Primera pintada, ningún clic: la persona que volvió a la página (o a la que la aplicación regresó a la vista previa) la ve igual.
    const ayuda = screen.getByText('preview.todosQuedaronDetalle')
    expect(ayuda).toBeInTheDocument()
    expect(ayuda).toHaveAttribute('role', 'status') // se anuncia igual que la línea de «faltan por elegir»
    expect(ayuda).toHaveClass('text-muted-foreground')
    // Debajo de los botones de «en los que faltan», no antes.
    const botones = screen.getByRole('button', { name: 'preview.todosShopify' })
    expect(botones.compareDocumentPosition(ayuda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // El clic no la duplica ni la mueve, y el aviso emergente se conserva.
    await userEvent.click(screen.getByRole('button', { name: 'preview.todosAvoqado' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'preview.todosQuedaron 1 2' })))
    expect(screen.getAllByText('preview.todosQuedaronDetalle')).toHaveLength(1)
    // Elegir «Shopify» en los que faltan ya no deja a nadie sin elegir: la línea se va con los botones.
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 2, porDecidir: 0 })
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([{ ...DECIDE, eleccion: 'SHOPIFY' }], 3),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    await userEvent.click(screen.getByRole('button', { name: 'preview.todosShopify' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'preview.todosAvoqado' })).toBeNull())
    expect(screen.queryByText('preview.todosQuedaronDetalle')).toBeNull()
  })

  it('D1: «Avoqado en los que faltan» que SÍ alcanzó a todos no deja aviso emergente ni línea de decimales', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIDE], 2),
      resumen: { ...RESUMEN_VISTA, porDecidir: 2 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 2, porDecidir: 0 })
    renderPage()
    const avoqado = await screen.findByRole('button', { name: 'preview.todosAvoqado' })
    // Ya se eligieron todos: lo que el servidor devuelve al releer.
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([{ ...DECIDE, eleccion: 'AVOQADO' }], 2),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    await userEvent.click(avoqado)
    await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'preview.todosAvoqado' })).toBeNull())
    expect(screen.queryByText('preview.todosQuedaronDetalle')).toBeNull()
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('preview.todosQuedaron') }))
  })

  it('D1: en «Nuevos» con productos por elegir, una línea manda a «Cambian» (donde se elige); en «Cambian» y en «Todos» no sale', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const NUEVO = { ...VISTA, nuevo: true }
    svc.getShopifyConnectReview.mockImplementation(async (_v: string, { filtro }: { filtro: string }) => ({
      ...pagina([filtro === 'NUEVOS' ? NUEVO : VISTA], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 2 },
      conexion: VISTA_CONEXION,
    }))
    renderPage()
    await screen.findByText('preview.porDecidir 2')
    expect(screen.getByRole('button', { name: 'preview.filtros.CAMBIAN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('preview.eligeEnCambian')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'preview.filtros.NUEVOS' }))
    expect(await screen.findByText('preview.eligeEnCambian')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'preview.filtros.TODOS' })) // en «Todos» sí están las decisiones
    await waitFor(() => expect(screen.queryByText('preview.eligeEnCambian')).toBeNull())
  })

  it('D1: sin nada por elegir, «Nuevos» no manda a ningún lado', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([{ ...VISTA, nuevo: true }], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 0 },
      conexion: VISTA_CONEXION,
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'preview.filtros.NUEVOS' }))
    await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledWith('v1', { offset: 0, filtro: 'NUEVOS' }))
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(screen.queryByText(/preview\.porDecidir/)).toBeNull()
    expect(screen.queryByText('preview.eligeEnCambian')).toBeNull()
  })

  it('D1: el texto de «quedan N en los dos» recibe también `count`, para que 1 se lea en singular («Queda 1»)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const UNA = { ...VISTA, avoqadoQty: '1', shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([UNA], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
      conexion: VISTA_CONEXION,
    })
    renderPage()
    const [avoqado, shopify] = await screen.findAllByRole('radio')
    expect(avoqado).toHaveTextContent('preview.quedanEnLosDos 1 1') // {count, qty}: el singular lo decide `count`
    expect(shopify).toHaveTextContent('preview.quedanEnLosDos 6 6')
  })

  // Prueba en vivo (D1/B): con stock de Avoqado en decimales («49.5») «Usar el de Avoqado» prometía «Quedan 49.5 en los dos», y
  // al tocarla el servidor contestaba 422 SHOPIFY_DIFERENCIA_NO_ENTERA. «Apagado se ve y se explica»: la opción sale apagada de
  // entrada, con su razón; la decisión sale del TEXTO del stock (sin números flotantes). El caso raro «A entero, pendiente con
  // decimales» lo sigue cubriendo el 422 del servidor.
  it('🔴 D1: con stock de Avoqado en decimales, «Usar el de Avoqado» sale apagada con su razón (no promete un resultado imposible) y tocarla no manda nada; «Usar el de Shopify» sigue activa', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
    const DECIMALES = { ...VISTA, avoqadoQty: '49.5', shopifyQty: 50, quedara: '50', requiereDecision: true, eleccion: null }
    svc.getShopifyConnectReview.mockResolvedValue({
      ...pagina([DECIMALES], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
      conexion: VISTA_CONEXION,
    })
    svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 1, porDecidir: 0 })
    renderPage()
    const [avoqado, shopify] = await screen.findAllByRole('radio')
    expect(avoqado).toBeDisabled()
    expect(avoqado).toHaveAttribute('aria-disabled', 'true')
    expect(avoqado).toHaveTextContent('preview.usarAvoqado')
    expect(avoqado).toHaveTextContent('preview.avoqadoConDecimales') // la razón, en lugar de «Quedan 49.5 en los dos»
    expect(avoqado).not.toHaveTextContent('preview.quedanEnLosDos')
    expect(shopify).toBeEnabled()
    expect(shopify).not.toHaveAttribute('aria-disabled', 'true')
    expect(shopify).toHaveTextContent('preview.quedanEnLosDos 50 50')
    await userEvent.click(avoqado)
    expect(svc.saveShopifyConnectChoices).not.toHaveBeenCalled()
    // Shopify, en cambio, se guarda como siempre.
    await userEvent.click(shopify)
    await waitFor(() =>
      expect(svc.saveShopifyConnectChoices).toHaveBeenCalledWith('v1', {
        vista: VISTA_CONEXION,
        elecciones: [{ variantLinkId: 'vl1', choice: 'SHOPIFY', expectedAvoqadoQty: '49.5', expectedShopifyQty: 50 }],
      }),
    )
  })

  it.each(['50', '50.000', '50.0'])(
    'D1: con stock de Avoqado entero («%s») «Usar el de Avoqado» sigue activa y dice cuántas quedan',
    async qty => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
      const ENTERO = { ...VISTA, avoqadoQty: qty, shopifyQty: 6, quedara: '6', requiereDecision: true, eleccion: null }
      svc.getShopifyConnectReview.mockResolvedValue({
        ...pagina([ENTERO], 1),
        resumen: { ...RESUMEN_VISTA, porDecidir: 1 },
        conexion: VISTA_CONEXION,
      })
      svc.saveShopifyConnectChoices.mockResolvedValue({ guardadas: 1, porDecidir: 0 })
      renderPage()
      const [avoqado] = await screen.findAllByRole('radio')
      expect(avoqado).toBeEnabled()
      expect(avoqado).not.toHaveAttribute('aria-disabled', 'true')
      expect(avoqado).toHaveTextContent('preview.quedanEnLosDos')
      expect(avoqado).not.toHaveTextContent('preview.avoqadoConDecimales')
      await userEvent.click(avoqado)
      await waitFor(() =>
        expect(svc.saveShopifyConnectChoices).toHaveBeenCalledWith('v1', {
          vista: VISTA_CONEXION,
          elecciones: [{ variantLinkId: 'vl1', choice: 'AVOQADO', expectedAvoqadoQty: qty, expectedShopifyQty: 6 }],
        }),
      )
    },
  )

  // Codex (auditoría D1/B, P1): «Aplicar» no sabía de los guardados en camino. Con «Usar el de Avoqado» ya guardado y nada
  // pendiente, «Aplicar» estaba habilitado: tocar «Usar el de Shopify» y apretar «Aplicar» antes de que el guardado llegara
  // aplicaba la elección VIEJA, y el guardado tardío chocaba con la conexión ya aplicando.
  describe('🔴 D1 (Codex P1): «Aplicar» espera a los guardados de elección en camino', () => {
    const DECIDE = { ...VISTA, avoqadoQty: '5', shopifyQty: 6, quedara: '6', requiereDecision: true }
    /** Una promesa que la prueba resuelve a mano: la petición «se queda colgada» hasta entonces. */
    const diferida = <T,>() => {
      let resolver!: (v: T) => void
      let rechazar!: (e: unknown) => void
      const promesa = new Promise<T>((res, rej) => {
        resolver = res
        rechazar = rej
      })
      return { promesa, resolver, rechazar }
    }
    const vistaPrevia = (eleccion: 'AVOQADO' | 'SHOPIFY' | null, porDecidir = 0) => ({
      ...pagina([{ ...DECIDE, eleccion }], 1),
      resumen: { ...RESUMEN_VISTA, porDecidir },
      conexion: VISTA_CONEXION,
    })
    const aplicar = () => screen.getByRole('button', { name: 'preview.apply' })

    it('guardado colgado: «Aplicar» se apaga (con su razón), sigue apagado mientras se vuelve a leer la vista previa y sólo entonces se habilita', async () => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
      const guardado = diferida<{ guardadas: number; porDecidir: number }>()
      const relectura = diferida<ReturnType<typeof vistaPrevia>>()
      svc.getShopifyConnectReview
        .mockResolvedValueOnce(vistaPrevia('AVOQADO'))
        .mockImplementationOnce(() => relectura.promesa)
        .mockResolvedValue(vistaPrevia('SHOPIFY')) // lo que lea «Aplicar» al terminar (invalida la conexión)
      svc.saveShopifyConnectChoices.mockImplementation(() => guardado.promesa)
      svc.applyShopifyConnect.mockResolvedValue({ solicitado: true })
      renderPage()
      await waitFor(() => expect(aplicar()).toBeEnabled())
      expect(screen.queryByText('preview.guardando')).toBeNull()

      // Toca «Usar el de Shopify»: el guardado queda en camino.
      await userEvent.click(screen.getAllByRole('radio')[1])
      await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(aplicar()).toBeDisabled())
      expect(screen.getByText('preview.guardando')).toBeInTheDocument()
      await userEvent.click(aplicar()) // un clic sobre un botón apagado no abre el diálogo ni aplica
      expect(screen.queryByText('preview.applyBody')).toBeNull()
      expect(svc.applyShopifyConnect).not.toHaveBeenCalled()

      // El guardado llega, pero la vista previa todavía no se vuelve a leer: sigue apagado.
      await act(async () => guardado.resolver({ guardadas: 1, porDecidir: 0 }))
      await waitFor(() => expect(svc.getShopifyConnectReview).toHaveBeenCalledTimes(2))
      expect(aplicar()).toBeDisabled()
      expect(screen.getByText('preview.guardando')).toBeInTheDocument()

      // La vista previa regresa con la elección nueva: se habilita y ya no dice «Guardando».
      await act(async () => relectura.resolver(vistaPrevia('SHOPIFY')))
      await waitFor(() => expect(aplicar()).toBeEnabled())
      expect(screen.queryByText('preview.guardando')).toBeNull()
      expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true')
      expect(svc.applyShopifyConnect).not.toHaveBeenCalled()
      await userEvent.click(aplicar())
      await userEvent.click(await screen.findByRole('button', { name: 'preview.applyConfirm' }))
      await waitFor(() => expect(svc.applyShopifyConnect).toHaveBeenCalledTimes(1))
    })

    it('con el diálogo de «Aplicar» ya abierto: un guardado en camino apaga también «Sí, aplicar», y no aplica hasta que termina', async () => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
      const guardado = diferida<{ guardadas: number; porDecidir: number }>()
      svc.getShopifyConnectReview.mockResolvedValueOnce(vistaPrevia('AVOQADO')).mockResolvedValue(vistaPrevia('SHOPIFY'))
      svc.saveShopifyConnectChoices.mockImplementation(() => guardado.promesa)
      svc.applyShopifyConnect.mockResolvedValue({ solicitado: true })
      renderPage()
      await waitFor(() => expect(aplicar()).toBeEnabled())
      const shopify = screen.getAllByRole('radio')[1]
      await userEvent.click(aplicar())
      const confirmar = await screen.findByRole('button', { name: 'preview.applyConfirm' })
      expect(confirmar).toBeEnabled()

      // Con el diálogo abierto llega un guardado (el diálogo es modal: se dispara el evento directo, sin puntero).
      fireEvent.click(shopify)
      await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(confirmar).toBeDisabled())
      fireEvent.click(confirmar)
      expect(svc.applyShopifyConnect).not.toHaveBeenCalled()

      await act(async () => guardado.resolver({ guardadas: 1, porDecidir: 0 }))
      await waitFor(() => expect(confirmar).toBeEnabled())
      expect(svc.applyShopifyConnect).not.toHaveBeenCalled()
    })

    it('«en los que faltan» también cuenta: mientras se guarda dice por qué «Aplicar» espera, y se habilita al volver la vista previa sin faltantes', async () => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
      const guardado = diferida<{ guardadas: number; porDecidir: number }>()
      svc.getShopifyConnectReview.mockResolvedValueOnce(vistaPrevia(null, 1)).mockResolvedValue(vistaPrevia('AVOQADO', 0))
      svc.saveShopifyConnectChoices.mockImplementation(() => guardado.promesa)
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'preview.todosAvoqado' }))
      await waitFor(() => expect(svc.saveShopifyConnectChoices).toHaveBeenCalledWith('v1', { vista: VISTA_CONEXION, todos: 'AVOQADO' }))
      expect(screen.getByText('preview.guardando')).toBeInTheDocument()
      expect(aplicar()).toBeDisabled()
      await act(async () => guardado.resolver({ guardadas: 1, porDecidir: 0 }))
      await waitFor(() => expect(aplicar()).toBeEnabled())
      expect(screen.queryByText('preview.guardando')).toBeNull()
    })

    it('un guardado que FALLA libera «Aplicar» (no se queda apagado para siempre) una vez que la vista previa se vuelve a leer', async () => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ fase: 'REVIEWING', estado: 'POR_APLICAR' })))
      const guardado = diferida<{ guardadas: number; porDecidir: number }>()
      svc.getShopifyConnectReview.mockResolvedValue(vistaPrevia('AVOQADO'))
      svc.saveShopifyConnectChoices.mockImplementation(() => guardado.promesa)
      renderPage()
      await waitFor(() => expect(aplicar()).toBeEnabled())
      await userEvent.click(screen.getAllByRole('radio')[1])
      await waitFor(() => expect(aplicar()).toBeDisabled())
      // Se rechaza con un 409 (RELEER): se dice y se vuelve a leer la vista previa.
      const antes = svc.getShopifyConnectReview.mock.calls.length
      await act(async () => guardado.rechazar(errorHttp(409, { code: 'SHOPIFY_REVISION_CAMBIO', message: 'cambió' })))
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
      await waitFor(() => expect(svc.getShopifyConnectReview.mock.calls.length).toBeGreaterThan(antes))
      await waitFor(() => expect(aplicar()).toBeEnabled())
      expect(screen.queryByText('preview.guardando')).toBeNull()
    })
  })
})

describe('ShopifyIntegration — «Por revisar»', () => {
  it('W5: un producto que se liga POR PRIMERA VEZ (ya existía en Avoqado) no dice «se volvió a emparejar»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(
      pagina([
        { ...REVISION, id: 'r1', reason: 'REACTIVADA', primeraVez: true },
        { ...REVISION, id: 'r2', reason: 'REACTIVADA', primeraVez: false, product: { id: 'p2', name: 'Gorra', sku: 'GOR' } },
      ]),
    )
    renderPage()
    expect(await screen.findByText('review.primeraVez')).toBeInTheDocument()
    // La que sí se volvió a emparejar (estaba suspendida) conserva su texto.
    expect(screen.getAllByText('review.reasons.REACTIVADA')).toHaveLength(1)
  })

  it('W5 (regresión): un servidor que todavía no manda `primeraVez` muestra el texto de siempre', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([{ ...REVISION, reason: 'REACTIVADA' }]))
    renderPage()
    expect(await screen.findByText('review.reasons.REACTIVADA')).toBeInTheDocument()
    expect(screen.queryByText('review.primeraVez')).toBeNull()
  })

  it('manda las cantidades que se VIERON y «Sugerido» queda fuera del botón', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    svc.resolveShopifyReview.mockResolvedValue({ estado: 'RESUELTO' })
    renderPage()
    const boton = await screen.findByRole('button', { name: 'review.useShopify' })
    expect(within(boton).queryByText('review.suggested')).toBeNull()
    expect(screen.getByText('review.suggested')).toBeInTheDocument()
    await userEvent.click(boton)
    await waitFor(() =>
      expect(svc.resolveShopifyReview).toHaveBeenCalledWith('v1', 'r1', {
        choice: 'SHOPIFY',
        expectedAvoqadoQty: '5',
        expectedShopifyQty: 4,
      }),
    )
    expect(toast).toHaveBeenCalledWith({ title: 'review.resolved' })
  })

  it('🔴 409 «cambió» (RELEER): se ven las cantidades NUEVAS y el siguiente intento manda ésas (N13)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews
      .mockResolvedValueOnce(pagina([REVISION]))
      .mockResolvedValue(pagina([{ ...REVISION, avoqadoQty: '6', shopifyQty: 7 }]))
    svc.resolveShopifyReview
      .mockRejectedValueOnce(errorHttp(409, { code: 'SHOPIFY_REVISION_CAMBIO', message: 'cambió' }))
      .mockResolvedValue({ estado: 'RESUELTO' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'review.useShopify' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_REVISION_CAMBIO' }))
    expect(await screen.findByText('review.shopify 7')).toBeInTheDocument()
    expect(screen.getByText('review.avoqado 6')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'review.useShopify' }))
    await waitFor(() =>
      expect(svc.resolveShopifyReview).toHaveBeenLastCalledWith('v1', 'r1', {
        choice: 'SHOPIFY',
        expectedAvoqadoQty: '6',
        expectedShopifyQty: 7,
      }),
    )
  })

  it('🔴 resolver sin permiso de Shopify (403): lo dice, explica por qué ya no se elige y ofrece volver a dar permiso', async () => {
    svc.getShopifyOverview
      .mockResolvedValueOnce(resumen(conexion()))
      .mockResolvedValue(resumen(conexion({ importacion: { variantes: 120, error: 'FALTA_PERMISO' } })))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    svc.resolveShopifyReview.mockRejectedValue(errorHttp(403, { code: 'SHOPIFY_FALTA_PERMISO', message: 'falta' }))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'review.useShopify' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_FALTA_PERMISO' }))
    expect(await screen.findByText('review.permissionResolve')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'review.useShopify' })).toBeNull()
    expect(screen.getByText('connect.importErrors.FALTA_PERMISO')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'avisos.reauthorize' }).length).toBeGreaterThan(0)
  })

  it('resolver con la pantalla vieja tras perder el permiso (409 SHOPIFY_EN_PAUSA, B no vuelve a preguntar): lo dice e invalida el resumen', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    svc.resolveShopifyReview.mockRejectedValue(errorHttp(409, { code: 'SHOPIFY_EN_PAUSA', message: 'pausa' }))
    renderPage()
    const antes = svc.getShopifyOverview.mock.calls.length
    await userEvent.click(await screen.findByRole('button', { name: 'review.useShopify' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_EN_PAUSA' }))
    await waitFor(() => expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThan(antes))
  })

  it('sin `inventory:adjust`: los botones de elegir se ven DESHABILITADOS y el texto dice por qué y a quién pedirlo', async () => {
    access.allowed = ['inventory:read', 'settings:manage']
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    renderPage()
    expect(await screen.findByRole('button', { name: 'review.useShopify' })).toBeDisabled()
    expect(screen.getByText('review.readOnlyResolve')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'review.useAvoqado' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'review.useShopify' }))
    expect(svc.resolveShopifyReview).not.toHaveBeenCalled()
  })

  it.each(SHOPIFY_ENVIOS)(
    '🔴 una elección con envío %s se ve al recargar, por SU envío y no por el buzón de la sucursal (N5)',
    async envio => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ conteos: { ...CONTEOS, pendientes: 5 } })))
      svc.listShopifyReviews.mockResolvedValue(pagina([{ ...REVISION, status: 'RESOLVED', choice: 'AVOQADO', envio }]))
      renderPage()
      expect(await screen.findByText(`review.envio.${envio}`)).toBeInTheDocument()
      expect(screen.getByText('review.elegiste.AVOQADO')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'review.useAvoqado' })).toBeNull()
      for (const otro of SHOPIFY_ENVIOS.filter(e => e !== envio)) expect(screen.queryByText(`review.envio.${otro}`)).toBeNull()
    },
  )

  it('🔴 con varias páginas cargadas, el sondeo pregunta SÓLO por las elecciones en camino y las páginas se piden exactamente UNA vez; al llegar los envíos sólo se refresca el resumen (R2-4, ruling del requisito 8c)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    const servidor = new Map<string, ShopifyReview['envio']>([
      ['r1', 'PENDIENTE'],
      ['r2', 'PENDIENTE'],
    ])
    const enCamino = (id: string, name: string): ShopifyReview => ({
      ...REVISION,
      id,
      status: 'RESOLVED',
      choice: 'AVOQADO',
      envio: servidor.get(id) ?? null,
      product: { id: `p-${id}`, name, sku: null },
    })
    svc.listShopifyReviews.mockImplementation(async (_v: string, o: { offset: number }) =>
      o.offset === 0 ? pagina([enCamino('r1', 'Camisa · M')], 2, 20) : pagina([enCamino('r2', 'Gorra · Única')], 2, null),
    )
    let vueltas = 0
    svc.getShopifyReviewEnvios.mockImplementation(async (_venueId: string, ids: string[]) => {
      vueltas += 1
      if (vueltas >= 2) ids.forEach(id => servidor.set(id, 'ENVIADO'))
      return { items: ids.map(id => ({ id, status: 'RESOLVED', choice: 'AVOQADO', envio: servidor.get(id) })) }
    })
    renderPage()
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'list.loadMore' }))
    expect(await screen.findByText('Gorra · Única')).toBeInTheDocument()
    expect(svc.listShopifyReviews).toHaveBeenCalledTimes(2)
    // El siguiente ciclo (5 s) pregunta SÓLO por las dos en camino: llegan a Shopify y la pantalla lo dice.
    expect(await screen.findAllByText('review.envio.ENVIADO', {}, { timeout: 9000 })).toHaveLength(2)
    expect(svc.getShopifyReviewEnvios).toHaveBeenLastCalledWith('v1', ['r1', 'r2'])
    // Y como llegaron (PENDIENTE → ENVIADO) se refresca el resumen (los conteos); las páginas NO se vuelven a pedir.
    await waitFor(() => expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThan(1))
    await new Promise(r => setTimeout(r, 300))
    expect(svc.listShopifyReviews).toHaveBeenCalledTimes(2)
    expect(svc.getShopifyReviewEnvios.mock.calls.every(([, ids]) => (ids as string[]).length <= 50)).toBe(true)
  }, 15_000)

  it('🔴 60 elecciones en camino: tandas de ≤ 50 que avanzan, una primera lenta no frena a las demás y lo visto se conserva (R3-3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
      const ids = Array.from({ length: 60 }, (_, n) => `r${String(n).padStart(2, '0')}`)
      const servidor = new Map<string, ShopifyReview['envio']>(ids.map(id => [id, 'PENDIENTE']))
      const enCamino = (id: string): ShopifyReview => ({
        ...REVISION,
        id,
        status: 'RESOLVED',
        choice: 'AVOQADO',
        envio: servidor.get(id) ?? null,
        product: { id: `p-${id}`, name: `Producto ${id}`, sku: null },
      })
      svc.listShopifyReviews.mockImplementation(async () => pagina(ids.map(enCamino), 60, null))
      const respuesta = (pedidos: string[]) => ({
        items: pedidos.map(id => ({
          id,
          status: 'RESOLVED' as const,
          choice: 'AVOQADO' as const,
          envio: servidor.get(id) as (typeof SHOPIFY_ENVIOS)[number],
        })),
      })
      let soltarPrimera: () => void = () => {}
      svc.getShopifyReviewEnvios
        // La primera tanda tarda (el server va lento) y, cuando contesta, siguen en camino.
        .mockImplementationOnce((_v: string, pedidos: string[]) => new Promise(r => (soltarPrimera = () => r(respuesta(pedidos)))))
        .mockImplementation(async (_v: string, pedidos: string[]) => {
          pedidos.forEach(id => servidor.set(id, 'ENVIADO'))
          return respuesta(pedidos)
        })
      renderPage()
      await waitFor(() => expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(1))
      expect(svc.getShopifyReviewEnvios.mock.calls[0][1]).toEqual(ids.slice(0, 50))
      // Mientras la primera no contesta, no se encima otra petición.
      await act(() => vi.advanceTimersByTimeAsync(11_000))
      expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(1)
      await act(async () => soltarPrimera())
      // El siguiente ciclo avanza a las que faltaban (r50-r59) y completa con las primeras, sin pasar de 50.
      await act(() => vi.advanceTimersByTimeAsync(5_000))
      await waitFor(() => expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(2))
      expect(svc.getShopifyReviewEnvios.mock.calls[1][1]).toEqual([...ids.slice(50), ...ids.slice(0, 40)])
      // Lo ya visto se conserva al cambiar de tanda: el ciclo siguiente pregunta sólo por las 10 que quedaron en camino.
      await act(() => vi.advanceTimersByTimeAsync(5_000))
      await waitFor(() => expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(3))
      expect(svc.getShopifyReviewEnvios.mock.calls[2][1]).toEqual(ids.slice(40, 50))
      expect(await screen.findAllByText('review.envio.ENVIADO')).toHaveLength(60)
      // Ya no queda ninguna en camino: no se pregunta más, y las páginas nunca se volvieron a pedir (ruling del requisito 8c).
      await act(() => vi.advanceTimersByTimeAsync(15_000))
      expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(3)
      expect(svc.listShopifyReviews).toHaveBeenCalledTimes(1)
      expect(svc.getShopifyReviewEnvios.mock.calls.every(([, pedidos]) => (pedidos as string[]).length <= 50)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each<[string, ShopifyConnection, boolean]>([
    ['plan inactivo', conexion(), false],
    ['pausada', pausada(), false],
    ['tienda revocada', conexion({ estado: 'REVOCADA' }), true],
    ['sin permiso de Shopify', conexion({ importacion: { variantes: 120, error: 'FALTA_PERMISO' } }), true],
  ])(
    '🔴 con la conexión detenida (%s) no se pregunta por las elecciones en camino y se dice «En pausa: se enviará al reanudar» (R2-4, L7, Z7)',
    async (_caso, c, planActive) => {
      svc.getShopifyOverview.mockResolvedValue(resumen(c, planActive))
      svc.listShopifyReviews.mockResolvedValue(pagina([{ ...REVISION, status: 'RESOLVED', choice: 'AVOQADO', envio: 'PENDIENTE' }]))
      renderPage()
      expect(await screen.findByText('review.envioEnPausa')).toBeInTheDocument()
      expect(screen.queryByText('review.envio.PENDIENTE')).toBeNull()
      expect(svc.getShopifyReviewEnvios).not.toHaveBeenCalled()
    },
  )

  it.each(['ATORADO', 'ENVIADO'] as const)(
    '🔴 ruling del requisito 8c: un envío que pasa de PENDIENTE a %s refresca SÓLO el resumen (una vez); la lista no se vuelve a pedir',
    async nuevo => {
      svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
      svc.listShopifyReviews.mockResolvedValue(pagina([{ ...REVISION, status: 'RESOLVED', choice: 'AVOQADO', envio: 'PENDIENTE' }]))
      svc.getShopifyReviewEnvios.mockImplementation(async (_venueId: string, ids: string[]) => ({
        items: ids.map(id => ({ id, status: 'RESOLVED', choice: 'AVOQADO', envio: nuevo })),
      }))
      renderPage()
      expect(await screen.findByText(`review.envio.${nuevo}`)).toBeInTheDocument()
      // El resumen: la primera carga y UN refresco por el cambio (nada lo sondea: no hay cuadre pedido ni cambios en camino).
      await waitFor(() => expect(svc.getShopifyOverview).toHaveBeenCalledTimes(2))
      await new Promise(r => setTimeout(r, 300))
      expect(svc.getShopifyOverview).toHaveBeenCalledTimes(2)
      expect(svc.listShopifyReviews).toHaveBeenCalledTimes(1)
      expect(svc.listShopifyIssues).toHaveBeenCalledTimes(1)
    },
  )

  it('🔴 Z7: una elección resuelta SIN envío en camino sólo dice qué eligió; nunca «ya llegó»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([{ ...REVISION, status: 'RESOLVED', choice: 'SHOPIFY', envio: null }]))
    renderPage()
    expect(await screen.findByText('review.elegiste.SHOPIFY')).toBeInTheDocument()
    expect(screen.queryByText('review.envio.ENVIADO')).toBeNull()
    expect(screen.queryByText(/review\.envio\./)).toBeNull()
  })

  it('tras «usar Avoqado», la lista vuelve a pedirse y enseña la elección en camino', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews
      .mockResolvedValueOnce(pagina([REVISION]))
      .mockResolvedValue(pagina([{ ...REVISION, status: 'RESOLVED', choice: 'AVOQADO', envio: 'PENDIENTE' }]))
    svc.resolveShopifyReview.mockResolvedValue({ estado: 'ENVIO_PENDIENTE' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'review.useAvoqado' }))
    expect(await screen.findByText('review.envio.PENDIENTE')).toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith({ title: 'review.savedChoice' })
    expect(svc.resolveShopifyReview).toHaveBeenCalledWith('v1', 'r1', { choice: 'AVOQADO', expectedAvoqadoQty: '5', expectedShopifyQty: 4 })
  })

  it('🔴 L19: con `#por-revisar` en la URL, la sección hace scroll cuando la lista termina de cargar (y sólo una vez)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    renderPage('/#por-revisar')
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('por-revisar'))
  })

  it('L19: sin el hash, la página no se mueve sola', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    renderPage()
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('ShopifyIntegration — estados de las listas (N4)', () => {
  it('🔴 la primera carga falla: dice el error y deja reintentar; nunca «Todo cuadra»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyReviews.mockRejectedValue(errorHttp(500, {}))
    renderPage()
    expect(await screen.findByText('review.loadError', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.queryByText('review.empty')).toBeNull()
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    await userEvent.click(screen.getByRole('button', { name: 'common:retry' }))
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
  })

  it('🔴 vacía y luego la actualización falla: dice que no está al día y deja de decir «Todo cuadra»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    const { client } = renderPage()
    expect(await screen.findByText('review.empty')).toBeInTheDocument()
    svc.listShopifyReviews.mockRejectedValue(errorHttp(500, {}))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'reviews'] }))
    expect(await screen.findByText('list.staleError', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.queryByText('review.empty')).toBeNull()
    expect(screen.getByRole('button', { name: 'common:retry' })).toBeEnabled()
  })

  it('🔴 la página 1 carga y la 2 falla: el error es de «Cargar más» y las filas de arriba siguen', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyIssues.mockResolvedValueOnce(pagina([ISSUE], 21, 20)).mockRejectedValue(errorHttp(500, {}))
    renderPage()
    expect(await screen.findByText('Gorra')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'list.loadMore' }))
    expect(await screen.findByText('list.loadMoreError', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.getByText('Gorra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'list.retryLoadMore' })).toBeEnabled()
    expect(screen.queryByText('list.staleError')).toBeNull()
  })

  it('búsqueda, motivo y «Cargar más» van al servidor', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyIssues.mockResolvedValue(pagina([ISSUE], 21, 20))
    renderPage()
    expect(await screen.findByText('Gorra')).toBeInTheDocument()
    expect(screen.getByText('issues.reasons.SIN_SKU')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'review.search' }), 'camisa')
    await waitFor(() => expect(svc.listShopifyReviews).toHaveBeenCalledWith('v1', { offset: 0, q: 'camisa' }))
    expect(screen.getByRole('textbox', { name: 'review.search' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'list.loadMore' }))
    await waitFor(() => expect(svc.listShopifyIssues).toHaveBeenCalledWith('v1', { offset: 20, q: '', reason: undefined }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'issues.reasonLabel' }), 'SIN_SKU')
    await waitFor(() => expect(svc.listShopifyIssues).toHaveBeenCalledWith('v1', { offset: 0, q: '', reason: 'SIN_SKU' }))
  })
})

describe('ShopifyIntegration — «Productos sin pareja» (L8, Z8)', () => {
  it('🔴 L8: una fila con producto enlaza a su ficha (con `fullBasePath`); una sin producto, no', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyIssues.mockResolvedValue(
      pagina([
        { ...ISSUE, id: 'i1', title: 'Gorra', reason: 'METODO_RECETA', productId: 'p9' },
        { ...ISSUE, id: 'i2', title: 'Playera', reason: 'SIN_SKU', productId: null },
      ]),
    )
    renderPage()
    const enlace = await screen.findByRole('link', { name: 'issues.viewProduct' })
    expect(enlace).toHaveAttribute('href', '/venues/test/menumaker/products/p9')
    expect(screen.getAllByRole('link', { name: 'issues.viewProduct' })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'issues.backToQuantity' })).toBeNull()
  })

  it('🔴 L8 (X2): SIN_INVENTARIO dice «Volver a cantidad» y lleva a la pestaña de inventario del producto', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyIssues.mockResolvedValue(pagina([{ ...ISSUE, title: 'Bolsa', reason: 'SIN_INVENTARIO', productId: 'p7' }]))
    renderPage()
    const enlace = await screen.findByRole('link', { name: 'issues.backToQuantity' })
    expect(enlace).toHaveAttribute('href', '/venues/test/menumaker/products/p7#inventory')
    expect(screen.getByText('issues.reasons.SIN_INVENTARIO')).toBeInTheDocument()
  })

  it('🔴 Z8: ERROR_IMPORTACION llega con `detail: null` y se explica con el texto propio del motivo', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.listShopifyIssues.mockResolvedValue(pagina([{ ...ISSUE, title: 'Pantalón', reason: 'ERROR_IMPORTACION', detail: null }]))
    renderPage()
    expect(await screen.findByText('issues.reasons.ERROR_IMPORTACION')).toBeInTheDocument()
  })
})

describe('ShopifyIntegration — conexión activa, pausa y avisos', () => {
  it('D1: con cambios en camino y la conexión avanzando dice «pendiente de sincronizar»; sin nada en camino o en pausa, no', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ conteos: { ...CONTEOS, pendientes: 2 } })))
    const primera = renderPage()
    expect(await screen.findByText('status.pendingSync')).toBeInTheDocument()
    primera.unmount()
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    const segunda = renderPage()
    expect(await screen.findByText('status.store')).toBeInTheDocument()
    expect(screen.queryByText('status.pendingSync')).toBeNull()
    segunda.unmount()
    svc.getShopifyOverview.mockResolvedValue(resumen(pausada({ conteos: { ...CONTEOS, pendientes: 2 } })))
    renderPage()
    expect(await screen.findByText('status.store')).toBeInTheDocument()
    expect(screen.queryByText('status.pendingSync')).toBeNull()
  })

  it('pausada: lo explica SIN ofrecer comprar Premium, sin paywall y sin botones de resolver (N2)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(pausada(), false))
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    renderPage()
    expect(await screen.findByText('status.paused')).toBeInTheDocument()
    expect(screen.getByText('status.pausedContact')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'piloto.contact' })).toBeInTheDocument()
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'review.useShopify' })).toBeNull()
    expect(screen.getByText('review.inactiveResolve')).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/premium/i)
  })

  it('🔴 L7 (Z3): pausada con un cuadre pedido dice «se cuadrará al reanudar», nunca «cuadre en curso», y no se sondea', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      svc.getShopifyOverview.mockResolvedValue(resumen(pausada({ cuadre: { pendiente: true, ultimo: null } }), false))
      renderPage()
      expect(await screen.findByText('status.resyncOnResume')).toBeInTheDocument()
      expect(screen.queryByText('status.resyncing')).toBeNull()
      const llamadas = svc.getShopifyOverview.mock.calls.length
      await act(() => vi.advanceTimersByTimeAsync(16_000))
      expect(svc.getShopifyOverview.mock.calls.length).toBe(llamadas)
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 L6 (Y3): cuando el worker anunció su próximo intento, la tarjeta dice «Lo vuelve a intentar a las HH:MM» con la hora del negocio', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ proximoIntento: '2099-01-01T18:05:00.000Z' })))
    renderPage()
    expect(await screen.findByText('status.retryAt hora:2099-01-01T18:05:00.000Z')).toBeInTheDocument()
  })

  it('Shopify retiró el permiso: «Reconectar» va a Shopify por `navegar`', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ estado: 'REVOCADA' })))
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=r' })
    renderPage()
    expect(await screen.findByText('status.revoked')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.reconnect' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=r'))
  })

  it('🔴 Z2 (requisito 4): detenida por revocación no pinta los cambios en camino ni el retraso como avance, y no ofrece cuadrar', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ estado: 'REVOCADA', conteos: { ...CONTEOS, pendientes: 5 }, retrasoMin: 30 })),
    )
    renderPage()
    expect(await screen.findByText('status.revoked')).toBeInTheDocument()
    expect(screen.queryByText('status.pending')).toBeNull()
    expect(screen.queryByText('status.delay')).toBeNull()
    expect(screen.queryByRole('button', { name: 'status.resync' })).toBeNull()
  })

  it('Z2: con la conexión viva sí se ven los cambios en camino y el retraso', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ conteos: { ...CONTEOS, pendientes: 5 }, retrasoMin: 30 })))
    renderPage()
    expect(await screen.findByText('status.pending')).toBeInTheDocument()
    expect(screen.getByText('status.delay')).toBeInTheDocument()
  })

  it('sin `settings:manage`: Reconectar, Cuadrar y Desconectar se VEN, deshabilitados, y dice a quién pedirlo', async () => {
    access.allowed = ['inventory:read', 'inventory:adjust']
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ estado: 'REVOCADA' })))
    renderPage()
    expect(await screen.findByText('status.reconnectAskAdmin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'status.reconnect' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'status.disconnect' })).toBeDisabled()
  })

  it('sin `settings:manage` y activa: «Cuadrar ahora» y «Desconectar» se ven deshabilitados', async () => {
    access.allowed = ['inventory:read']
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    renderPage()
    expect(await screen.findByRole('button', { name: 'status.resync' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'status.disconnect' })).toBeDisabled()
    expect(screen.getByText('page.readOnly')).toBeInTheDocument()
  })

  it('«Desconectar» pasa por un diálogo que dice las consecuencias', async () => {
    svc.getShopifyOverview.mockResolvedValueOnce(resumen(conexion())).mockResolvedValue(resumen(null))
    svc.disconnectShopify.mockResolvedValue({ desconectado: true })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.disconnect' }))
    expect(await screen.findByText('status.disconnectBody')).toBeInTheDocument()
    expect(svc.disconnectShopify).not.toHaveBeenCalled()
    // Es una acción destructiva: el botón que confirma se pinta como tal.
    expect(screen.getByRole('button', { name: 'status.disconnectConfirm' })).toHaveClass('bg-destructive')
    await userEvent.click(screen.getByRole('button', { name: 'status.disconnectConfirm' }))
    await waitFor(() => expect(svc.disconnectShopify).toHaveBeenCalledWith('v1'))
    expect(toast).toHaveBeenCalledWith({ title: 'status.disconnected' })
    expect(await screen.findByRole('button', { name: 'connect.submit' })).toBeInTheDocument()
  })

  it('explica cada aviso de la campanita (incluido BARRIDO_OMITIDO del servidor) y deja volver a dar permiso (FALTA_PERMISO)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=p' })
    renderPage()
    expect(await screen.findByText('avisos.title')).toBeInTheDocument()
    // La lista del servidor (`ShopifyAviso`, notify.service): uno que falte aquí llega a la campanita sin explicación en la página.
    expect(SHOPIFY_AVISOS).toContain('BARRIDO_OMITIDO')
    for (const aviso of SHOPIFY_AVISOS) {
      expect(screen.getByText(`avisos.items.${aviso}.title`)).toBeInTheDocument()
      expect(screen.getByText(`avisos.items.${aviso}.body`)).toBeInTheDocument()
    }
    await userEvent.click(screen.getByRole('button', { name: 'avisos.reauthorize' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=p'))
  })

  it('🔴 «Cuadrar ahora»: mientras corre sólo se pide el resumen; al terminar aparece la diferencia SIN recargar (N6)', async () => {
    let cuadrando = false
    svc.getShopifyOverview.mockImplementation(async () => resumen(conexion({ cuadre: { pendiente: cuadrando, ultimo: null } })))
    svc.resyncShopify.mockImplementation(async () => {
      cuadrando = true
      return { programado: true }
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.resync' }))
    expect(await screen.findByText('status.resyncing')).toBeInTheDocument()
    const antes = svc.listShopifyReviews.mock.calls.length
    svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
    cuadrando = false // el worker terminó: el siguiente resumen (sondeo de 5 s) ya no está pendiente
    expect(await screen.findByText('Camisa · M', {}, { timeout: 9000 })).toBeInTheDocument()
    expect(svc.listShopifyReviews.mock.calls.length).toBe(antes + 1)
  }, 15_000)

  it('🔴 un cuadre que termina ANTES del primer GET (nunca se ve «pendiente»): al cambiar `ultimo` aparece la diferencia (N6)', async () => {
    let ultimo = '2026-10-08T12:00:00.000Z'
    svc.getShopifyOverview.mockImplementation(async () => resumen(conexion({ cuadre: { pendiente: false, ultimo } })))
    svc.resyncShopify.mockImplementation(async () => {
      ultimo = '2026-10-08T12:05:00.000Z' // el worker ya cerró la vuelta cuando llega el siguiente GET del resumen
      svc.listShopifyReviews.mockResolvedValue(pagina([REVISION]))
      return { programado: true }
    })
    renderPage()
    expect(await screen.findByText('review.empty')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.resync' }))
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(screen.queryByText('review.empty')).toBeNull()
  })

  it.each<[string, ShopifyOverview]>([
    [
      'sin permiso de Shopify',
      resumen(conexion({ conteos: { ...CONTEOS, pendientes: 5 }, importacion: { variantes: 120, error: 'FALTA_PERMISO' } })),
    ],
    ['plan inactivo', resumen(conexion({ conteos: { ...CONTEOS, pendientes: 5 } }), false)],
  ])(
    '🔴 %s: aunque haya cambios en camino, el resumen NO se sondea (tres ciclos sin llamadas) y no se ofrece cuadrar (R2-4)',
    async (_caso, o) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        svc.getShopifyOverview.mockResolvedValue(o)
        renderPage()
        expect(await screen.findByText('status.store')).toBeInTheDocument()
        const llamadas = svc.getShopifyOverview.mock.calls.length
        await act(() => vi.advanceTimersByTimeAsync(16_000))
        expect(svc.getShopifyOverview.mock.calls.length).toBe(llamadas)
        expect(screen.getByRole('button', { name: 'status.resync' })).toBeDisabled()
        if (o.connection?.importacion.error === 'FALTA_PERMISO') expect(screen.getByText('status.resyncBlocked')).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it('el resumen falla sin datos: error con «Reintentar» y nada más', async () => {
    svc.getShopifyOverview.mockRejectedValue(errorHttp(500, {}))
    renderPage()
    expect(await screen.findByText('errors.loadError', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('connect.domainPlaceholder')).toBeNull()
  })

  it('🔴 el resumen con datos y luego una actualización fallida: lo dice sin quitar lo que se ve (N4)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    const { client } = renderPage()
    expect(await screen.findByText('status.store')).toBeInTheDocument()
    svc.getShopifyOverview.mockRejectedValue(errorHttp(500, {}))
    await act(() => client.invalidateQueries({ queryKey: ['shopify', 'v1', 'overview'] }))
    expect(await screen.findByText('page.staleOverview', {}, ESPERA_REINTENTO)).toBeInTheDocument()
    expect(screen.getByText('status.store')).toBeInTheDocument()
  })

  it('🔴 al cambiar de sucursal nunca se ven filas de la otra, ni con las dos en caché (N12)', async () => {
    svc.getShopifyOverview.mockImplementation(async () => resumen(conexion()))
    const REV_V2 = { ...REVISION, id: 'r2', product: { id: 'p2', name: 'Gorra · Única', sku: 'GOR' } }
    let soltarV2: (v: unknown) => void = () => {}
    svc.listShopifyReviews.mockImplementation((venueId: string) =>
      venueId === 'v1' ? Promise.resolve(pagina([REVISION])) : new Promise(r => (soltarV2 = r)),
    )
    const v = renderPage()
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    // La sucursal 2 ya tiene su resumen en caché (lo peor: la página no pasa por «cargando»).
    v.client.setQueryData(['shopify', 'v2', 'overview'], resumen(conexion()))
    venue.id = 'v2'
    v.rerender(v.tree())
    await waitFor(() => expect(svc.listShopifyReviews).toHaveBeenCalledWith('v2', expect.anything()))
    expect(screen.queryByText('Camisa · M')).toBeNull()
    await act(async () => soltarV2(pagina([REV_V2])))
    expect(await screen.findByText('Gorra · Única')).toBeInTheDocument()
    venue.id = 'v1' // las dos ya en caché
    v.rerender(v.tree())
    expect(await screen.findByText('Camisa · M')).toBeInTheDocument()
    expect(screen.queryByText('Gorra · Única')).toBeNull()
  })
})

describe('ShopifyIntegration — tienda conectada con su app (5a)', () => {
  const deLaTienda = (o: Partial<ShopifyConnection> = {}) => conexion({ metodo: 'APP_DEL_COMERCIO', clientIdTerminacion: 'abcd', ...o })
  const LLAVES = { shopDomain: 'mi-tienda.myshopify.com', clientId: 'cid_123', clientSecret: 'shpss_secreto' }

  it('🔴 dice «Conectada con la app de tu tienda (…abcd)» y «Cambiar llaves» abre el bloque con el dominio fijo; al guardar avisa, relee y no va a Shopify', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda()))
    svc.connectShopifyOwnApp.mockResolvedValue({ reautorizada: true })
    renderPage()
    expect(await screen.findByText('status.metodoComercio abcd')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.cambiarLlaves' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    await waitFor(() => expect(svc.connectShopifyOwnApp).toHaveBeenCalledWith('v1', 'REAUTHORIZE', LLAVES))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'connect.reauthorized' }))
    await waitFor(() => expect(screen.queryByText('connect.appPropia.title')).toBeNull())
    expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('«Cambiar llaves» se apaga mientras el bloque está abierto (un bloque a la vez); «Cancelar» lo cierra y lo vuelve a habilitar sin pedir nada', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda()))
    renderPage()
    const cambiar = await screen.findByRole('button', { name: 'status.cambiarLlaves' })
    expect(cambiar).toBeEnabled()
    await userEvent.click(cambiar)
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'status.cambiarLlaves' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.cancel' }))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
    expect(screen.getByRole('button', { name: 'status.cambiarLlaves' })).toBeEnabled()
    expect(svc.connectShopifyOwnApp).not.toHaveBeenCalled()
  })

  it('🔴 REVOCADA: «Reconectar» abre el mismo bloque (REAUTHORIZE) y no va a Shopify por OAuth; al guardar las llaves avisa, relee y cierra el bloque', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ estado: 'REVOCADA' })))
    svc.connectShopifyOwnApp.mockResolvedValue({ reautorizada: true })
    renderPage()
    expect(await screen.findByText('status.revoked')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.reconnect' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    // El dominio sale de la conexión (no se teclea) y el propósito es REAUTHORIZE, no CONNECT.
    await waitFor(() => expect(svc.connectShopifyOwnApp).toHaveBeenCalledWith('v1', 'REAUTHORIZE', LLAVES))
    expect(svc.connectShopifyOwnApp).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'connect.reauthorized' }))
    await waitFor(() => expect(screen.queryByText('connect.appPropia.title')).toBeNull())
    expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('🔴 fix final (I3a): «Reconectar» abre el bloque con el foco en el Client ID y lo trae a la vista', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ estado: 'REVOCADA' })))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.reconnect' }))
    const clientId = await screen.findByLabelText('connect.appPropia.clientIdLabel')
    expect(clientId).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(scrollIntoView.mock.contexts).toContain(clientId)
  })

  it('🔴 fix final (I3b): con el bloque abierto se apagan los botones que lo abren («Reconectar» y «Volver a dar permiso»); «Cancelar» los vuelve a habilitar', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ estado: 'REVOCADA' })))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.reconnect' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'status.reconnect' })).toBeDisabled()
    for (const b of screen.getAllByRole('button', { name: 'avisos.reauthorize' })) expect(b).toBeDisabled()
    expect(screen.getByRole('button', { name: 'status.cambiarLlaves' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.cancel' }))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
    expect(screen.getByRole('button', { name: 'status.reconnect' })).toBeEnabled()
    for (const b of screen.getAllByRole('button', { name: 'avisos.reauthorize' })) expect(b).toBeEnabled()
  })

  it('🔴 fix final (I3b): marca FALTA_PERMISO en una tienda activa con su app: con el bloque abierto, los dos «Volver a dar permiso» se apagan', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ importacion: { variantes: 120, error: 'FALTA_PERMISO' } })))
    renderPage()
    expect(await screen.findByText('connect.importErrors.FALTA_PERMISO')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'avisos.reauthorize' })[0])
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    const botones = screen.getAllByRole('button', { name: 'avisos.reauthorize' })
    expect(botones).toHaveLength(2)
    for (const b of botones) expect(b).toBeDisabled()
  })

  it('REVOCADA y el server rechaza las llaves: lo dice, el bloque se queda abierto con el Client ID y no va a Shopify', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ estado: 'REVOCADA' })))
    svc.connectShopifyOwnApp.mockRejectedValue(errorHttp(422, { code: 'SHOPIFY_APP_SECRET_INVALIDO', message: 'malo' }))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.reconnect' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'errors.codes.SHOPIFY_APP_SECRET_INVALIDO' }))
    expect(screen.getByText('connect.appPropia.title')).toBeInTheDocument()
    expect(screen.getByLabelText('connect.appPropia.clientIdLabel')).toHaveValue('cid_123')
    expect(screen.getByLabelText('connect.appPropia.clientSecretLabel')).toHaveValue('')
    expect(toast).not.toHaveBeenCalledWith({ title: 'connect.reauthorized' })
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('la del piloto no cambia: sin la línea del método ni «Cambiar llaves»', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ metodo: 'PILOTO', clientIdTerminacion: null })))
    renderPage()
    expect(await screen.findByText('status.store')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'status.cambiarLlaves' })).toBeNull()
    expect(screen.queryByText(/status\.metodoComercio/)).toBeNull()
  })

  it('🔴 la del piloto, REVOCADA y con la marca `metodo: PILOTO`, sigue yendo a Shopify por OAuth al reconectar', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion({ metodo: 'PILOTO', clientIdTerminacion: null, estado: 'REVOCADA' })))
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=r' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'status.reconnect' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=r'))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
    expect(svc.connectShopifyOwnApp).not.toHaveBeenCalled()
  })

  it('sin `settings:manage`: «Cambiar llaves» se ve, deshabilitado', async () => {
    access.allowed = ['inventory:read']
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda()))
    renderPage()
    expect(await screen.findByRole('button', { name: 'status.cambiarLlaves' })).toBeDisabled()
  })

  it('🔴 marca permanente FALTA_PERMISO en una tienda ya activa con su app: el «Volver a dar permiso» de la alerta y el de los avisos abren el bloque (REAUTHORIZE), no OAuth', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(deLaTienda({ importacion: { variantes: 120, error: 'FALTA_PERMISO' } })))
    svc.connectShopifyOwnApp.mockResolvedValue({ reautorizada: true })
    renderPage()
    expect(await screen.findByText('connect.importErrors.FALTA_PERMISO')).toBeInTheDocument()
    // [0] = la alerta de la marca permanente, [1] = el de la lista de avisos.
    const botones = screen.getAllByRole('button', { name: 'avisos.reauthorize' })
    expect(botones).toHaveLength(2)
    await userEvent.click(botones[0])
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.cancel' }))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
    await userEvent.click(screen.getAllByRole('button', { name: 'avisos.reauthorize' })[1])
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    await waitFor(() => expect(svc.connectShopifyOwnApp).toHaveBeenCalledWith('v1', 'REAUTHORIZE', LLAVES))
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('🔴 ruling P2-5: la importación se detuvo por un permiso en una tienda con su app: «Volver a dar permiso» abre el bloque de llaves (REAUTHORIZE, el dominio de la tienda), no OAuth', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(deLaTienda({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 10, error: 'FALTA_PERMISO' } })),
    )
    svc.connectShopifyOwnApp.mockResolvedValue({ reautorizada: true })
    renderPage()
    expect(await screen.findByText('connect.importErrors.FALTA_PERMISO')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'avisos.reauthorize' }))
    expect(await screen.findByText('connect.appPropia.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'avisos.reauthorize' })).toBeDisabled() // un bloque a la vez
    // Fix final (I3c): el bloque de llaves va DESPUÉS de la alerta, no dentro: un lector de pantalla no lee el formulario como alerta.
    expect(screen.getByText('connect.appPropia.title').closest('[role="alert"]')).toBeNull()
    expect(screen.getByLabelText('connect.appPropia.clientIdLabel').closest('[role="alert"]')).toBeNull()
    expect(screen.getByText('connect.importStopped').closest('[role="alert"]')).not.toBeNull()
    await llenarLlaves()
    await userEvent.click(screen.getByRole('button', { name: 'connect.appPropia.submit' }))
    await waitFor(() => expect(svc.connectShopifyOwnApp).toHaveBeenCalledWith('v1', 'REAUTHORIZE', LLAVES))
    // Éxito (`onListo`): avisa, relee el resumen y cierra el bloque; «Volver a dar permiso» vuelve a estar disponible.
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'connect.reauthorized' }))
    await waitFor(() => expect(screen.queryByText('connect.appPropia.title')).toBeNull())
    expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: 'avisos.reauthorize' })).toBeEnabled()
    expect(svc.reauthorizeShopify).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('la importación detenida de la del piloto: «Volver a dar permiso» sigue yendo a Shopify por `navegar`', async () => {
    svc.getShopifyOverview.mockResolvedValue(
      resumen(conexion({ fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 10, error: 'FALTA_PERMISO' } })),
    )
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=i' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'avisos.reauthorize' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('https://mi-tienda.myshopify.com/admin/oauth/authorize?state=i'))
    expect(screen.queryByText('connect.appPropia.title')).toBeNull()
  })
})
