/**
 * Celulares de promotores (org WL) — las tres pruebas que la regla `testing-and-git.md` volvió obligatorias:
 *
 *   1. Escribir y VER el resultado: «Desvincular» cambia la fila sin recargar la página.
 *   2. Teclear conserva el foco: la búsqueda no desmonta su <Input> en cada tecla.
 *   3. Vacío, sin resultados y error se ven distintos.
 *
 * Backend mockeado (el SERVIDOR con estas rutas aún no corre):
 *   GET  /api/v1/dashboard/organizations/:orgId/celulares-de-campo
 *   POST /api/v1/dashboard/organizations/:orgId/celulares-de-campo/:celularId/desvincular
 */
import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(90_000)
test.use({ viewport: { width: 1280, height: 900 } })

const ORG = 'org-playtelecom-celulares-001'

const json = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) })

const promotora = (estado: 'ACTIVO' | 'SIN_CELULAR') => ({
  staffId: 's1',
  nombre: 'Carla Activa',
  telefono: '5512345678',
  sucursales: [{ venueId: 'v1', staffVenueId: 'sv1', nombre: 'BAE PAPAGAYO', tienePin: true }],
  estado,
  codigo: null,
  celular:
    estado === 'ACTIVO'
      ? {
          id: 'cel1',
          marca: 'Samsung',
          modelo: 'A15',
          versionApp: '1.0.0',
          activadoAt: '2026-11-01T12:00:00.000Z',
          vistoAt: new Date().toISOString(),
          porSubir: 0,
        }
      : null,
  ultimaChecada: null,
  porRevisar: 0,
})

const lista = (items: unknown[]) => ({
  success: true,
  data: {
    disponible: true,
    items,
    total: items.length,
    conteos: { SIN_CELULAR: 0, CODIGO_SIN_USAR: 0, ACTIVO: items.length },
    porRevisar: 0,
  },
})

type Lectura = (url: URL) => { status: number; body: unknown }

/** Monta la organización (OWNER, marca blanca) y le da a la pantalla la `lectura` que se pida. */
async function montar(page: Page, lectura: Lectura, onDesvincular?: () => void) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'es')
    } catch {
      /* ignore */
    }
  })

  const venue = createMockVenue({
    id: 'v1',
    name: 'BAE PAPAGAYO',
    slug: 'bae-papagayo',
    organizationId: ORG,
    organization: { id: ORG, name: 'PlayTelecom Celulares' },
    modules: [
      { module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
      { module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label Dashboard' }, enabled: true },
    ],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  // Rutas LIFO: el catch-all va primero.
  await page.route('**/api/v1/**', route => route.fulfill(json({})))
  await page.route(`**/api/v1/organizations/${ORG}/stats`, route =>
    route.fulfill(json({ id: ORG, name: 'PlayTelecom Celulares', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/organizations/${ORG}/venues`, route => route.fulfill(json([venueWithRole])))
  await page.route('**/api/v1/notifications*', route => route.fulfill(json({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } })))
  await page.route('**/api/v1/dashboard/venues/*/role-config', route => route.fulfill(json(DEFAULT_ROLE_CONFIGS)))
  await page.route('**/api/v1/me/access*', route =>
    route.fulfill(
      json({
        userId: user.id,
        venueId: venueWithRole.id,
        organizationId: ORG,
        role: StaffRole.OWNER,
        corePermissions: venueWithRole.permissions,
        whiteLabelEnabled: true,
        enabledFeatures: [],
        featureAccess: {},
      }),
    ),
  )

  await page.route(`**/api/v1/dashboard/organizations/${ORG}/celulares-de-campo**`, route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST' && url.pathname.endsWith('/desvincular')) {
      onDesvincular?.()
      return route.fulfill(
        json({ success: true, data: { desvinculadoAt: new Date().toISOString(), graciaHasta: new Date().toISOString(), porSubir: 0, huellasReportadas: 0, yaEstaba: false } }),
      )
    }
    const { status, body } = lectura(url)
    return route.fulfill(json(body, status))
  })

  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))

  await page.goto(`/wl/organizations/${ORG}/celulares-de-promotores`)
  // El panel de devtools de React Query se ancla abajo y tapa controles.
  await page.addStyleTag({ content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }` })
}

test.describe('Celulares de promotores — organización', () => {
  test('desvincular cambia la fila sin recargar la página', async ({ page }) => {
    let desvinculado = false
    await montar(
      page,
      () => ({ status: 200, body: lista([promotora(desvinculado ? 'SIN_CELULAR' : 'ACTIVO')]) }),
      () => {
        desvinculado = true
      },
    )

    const fila = page.getByRole('row', { name: /Carla Activa/ })
    await expect(fila.getByText('Activado · Samsung A15')).toBeVisible({ timeout: 20_000 })
    // Si la página se recarga, esta marca desaparece.
    await page.evaluate(() => ((window as unknown as { __sinRecargar: boolean }).__sinRecargar = true))

    await fila.getByRole('button', { name: 'Desvincular' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desvincular' }).click()

    // 🔴 La prueba es la fila, no el toast: una invalidación mal dirigida deja «Activado» a la vista.
    await expect(fila.getByText('Sin celular')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Activado · Samsung A15')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true)
  })

  test('teclear en el buscador conserva el foco y el texto', async ({ page }) => {
    await montar(page, () => ({ status: 200, body: lista([promotora('ACTIVO')]) }))
    await expect(page.getByText('Carla Activa')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Buscar promotor' }).click()
    const buscador = page.getByPlaceholder('Buscar promotor')
    await buscador.pressSequentially('Car', { delay: 150 })

    await expect(buscador).toBeFocused()
    await expect(buscador).toHaveValue('Car')
  })

  test('vacío, sin resultados y error se ven distintos', async ({ page }) => {
    // Sin resultados: la lista trae gente, pero la búsqueda no encuentra a nadie.
    await montar(page, url => ({
      status: 200,
      body: url.searchParams.get('q') ? lista([]) : lista([promotora('ACTIVO')]),
    }))
    await expect(page.getByText('Carla Activa')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Buscar promotor' }).click()
    await page.getByPlaceholder('Buscar promotor').fill('zzz')
    await expect(page.getByText('Nadie coincide con los filtros')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Todavía no hay promotores')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('vacío de verdad: sin promotores y sin filtros', async ({ page }) => {
    await montar(page, () => ({ status: 200, body: lista([]) }))
    await expect(page.getByText('Todavía no hay promotores')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Nadie coincide con los filtros')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('un fallo del servidor no se disfraza de «no hay promotores»', async ({ page }) => {
    await montar(page, () => ({ status: 500, body: {} }))
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar esta información', { timeout: 20_000 })
    await expect(page.getByText('Todavía no hay promotores')).toHaveCount(0)
    await expect(page.getByText('Nadie coincide con los filtros')).toHaveCount(0)
  })
})
