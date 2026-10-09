import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SHOPIFY_ENVIOS, type ShopifyConnection, type ShopifyOverview, type ShopifyReview } from '@/types/shopify'

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
// Las 13 llamadas del servicio se mockean; lo demás (`explicarErrorShopify`, `textoDeErrorShopify`) es el REAL de C7: así los textos
// y las acciones de los errores salen del mapa de verdad y no de uno inventado por la prueba (requisito 2 de C7 → C8).
const svc = vi.hoisted(() => ({
  getShopifyOverview: vi.fn(),
  startShopifyConnect: vi.fn(),
  reauthorizeShopify: vi.fn(),
  getShopifyLocations: vi.fn(),
  confirmShopifyConnect: vi.fn(),
  getShopifyConnectReview: vi.fn(),
  applyShopifyConnect: vi.fn(),
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
})

describe('ShopifyIntegration — «Por revisar»', () => {
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

  it('explica los siete avisos de la campanita y deja volver a dar permiso (FALTA_PERMISO)', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    svc.reauthorizeShopify.mockResolvedValue({ url: 'https://mi-tienda.myshopify.com/admin/oauth/authorize?state=p' })
    renderPage()
    expect(await screen.findByText('avisos.title')).toBeInTheDocument()
    for (const aviso of ['REVOCADA', 'ATORADOS', 'RETRASO', 'SOBREVENTA', 'POR_REVISAR', 'FALTA_PERMISO', 'CONTEO_NO_APLICADO']) {
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
