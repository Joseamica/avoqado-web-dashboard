/**
 * Custodia de SIMs — las tres pruebas que la regla `testing-and-git.md` volvió obligatorias
 * tras el incidente del 2026-09-02 (un supervisor de PlayTelecom perdió una hora de operación).
 *
 * Las tres cazan defectos que compilan, pasan el typecheck y devuelven 200 en el servidor:
 *
 *   1. Escribir y VER el resultado — una invalidación de caché mal dirigida es SILENCIOSA.
 *      Ese día el SIM se asignaba de verdad y la lista seguía diciendo «Con Supervisor»;
 *      el supervisor reintentaba y el 2º intento sí fallaba.
 *   2. Teclear conserva el foco — con la búsqueda en la queryKey y un `if (isLoading) return`
 *      encima del buscador, cada dígito desmonta el <Input> y Android cierra el teclado.
 *   3. Vacío y error se distinguen — una lista vacía por fallo de red que se ve igual que
 *      «no hay nada» es un reporte falso al usuario.
 */
import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, PLAYTELECOM_VENUE_ALPHA } from '../../fixtures/mock-data'

test.setTimeout(90_000)
test.use({ viewport: { width: 1280, height: 900 } })

const ICCID = '8952140064247085146F'

/**
 * El tab de Custodia sólo existe para quien puede mover SIMs (`canSeeCustody` en
 * StockControl.tsx) — el venue base de PlayTelecom no trae esos permisos.
 */
const VENUE_SUPERVISOR = {
  ...PLAYTELECOM_VENUE_ALPHA,
  permissions: [
    ...PLAYTELECOM_VENUE_ALPHA.permissions,
    'sim-custody:assign-to-promoter',
    'sim-custody:collect-from-promoter',
  ],
}

const esCustodia = (url: URL) => url.pathname.includes('/api/') && url.pathname.includes('/stock-control/custody')

const pagina = (custodyState: string) => ({
  summary: { total: 1, almacen: 0, pendientes: 0, aceptados: 1, rechazados: 0, vendidos: 0, estancados: 0 },
  promoterRanking: [],
  items: [
    {
      id: 'sim-1',
      serialNumber: ICCID,
      status: 'AVAILABLE',
      custodyState,
      categoryName: 'SIM de Caja Vinculado',
      createdAt: '2026-08-31T16:36:00.000Z',
    },
  ],
  pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
})

/**
 * Lo mínimo para que la página de Stock monte sin reventar. `getStockMovements` devuelve
 * `response.data.data` y el infinite query lee `lastPage.pagination`: si el catch-all responde
 * un objeto vacío, `lastPage` queda undefined y la página entera cae al error boundary.
 */
async function mocksDeLaPagina(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/movements'),
    route => route.fulfill(json({ data: { movements: [], pagination: { page: 1, limit: 100, hasMore: false } } })),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/metrics'),
    route => route.fulfill(json({ data: { totalPieces: 0, totalValue: 0, availablePieces: 0, soldToday: 0, soldThisWeek: 0 } })),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/responsibles'),
    route => route.fulfill(json({ data: { adminHeld: { simsCount: 0 }, supervisors: [], promoters: [] } })),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/categories'),
    route => route.fulfill(json({ data: { categories: [] } })),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/alerts'),
    route => route.fulfill(json({ data: { alerts: [] } })),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/promoters'),
    route =>
      route.fulfill(
        json({
          data: [
            {
              id: 'promotor-1',
              firstName: 'Carlos Vicente',
              lastName: 'Díaz Cabañas',
              email: 'carlos@bait.mx',
              phone: null,
              employeeCode: 'BESDICC9701',
              venues: [],
            },
          ],
        }),
      ),
  )
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/stock/chart'),
    route => route.fulfill(json({ data: { points: [] } })),
  )
}

/**
 * La página de Stock carga su contenido con `lazyWithRetry` + Suspense: `main` puede estar
 * visible mientras el chunk sigue en «Loading…». Se espera al tab, no al contenedor.
 * El tab es i18n: en el arnés E2E el idioma es inglés («SIM Custody»).
 */
async function abrirCustodia(page: Page) {
  const tab = page.getByRole('button', { name: /Custodia de SIMs|SIM Custody/i })
  await tab.waitFor({ state: 'visible', timeout: 45_000 })
  await tab.click()
  // El panel de devtools de React Query se ancla abajo y tapa los controles del panel de
  // custodia — mismo estorbo que ya esquivan las pruebas de inventario de este repo.
  await page.evaluate(() => {
    const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
    for (const sel of ['.tsqd-parent-container', '.tsqd-open-btn-container', '[aria-label="Open React Query Devtools"]']) {
      const el = q(sel)
      if (el) el.style.display = 'none'
    }
  })
}

