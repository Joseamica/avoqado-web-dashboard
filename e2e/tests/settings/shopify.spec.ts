/**
 * E2E — Conector Shopify (plan C, C9). Las tres pruebas obligatorias del repo (testing-and-git.md):
 *   1. escribir y VER el resultado: resolver una diferencia la quita de «Por revisar» SIN recargar;
 *   2. teclear en el buscador (va al servidor) conserva el foco;
 *   3. vacío, sin resultados y error se distinguen.
 * Más lo que jsdom no prueba de verdad: el cuadre diferido (sondeo del resumen y refresco de la lista al terminar), el
 * 409 con números nuevos, la elección en camino que sobrevive a recargar y se pone al día sola, el panel del piloto para
 * un Premium COMERCIAL sin la función (sin promesa de compra) y la tarjeta de Integraciones.
 * Locale E2E: inglés (fallback 'en'). Corre contra el dev server PROPIO del worktree (E2E_BASE_URL), nunca el :5173.
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'
import { planTierShopify } from '../../fixtures/shopify-plan-tier'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const PAGE = '/venues/venue-alpha/settings/integrations/shopify'
const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Tienda Alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'settings:read', 'settings:manage', 'inventory:read', 'inventory:adjust'],
})
const CONTEOS = { emparejados: 118, pendientes: 0, atorados: 0, inciertos: 0, porRevisar: 1, sinPareja: 0 }
const conexion = (cuadre = { pendiente: false, ultimo: '2026-10-08T12:00:00.000Z' as string | null }) => ({
  fase: 'ACTIVE',
  pausedFrom: null,
  estado: 'ACTIVA',
  shopDomain: 'mi-tienda.myshopify.com',
  locationName: 'Tienda México',
  importacion: { variantes: 120, error: null },
  aplicacion: null,
  conteos: CONTEOS,
  retrasoMin: null,
  cuadre,
})
const OVERVIEW = { planActive: true, connection: conexion() }
const SIN_CONEXION = { planActive: true, connection: null }
const pagina = (items: unknown[], total = items.length) => ({ items, total, nextOffset: null })
const VACIA = pagina([])
const REVISION = {
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
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const fallo = (status: number, code?: string) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ message: 'error', code }),
})

type Respuesta = { status: 200; data: unknown } | { status: number; code?: string }
interface MockShopify {
  overview: () => unknown
  reviews?: (q: string) => unknown | number // número = status de error
  resolve?: (body: unknown) => Respuesta
  resync?: () => void
  envios?: (ids: string[]) => unknown // el sondeo acotado de las elecciones en camino (R2-4)
}

/** Rutas del conector, registradas DESPUÉS de setupApiMocks para ganar (Playwright es LIFO). */
async function mockShopify(page: Page, m: MockShopify) {
  const base = '**/api/v1/dashboard/venues/*/shopify'
  await page.route(base, route => route.fulfill(ok(m.overview())))
  await page.route(`${base}/issues?*`, route => route.fulfill(ok(VACIA)))
  await page.route(`${base}/reviews?*`, route => {
    const r = (m.reviews ?? (() => VACIA))(new URL(route.request().url()).searchParams.get('q') ?? '')
    return route.fulfill(typeof r === 'number' ? fallo(r) : ok(r))
  })
  await page.route(`${base}/reviews/envios?*`, route => {
    const ids = (new URL(route.request().url()).searchParams.get('ids') ?? '').split(',').filter(Boolean)
    return route.fulfill(ok(m.envios ? m.envios(ids) : { items: [] }))
  })
  await page.route(`${base}/reviews/*/resolve`, route => {
    const r = m.resolve!(route.request().postDataJSON())
    return route.fulfill(r.status === 200 && 'data' in r ? ok(r.data) : fallo(r.status, 'code' in r ? r.code : undefined))
  })
  await page.route(`${base}/resync`, route => {
    m.resync?.()
    return route.fulfill(ok({ programado: true }))
  })
}

/** El acceso efectivo del server (accessSchemaVersion 1, con `accessObservedAt`): la MISMA respuesta que la unitaria pasa
 *  por el parser real (Codex R2-3). */
async function planTier(page: Page, granted: string[]) {
  await page.route('**/api/v1/dashboard/venues/*/plan-tier', route => route.fulfill(ok(planTierShopify(granted))))
}