/** Monta la vista de custodia y devuelve un contador de llamadas al endpoint de la lista. */
async function montarCustodia(page: Page, opciones: { estadoTrasAsignar?: string } = {}) {
  const llamadas = { n: 0, asignaciones: 0 }
  let custodia = pagina('SUPERVISOR_HELD')

  await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [VENUE_SUPERVISOR] })
  await mocksDeLaPagina(page)

  await page.route(esCustodia, route => {
    llamadas.n += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: custodia }) })
  })

  // Asignar responde 200 y, como en producción, el SIM cambia de custodia del lado del servidor.
  await page.route(
    url => url.pathname.includes('/api/') && url.pathname.includes('/sim-custody/assign-to-promoter'),
    route => {
      llamadas.asignaciones += 1
      custodia = pagina(opciones.estadoTrasAsignar ?? 'PROMOTER_PENDING')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        // `assignSimsToPromoter` devuelve el cuerpo COMPLETO (`return data`), no `data.data`.
        body: JSON.stringify({ summary: { succeeded: 1, failed: 0 }, results: [] }),
      })
    },
  )

  await page.goto(`/venues/${VENUE_SUPERVISOR.slug}/playtelecom/stock`)
  await abrirCustodia(page)
  await expect(page.getByText('Mis SIMs')).toBeVisible({ timeout: 20_000 })
  return llamadas
}

test.describe('Custodia de SIMs — supervisor de PlayTelecom', () => {
  test('asignar un SIM refresca la lista sin recargar la página', async ({ page }) => {
    const llamadas = await montarCustodia(page)
    const antes = llamadas.n
    expect(antes).toBeGreaterThan(0)

    // El flujo real: seleccionar el SIM → abrir el diálogo → elegir promotor → confirmar.
    // Saltarse el promotor deja la mutación sin disparar y la prueba pasa por el motivo
    // equivocado (así fallaba esta misma prueba mientras se escribía).
    await page.getByRole('checkbox', { name: new RegExp(`Seleccionar ${ICCID}`) }).check()
    await page.getByRole('button', { name: /Asignar a Promotor/i }).click()
    await page.getByPlaceholder(/Buscar por nombre o email/i).fill('Carlos')
    await page.getByRole('option', { name: /Carlos Vicente Díaz Cabañas/i }).click()
    await page.getByRole('button', { name: /^Asignar$/ }).click()

    // Primero: la mutación SÍ se disparó. Se cuenta la llamada en vez de mirar el toast,
    // que se auto-oculta y hacía intermitente esta prueba.
    await expect.poll(() => llamadas.asignaciones, { timeout: 15_000 }).toBe(1)

    // 🔴 El toast NO es la prueba: ese día también salió verde. La prueba es que la lista
    // se vuelva a pedir — si la mutación invalida una clave que nadie lee, esto no ocurre
    // y el supervisor ve el SIM en su estado viejo, reintenta, y el 2º intento falla.
    await expect.poll(() => llamadas.n, { timeout: 10_000 }).toBeGreaterThan(antes)
  })

  test('teclear en el buscador conserva el foco y el texto', async ({ page }) => {
    await montarCustodia(page)
    const buscador = page.getByPlaceholder(/Buscar por últimos dígitos/i)

    await buscador.click()
    await buscador.pressSequentially('0851', { delay: 120 })

    // Sin `placeholderData: keepPreviousData`, cada dígito estrena queryKey, el panel entra en
    // su early return por isLoading y desmonta este mismo <Input>: en Android cierra el teclado.
    await expect(buscador).toBeFocused()
    await expect(buscador).toHaveValue('0851')
    await expect(page.getByText('Cargando custodia…')).toHaveCount(0)
  })

  test('un fallo de red se distingue de una lista vacía', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [VENUE_SUPERVISOR] })
    await mocksDeLaPagina(page)
    await page.route(esCustodia, route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))

    await page.goto(`/venues/${VENUE_SUPERVISOR.slug}/playtelecom/stock`)
    await abrirCustodia(page)

    // Decir «no tienes SIMs» cuando en realidad se cayó la red es mentirle al usuario.
    await expect(page.getByText(/No pudimos cargar tus SIMs/i)).toBeVisible({ timeout: 20_000 })
  })
})