async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) document.head.appendChild(style)
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
}

async function preparar(page: Page, m: MockShopify, granted: string[] = ['SHOPIFY_INTEGRATION']) {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
  await planTier(page, granted)
  await mockShopify(page, m)
  await hideDevtools(page)
}

const filaCamisa = (page: Page) => page.locator('[data-tour="shopify-review-item"]').filter({ hasText: 'Camisa · M' })

test.describe('Shopify — «Por revisar»', () => {
  test('resolver con el número de Shopify quita la fila SIN recargar y manda lo que se vio', async ({ page }) => {
    let resuelto = false
    const posts: unknown[] = []
    await preparar(page, {
      overview: () => OVERVIEW,
      reviews: () => (resuelto ? VACIA : pagina([REVISION])),
      resolve: body => {
        posts.push(body)
        resuelto = true
        return { status: 200, data: { estado: 'RESUELTO' } }
      },
    })
    await page.goto(PAGE)
    await expect(filaCamisa(page)).toBeVisible({ timeout: 15_000 })
    await filaCamisa(page).getByRole('button', { name: "Use Shopify's" }).click()
    // 🔴 la prueba no es el aviso: la fila se va y la lista dice que todo cuadra, sin recargar
    await expect(filaCamisa(page)).toHaveCount(0)
    await expect(page.getByText('Everything matches Shopify.')).toBeVisible()
    expect(posts).toEqual([{ choice: 'SHOPIFY', expectedAvoqadoQty: '5', expectedShopifyQty: 4 }])
  })

  test('el buscador va al servidor, conserva el foco y distingue «sin resultados» de «todo cuadra»', async ({ page }) => {
    const consultas: string[] = []
    await preparar(page, {
      overview: () => OVERVIEW,
      reviews: q => {
        consultas.push(q)
        return !q || 'camisa · m cam-m'.includes(q.toLowerCase()) ? pagina([REVISION]) : VACIA
      },
    })
    await page.goto(PAGE)
    await expect(filaCamisa(page)).toBeVisible({ timeout: 15_000 })
    const buscador = page.locator('[data-tour="shopify-reviews-search"]')
    await buscador.click()
    await buscador.pressSequentially('camisa', { delay: 60 })
    await expect(buscador).toBeFocused()
    await expect(buscador).toHaveValue('camisa')
    await expect.poll(() => consultas.at(-1)).toBe('camisa')
    await expect(filaCamisa(page)).toBeVisible()
    await buscador.fill('zzz')
    await expect(page.getByText('No product matches your search.')).toBeVisible()
    await expect(page.getByText('Everything matches Shopify.')).toHaveCount(0)
    await expect(buscador).toBeFocused()
  })

  test('la lista que falla dice que falló (nunca «todo cuadra») y «Retry» la recupera', async ({ page }) => {
    let cae = true
    await preparar(page, { overview: () => OVERVIEW, reviews: () => (cae ? 500 : pagina([REVISION])) })
    await page.goto(PAGE)
    const seccion = page.locator('[data-tour="shopify-reviews"]')
    await expect(seccion.getByText('We could not load «To review».')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Everything matches Shopify.')).toHaveCount(0)
    cae = false
    await seccion.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(filaCamisa(page)).toBeVisible()
  })

  test('vacía de verdad: «Everything matches Shopify.»', async ({ page }) => {
    await preparar(page, { overview: () => OVERVIEW })
    await page.goto(PAGE)
    await expect(page.getByText('Everything matches Shopify.')).toBeVisible({ timeout: 15_000 })
  })

  test('409 «cambió»: se ven los números NUEVOS y el segundo intento manda ésos', async ({ page }) => {
    let version = 0
    let resuelto = false
    const posts: unknown[] = []
    await preparar(page, {
      overview: () => OVERVIEW,
      reviews: () => (resuelto ? VACIA : pagina([version === 0 ? REVISION : { ...REVISION, avoqadoQty: '6', shopifyQty: 7 }])),
      resolve: body => {
        posts.push(body)
        if (posts.length === 1) {
          version = 1 // el server reescribió la revisión con lo vigente
          return { status: 409, code: 'SHOPIFY_REVISION_CAMBIO' }
        }
        resuelto = true
        return { status: 200, data: { estado: 'RESUELTO' } }
      },
    })
    await page.goto(PAGE)
    await filaCamisa(page).getByRole('button', { name: "Use Shopify's" }).click({ timeout: 15_000 })
    await expect(page.getByText(/the quantities changed while you were deciding/i).first()).toBeVisible()
    await expect(filaCamisa(page)).toContainText('Shopify: 7')
    await expect(filaCamisa(page)).toContainText('Avoqado: 6')
    await filaCamisa(page).getByRole('button', { name: "Use Shopify's" }).click()
    await expect(filaCamisa(page)).toHaveCount(0)
    expect(posts).toEqual([
      { choice: 'SHOPIFY', expectedAvoqadoQty: '5', expectedShopifyQty: 4 },
      { choice: 'SHOPIFY', expectedAvoqadoQty: '6', expectedShopifyQty: 7 },
    ])
  })

  test('la elección en camino sobrevive a recargar y se pone al día SOLA cuando llega a Shopify', async ({ page }) => {
    let estado: 'OPEN' | 'PENDIENTE' | 'ENVIADO' = 'OPEN'
    await preparar(page, {
      overview: () => OVERVIEW,
      reviews: () => pagina([estado === 'OPEN' ? REVISION : { ...REVISION, status: 'RESOLVED', choice: 'AVOQADO', envio: estado }]),
      resolve: () => {
        estado = 'PENDIENTE'
        return { status: 200, data: { estado: 'ENVIO_PENDIENTE' } }
      },
      // Lo que se sondea cada 5 s: sólo el estado de esas elecciones, nunca las páginas.
      envios: ids => ({ items: ids.map(id => ({ id, status: 'RESOLVED', choice: 'AVOQADO', envio: estado === 'OPEN' ? null : estado })) }),
    })
    await page.goto(PAGE)
    await filaCamisa(page).getByRole('button', { name: "Use Avoqado's" }).click({ timeout: 15_000 })
    const eleccion = page.locator('[data-tour="shopify-review-choice"]')
    await expect(eleccion).toContainText('You chose the Avoqado number.')
    await expect(eleccion).toContainText('Choice saved; it will be sent to Shopify.')
    await page.reload()
    // 🔴 lo dice el SERVER (el envío de esa revisión), no un estado de React que muere al recargar
    await expect(eleccion).toContainText('You chose the Avoqado number.', { timeout: 15_000 })
    await expect(eleccion.getByRole('button')).toHaveCount(0)
    estado = 'ENVIADO' // el mensajero ya lo mandó
    await expect(eleccion).toContainText('Done: your choice is now in Shopify.', { timeout: 12_000 })
  })
})

test.describe('Shopify — conexión y acceso', () => {
  test('«Reconcile now»: mientras corre lo dice; al terminar aparece la diferencia SIN recargar', async ({ page }) => {
    let cuadrando = false
    let resultado: unknown = VACIA
    await preparar(page, {
      overview: () => ({ planActive: true, connection: conexion({ pendiente: cuadrando, ultimo: null }) }),
      reviews: () => resultado,
      resync: () => {
        cuadrando = true
      },
    })
    await page.goto(PAGE)
    await expect(page.getByText('Everything matches Shopify.')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-tour="shopify-resync"]').click()
    await expect(page.getByText('Reconciliation in progress…')).toBeVisible()
    await expect(page.locator('[data-tour="shopify-resync"]')).toBeDisabled()
    resultado = pagina([REVISION])
    cuadrando = false // el worker terminó: el siguiente sondeo del resumen (5 s) ya no está pendiente
    await expect(filaCamisa(page)).toBeVisible({ timeout: 12_000 })
  })

  test('un Premium COMERCIAL sin la función ve «Shopify is in a pilot», sin formulario ni promesa de compra', async ({ page }) => {
    await preparar(page, { overview: () => SIN_CONEXION }, ['CHATBOT', 'CFDI', 'INVENTORY_TRACKING'])
    await page.goto(PAGE)
    const pagina_ = page.locator('[data-tour="shopify-integration-page"]')
    await expect(pagina_.getByText('Shopify is in a pilot')).toBeVisible({ timeout: 15_000 })
    await expect(pagina_.getByRole('link', { name: 'Write on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\//)
    await expect(page.locator('[data-tour="shopify-connect-domain"]')).toHaveCount(0)
    await expect(pagina_).not.toContainText(/premium/i)
  })

  test('la tarjeta de Integraciones dice «Pilot» y lleva a la página', async ({ page }) => {
    await preparar(page, { overview: () => SIN_CONEXION })
    await page.goto('/venues/venue-alpha/settings/integrations')
    const tarjeta = page.locator('[data-tour="integration-card-shopify"]')
    await expect(tarjeta).toContainText('Pilot', { timeout: 15_000 })
    await expect(tarjeta).not.toContainText(/premium/i)
    await tarjeta.getByRole('button').click()
    await page.waitForURL('**/venues/venue-alpha/settings/integrations/shopify')
    await expect(page.getByText('Connect your Shopify store')).toBeVisible()
  })
})

test.describe('Shopify — tarjeta con estado y entradas a la página', () => {
  // La tarjeta dice el estado real de la conexión (Conectada, En pausa, Detenida…) y nunca vende ni manda a subir de plan.
  const ESTADOS: Array<{ nombre: string; conexion: unknown; texto: string }> = [
    { nombre: 'conectada', conexion: conexion(), texto: 'Connected' },
    { nombre: 'en pausa', conexion: { ...conexion(), fase: 'PAUSED', pausedFrom: 'ACTIVE', estado: 'PAUSADA' }, texto: 'Paused' },
    { nombre: 'sin permiso en Shopify', conexion: { ...conexion(), estado: 'REVOCADA' }, texto: 'No Shopify permission' },
    {
      // detenida por un error permanente de la importación: su fase (IMPORTANDO) NO se pinta como avance
      nombre: 'detenida',
      conexion: { ...conexion(), fase: 'CONNECTING', estado: 'IMPORTANDO', importacion: { variantes: 10, error: 'FALTA_PERMISO' } },
      texto: 'The connection stopped',
    },
    {
      // 🔴 el server la deja en ACTIVA aunque un error permanente (FALTA_PERMISO) la tenga detenida: nada sincroniza, no es «Connected»
      nombre: 'activa pero detenida',
      conexion: { ...conexion(), importacion: { variantes: 120, error: 'FALTA_PERMISO' } },
      texto: 'The connection stopped',
    },
  ]
  for (const { nombre, conexion: c, texto } of ESTADOS) {
    test(`la tarjeta de una conexión ${nombre} dice «${texto}», sin «Pilot» ni oferta de plan`, async ({ page }) => {
      await preparar(page, { overview: () => ({ planActive: true, connection: c }) })
      await page.goto('/venues/venue-alpha/settings/integrations')
      const tarjeta = page.locator('[data-tour="integration-card-shopify"]')
      await expect(tarjeta).toContainText(texto, { timeout: 15_000 })
      if (texto !== 'Connected') await expect(tarjeta).not.toContainText('Connected')
      await expect(tarjeta).not.toContainText('Pilot')
      await expect(tarjeta).not.toContainText(/premium|upgrade|plan/i)
      await expect(tarjeta.getByRole('button', { name: 'Manage' })).toBeVisible()
    })
  }

  test('sin acceso al piloto la tarjeta SE VE y explica que es un piloto por invitación', async ({ page }) => {
    await preparar(page, { overview: () => ({ planActive: false, connection: null }) }, ['CHATBOT'])
    await page.goto('/venues/venue-alpha/settings/integrations')
    const tarjeta = page.locator('[data-tour="integration-card-shopify"]')
    await expect(tarjeta).toContainText('Pilot by invitation', { timeout: 15_000 })
    await expect(tarjeta).not.toContainText(/premium|upgrade/i)
    await tarjeta.getByRole('button').click()
    await expect(page.locator('[data-tour="shopify-integration-page"]').getByText('Shopify is in a pilot')).toBeVisible()
  })

  test('mientras el resumen carga la tarjeta no dice «Pilot» ni «Connect» (sería un estado falso); al llegar, dice la verdad', async ({
    page,
  }) => {
    await preparar(page, { overview: () => SIN_CONEXION })
    let liberar!: () => void
    const puerta = new Promise<void>(r => (liberar = r))
    // registrada DESPUÉS de `preparar` para ganar (LIFO): el resumen no contesta hasta que se libere
    await page.route('**/api/v1/dashboard/venues/*/shopify', async route => {
      await puerta
      await route.fulfill(ok(SIN_CONEXION))
    })
    await page.goto('/venues/venue-alpha/settings/integrations')
    const tarjeta = page.locator('[data-tour="integration-card-shopify"]')
    await expect(tarjeta).toBeVisible({ timeout: 15_000 })
    await expect(tarjeta).not.toContainText('Pilot')
    await expect(tarjeta.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0)
    await expect(tarjeta.getByRole('button', { name: 'Manage' })).toBeVisible()
    liberar()
    await expect(tarjeta).toContainText('Pilot by invitation')
    await expect(tarjeta.getByRole('button', { name: 'Connect', exact: true })).toBeVisible()
  })

  test('si el resumen falla la tarjeta dice que no pudo cargar el estado, no «Pilot» ni «Connect»', async ({ page }) => {
    await preparar(page, { overview: () => SIN_CONEXION })
    await page.route('**/api/v1/dashboard/venues/*/shopify', route => route.fulfill(fallo(500)))
    await page.goto('/venues/venue-alpha/settings/integrations')
    const tarjeta = page.locator('[data-tour="integration-card-shopify"]')
    await expect(tarjeta).toContainText('We could not load the status', { timeout: 15_000 })
    await expect(tarjeta).not.toContainText('Pilot')
    await expect(tarjeta).not.toContainText('Connected')
    await expect(tarjeta.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0)
    await expect(tarjeta.getByRole('button', { name: 'Manage' })).toBeVisible()
  })

  test('un MANAGER con inventory:read llega a la página por su URL (la ruta no pide ADMIN) y la ve en sólo lectura', async ({ page }) => {
    const gerente = createMockVenue({ ...VENUE, permissions: ['home:read', 'inventory:read'] })
    await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [gerente] })
    await planTier(page, ['SHOPIFY_INTEGRATION'])
    await mockShopify(page, { overview: () => OVERVIEW, reviews: () => pagina([REVISION]) })
    await hideDevtools(page)
    await page.goto(PAGE)
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`))
    await expect(filaCamisa(page)).toBeVisible({ timeout: 15_000 })
    await expect(filaCamisa(page).getByRole('button', { name: "Use Shopify's" })).toBeDisabled()
  })

  test('desde un conteo con una línea sin aplicar por duda, el enlace lleva a «Por revisar» (#por-revisar)', async ({ page }) => {
    await preparar(page, { overview: () => OVERVIEW, reviews: () => pagina([REVISION]) })
    const AHORA = '2026-10-08T12:00:00.000Z'
    await page.route('**/api/v1/dashboard/venues/*/inventory/stock-counts/count-1', route =>
      route.fulfill(
        ok({
          id: 'count-1',
          type: 'CYCLE',
          status: 'COMPLETED',
          note: null,
          createdAt: AHORA,
          completedAt: AHORA,
          cancelledAt: null,
          createdBy: 'Ana',
          itemCount: 1,
          summary: {
            itemCount: 1,
            countedCount: 1,
            matchedCount: 0,
            mismatchedCount: 1,
            differenceByUnit: [{ unit: 'PIECE', difference: -1 }],
          },
          totalDifference: -1,
          noAplicadas: 1,
          items: [
            {
              id: 'i1',
              productId: 'p1',
              productName: 'Camisa · M',
              sku: 'CAM-M',
              gtin: null,
              imageUrl: null,
              unit: null,
              expected: 5,
              counted: 4,
              difference: -1,
              countedAt: AHORA,
              shopifyHeld: { at: AHORA, motivo: 'DUDA_POR_REVISAR' },
            },
          ],
        }),
      ),
    )
    await page.goto('/venues/venue-alpha/inventory/stock-counts/count-1')
    await expect(page.getByText('1 line was not applied').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Go to Shopify «To review»' }).click()
    await expect(page).toHaveURL(new RegExp(`${PAGE}#por-revisar$`))
    await expect(filaCamisa(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#por-revisar')).toBeInViewport()
  })
})
