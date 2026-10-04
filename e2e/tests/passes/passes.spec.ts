/**
 * E2E — Conector de pases (Plan 2b). Las tres pruebas obligatorias del repo (testing-and-git.md):
 *   1. escribir y VER el resultado: confirmar un check-in lo quita de Pendientes sin recargar;
 *   2. teclear en un buscador conserva el foco — NO APLICA: estas pantallas no tienen búsqueda de texto al servidor
 *      (los filtros son píldoras y un <input type="month">); se cubre que cambiar de filtro no desmonta la lista;
 *   3. vacío, sin resultados y error se distinguen.
 * Más el gate de plan (Free ⇒ paywall), la pausa por el plan (Free con TotalPass conectado ⇒ aviso y Desconectar, R62; y sus
 * check-ins siguen visibles y confirmables, D1),
 * un MANAGER en sólo lectura (P2-12), las pantallas en claro y oscuro, y el indicador de pases
 * (boleto + «2/3») completo dentro del bloque de una clase de 60 min en el calendario, día y semana (R2b-33/34; jsdom no mide).
 * Locale E2E: inglés (fallback 'en'). Capturas en test-results/ (Playwright las borra al empezar la siguiente corrida).
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const RESERVATIONS_MODULE = [{ module: { id: 'mod-res', code: 'RESERVATIONS', name: 'Reservations' }, enabled: true }]
const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Estudio Alpha',
  slug: 'venue-alpha',
  permissions: [
    'home:read',
    'settings:read',
    'settings:update',
    'reservations:read',
    'reservations:create',
    'reservations:update',
    'reservations:manage-passes',
    'billing:subscriptions:read',
    'billing:subscriptions:manage',
  ],
  modules: RESERVATIONS_MODULE,
})
/** Un MANAGER: ve reservas (y por tanto la configuración de pases, en sólo lectura) pero NO configura (sin manage-passes). */
const MANAGER_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Estudio Alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'reservations:read', 'reservations:create', 'reservations:update'],
  modules: RESERVATIONS_MODULE,
})
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const FREE = { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false } as const

const TOTALPASS_ACTIVE = {
  provider: 'TOTALPASS',
  available: true,
  status: 'ACTIVE',
  externalPlaceName: 'Estudio Alpha Roma',
  confirmMode: 'AUTO',
  lastError: null,
  plans: [{ id: '305', name: 'Gold', code: 'ABCD' }],
  productLinks: [{ productId: 'p1', productName: 'Yoga', externalPlanId: '305', externalPlanName: 'Gold' }],
  updatedAt: '2026-10-01T00:00:00.000Z',
}
const WELLHUB_OFF = {
  provider: 'WELLHUB',
  available: false,
  status: null,
  externalPlaceName: null,
  confirmMode: 'AUTO',
  lastError: null,
  plans: [],
  productLinks: [],
  updatedAt: null,
}
const OVERVIEW = {
  planActive: true,
  connections: [TOTALPASS_ACTIVE, WELLHUB_OFF],
  classProducts: {
    items: [
      { id: 'p1', name: 'Yoga' },
      { id: 'p2', name: 'Pilates' },
    ],
    total: 2,
  },
}
/** R62 (pausa suave): perdió el plan con TotalPass conectado. Sin clases ligadas: con clases ligadas el server las desliga al
 * desconectar y pide volver a presionar (R65, 409 PASS_DISCONNECT_UNLINKING) — esa rama la cubre TotalPassCard.test. */
const OVERVIEW_PAUSED = { ...OVERVIEW, planActive: false, connections: [{ ...TOTALPASS_ACTIVE, productLinks: [] }, WELLHUB_OFF] }
/** Sin plan y sin nada vivo en TotalPass: un negocio que nunca conectó. */
const OVERVIEW_NO_PLAN = {
  ...OVERVIEW,
  planActive: false,
  connections: [{ ...TOTALPASS_ACTIVE, status: null, externalPlaceName: null, plans: [], productLinks: [], updatedAt: null }, WELLHUB_OFF],
}
const CAPACITY = {
  defaultMaxSpots: 3,
  weekly: [{ id: 'r1', weekday: 6, startMinute: 540, maxSpots: 1 }],
  suggestions: [{ weekday: 1, startMinute: 420, suggestedMaxSpots: 2, weeksOfData: 6, p75Occupancy: 9, capacity: 12, applied: false }],
}
const VISIT = {
  id: 'vis1',
  provider: 'TOTALPASS',
  status: 'PENDING',
  memberName: 'Ana López',
  startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  deadlineAt: new Date(Date.now() + 80 * 60_000).toISOString(),
  confirmedAt: null,
  confirmedBy: null,
  lastError: null,
  reservation: { id: 'r1', classSessionId: 's1', startsAt: new Date(Date.now() + 30 * 60_000).toISOString(), productName: 'Yoga' },
  canConfirm: true,
  canReject: true,
}
const SUMMARY = [
  { provider: 'TOTALPASS', confirmed: 12, alreadyConfirmed: 1, expired: 2, rejected: 0, pending: 1, lateCancellations: 1 },
  { provider: 'WELLHUB', confirmed: 0, alreadyConfirmed: 0, expired: 0, rejected: 0, pending: 0, lateCancellations: 0 },
]
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

type VisitsBehaviour = { pending: () => unknown[] }

/** Rutas de pases, registradas DESPUÉS de setupApiMocks para ganar (Playwright es LIFO). */
async function mockPasses(page: Page, visits: VisitsBehaviour, overview: unknown = OVERVIEW) {
  await page.route('**/api/v1/dashboard/venues/*/pass-integrations', route => route.fulfill(ok(overview)))
  await page.route('**/api/v1/dashboard/venues/*/pass-integrations/capacity', route => route.fulfill(ok(CAPACITY)))
  await page.route('**/api/v1/dashboard/venues/*/pass-integrations/visits/summary?*', route => route.fulfill(ok(SUMMARY)))
  await page.route('**/api/v1/dashboard/venues/*/pass-integrations/visits?*', route => {
    const url = new URL(route.request().url())
    // Con cualquier filtro (proveedor o fechas) no hay check-ins: es el caso «sin resultados con filtro».
    const filtered = url.searchParams.has('provider') || url.searchParams.has('from') || url.searchParams.has('to')
    const items = url.searchParams.get('status') === 'PENDING' && !filtered ? visits.pending() : []
    return route.fulfill(ok({ items, total: items.length, hasMore: false, nextOffset: null }))
  })
}

async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) document.head.appendChild(style)
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
}

async function darkMode(page: Page) {
  await page.evaluate(() => localStorage.setItem('vite-ui-theme', 'dark'))
  await page.reload()
}

test.describe('Pases — Integraciones (Pantalla A)', () => {
  test('con plan Pro: TotalPass conectada con su sucursal, modo y clases; Wellhub deshabilitada', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [VISIT] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    await expect(page.getByText('Estudio Alpha Roma')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('combobox').first()).toContainText(/automatic/i)
    await expect(page.getByText('Yoga', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^connect$/i })).toBeDisabled() // Wellhub
    await expect(page.getByText(/not enough data|we suggest/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/passes-integrations-light.png', fullPage: true })
    // la página vive en un contenedor con scroll propio (fullPage no lo abarca): segunda captura con los lugares para pases
    await page.locator('[data-tour="passes-capacity"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/passes-integrations-capacity-light.png' })
  })

  // R62: sin plan la vista general SÍ se pide (para saber si hay algo vivo que explicar); nada más
  test('sin plan (Free) y sin conexión: paywall «Included in Pro»; sólo se pide la vista general', async ({ page }) => {
    const calls: string[] = []
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockPasses(page, { pending: () => [] }, OVERVIEW_NO_PLAN)
    page.on('request', r => {
      if (r.url().includes('/pass-integrations')) calls.push(new URL(r.url()).pathname)
    })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()
    // el teaser (borroso) sale cuando la vista general ya llegó: a partir de aquí la lista de peticiones está completa
    await expect(page.getByText(/what this does/i)).toBeVisible()
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(p => p.endsWith('/pass-integrations'))).toBe(true)
  })

  // R62 (pausa suave): sin plan y con TotalPass conectado la página NO se esconde: aviso, mejorar el plan y Desconectar
  test('sin plan con TotalPass conectado: aviso de pausa y Desconectar, sin modo, clases ni lugares (claro y oscuro)', async ({ page }) => {
    const calls: string[] = []
    let disconnects = 0
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockPasses(page, { pending: () => [] }, OVERVIEW_PAUSED)
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/totalpass/disconnect', route => {
      disconnects += 1
      return route.fulfill(ok({ disconnected: true }))
    })
    page.on('request', r => {
      if (r.url().includes('/pass-integrations')) calls.push(new URL(r.url()).pathname)
    })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    await expect(page.getByText(/your plan no longer includes passes/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Estudio Alpha Roma')).toBeVisible()
    await expect(page.getByText(/included in pro/i)).toHaveCount(0)
    // R2b-6: el CTA de la pausa es el MISMO del paywall («Upgrade to Pro» para quien puede contratar), no «See all plans»
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible()
    await expect(page.getByText(/how attendance gets confirmed/i)).toHaveCount(0)
    await expect(page.getByText(/classes offered to totalpass/i)).toHaveCount(0)
    await expect(page.getByText(/spots for passes/i)).toHaveCount(0)
    expect(calls.every(p => p.endsWith('/pass-integrations'))).toBe(true)
    await page.screenshot({ path: 'test-results/passes-plan-paused-light.png', fullPage: true })
    await darkMode(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText(/your plan no longer includes passes/i)).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/passes-plan-paused-dark.png', fullPage: true })
    await page.getByRole('button', { name: /^disconnect$/i }).click()
    await page.getByRole('button', { name: /yes, disconnect/i }).click()
    await expect.poll(() => disconnects).toBe(1)
  })

  // R2b-39 (full-testing, Issue 1): con type=number, teclear «e» en un campo vacío no dispara onChange y Guardar mandaba
  // `maxSpots:null` (borraba la regla). jsdom no lo ve: sólo el navegador real. Se borra el tope y se teclea «e2».
  test('tope general: teclear «e» no se guarda como vacío; sólo los dígitos llegan al server', async ({ page }) => {
    const puts: unknown[] = []
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [] })
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/capacity/default', route => {
      puts.push(route.request().postDataJSON())
      return route.fulfill(ok({ saved: true }))
    })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    const input = page.locator('[data-tour="passes-default-cap"]')
    await expect(input).toHaveValue('3', { timeout: 15_000 })
    await input.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('e')
    await expect(input).toHaveValue('')
    await page.keyboard.type('2')
    await page.locator('[data-tour="passes-default-cap-save"]').click()
    // 🔴 la prueba: ningún PUT con `maxSpots:null`; llega el 2 que se ve
    await expect.poll(() => puts.length).toBe(1)
    expect(puts).toEqual([{ maxSpots: 2 }])
    await expect(input).toHaveValue('2')
  })

  // P2-12: la ruta es hermana de `integrations` y la protege reservations:read, no el rol ADMIN
  test('un MANAGER con reservations:read llega a la configuración en sólo lectura', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [MANAGER_VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    await expect(page.getByText('Estudio Alpha Roma')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/read only/i)).toBeVisible()
    await expect(page.getByRole('combobox').first()).toBeDisabled()
    await expect(page.getByRole('button', { name: /^disconnect$/i })).toBeDisabled()
  })

  test('modo oscuro: la pantalla se pinta con los tokens del tema', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [VISIT] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/integrations/pases')
    await expect(page.getByText('Estudio Alpha Roma')).toBeVisible({ timeout: 15_000 })
    await darkMode(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText('Estudio Alpha Roma')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/not enough data|we suggest/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/passes-integrations-dark.png', fullPage: true })
    await page.locator('[data-tour="passes-capacity"]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/passes-integrations-capacity-dark.png' })
  })
})

test.describe('Pases — Check-ins (Pantalla B)', () => {
  test('obligatoria 1: confirmar un pendiente lo quita de la lista SIN recargar', async ({ page }) => {
    let pending = [VISIT]
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => pending })
    let confirms = 0
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/visits/*/confirm', route => {
      confirms += 1
      pending = []
      return route.fulfill(ok({ ...VISIT, status: 'CONFIRMED', canConfirm: false, canReject: false }))
    })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/reservations/passes')
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/expires at/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/passes-visits-light.png', fullPage: true })
    await page.getByRole('button', { name: /^confirm$/i }).click()
    // 🔴 esto es la prueba, no el toast:
    await expect(page.getByText('Ana López')).toHaveCount(0)
    await expect(page.getByText(/no pending check-ins/i)).toBeVisible()
    expect(confirms).toBe(1)
  })

  // D1 (P1-1): sin el plan pero con TotalPass vivo, los check-ins que llegan siguen siendo cobrables: se ven y se confirman
  test('sin plan (Free) con TotalPass vivo: check-ins visibles, Confirmar habilitado y el aviso de la pausa', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockPasses(page, { pending: () => [VISIT] }, OVERVIEW_PAUSED)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/reservations/passes')
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/here you can keep confirming the check-ins/i)).toBeVisible()
    await expect(page.getByText(/included in pro/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^confirm$/i })).toBeEnabled()
    await page.screenshot({ path: 'test-results/passes-visits-plan-paused-light.png', fullPage: true })
  })

  test('pestañas píldora en el hash, y el reporte del mes arriba (sólo proveedores conectados)', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [VISIT] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/reservations/passes')
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    // la descripción del reporte también nombra «Expired (lost payments)»: se pide el ENCABEZADO de la columna
    await expect(page.getByRole('columnheader', { name: /expired \(lost payments\)/i })).toBeVisible()
    await expect(page.getByRole('cell', { name: '12', exact: true })).toBeVisible()
    // R2b-28: Wellhub (sin conexión) no sale en ceros en el reporte
    await expect(page.getByRole('cell', { name: 'Wellhub', exact: true })).toHaveCount(0)
    const confirmed = page.getByRole('tab', { name: /^confirmed$/i })
    await expect(confirmed).toHaveClass(/rounded-full/)
    await confirmed.click()
    await expect(page).toHaveURL(/#confirmed$/)
    await expect(page.getByText(/no confirmed check-ins yet/i)).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/#confirmed$/)
    await expect(page.getByText(/no confirmed check-ins yet/i)).toBeVisible({ timeout: 15_000 })
  })

  test('obligatoria 3: vacío ≠ sin resultados con filtro ≠ error del servidor', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [VISIT] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/reservations/passes')
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    // vacío: otra pestaña sin check-ins dice «no hay» (no «sin resultados»)
    await page.getByRole('tab', { name: /^rejected$/i }).click()
    await expect(page.getByText(/you haven't rejected any check-in/i)).toBeVisible()
    await expect(page.getByText(/no check-ins match these filters/i)).toHaveCount(0)
    await page.getByRole('tab', { name: /^pending$/i }).click()
    await expect(page.getByText('Ana López')).toBeVisible()
    // R2b-26: con un solo proveedor conectado el filtro de proveedor no se pinta; el filtro que hay es el de fecha.
    await expect(page.getByRole('button', { name: /^provider/i })).toHaveCount(0)
    // D9: la respuesta del filtro se RETIENE hasta que la prueba la suelta. Mientras no llega, la fila anterior sigue a la vista
    // con «Updating…» (la tabla no se desmontó en un spinner) y no se concluye «sin resultados».
    let release!: () => void
    const held = new Promise<void>(resolve => {
      release = resolve
    })
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/visits?*', async route => {
      if (!new URL(route.request().url()).searchParams.has('from')) return route.fallback()
      await held
      return route.fulfill(ok({ items: [], total: 0, hasMore: false, nextOffset: null }))
    })
    await page.getByRole('button', { name: /^date$/i }).click()
    await page.getByLabel(/^from$/i).fill('2026-09-01')
    await page.getByRole('button', { name: /^apply$/i }).click()
    await expect(page.getByText(/updating…/i)).toBeVisible()
    await expect(page.getByText('Ana López')).toBeVisible()
    await expect(page.getByText(/no check-ins match these filters/i)).toHaveCount(0)
    release()
    // sin resultados con filtro, ya con la respuesta nueva
    await expect(page.getByText(/no check-ins match these filters/i)).toBeVisible()
    await expect(page.getByText('Ana López')).toHaveCount(0)
    // error del servidor, con su mensaje tal cual
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/visits?*', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Se cayó la base' }) }),
    )
    await page.getByRole('tab', { name: /^expired$/i }).click()
    await expect(page.getByText('Se cayó la base')).toBeVisible()
    await expect(page.getByText(/couldn't load check-ins/i)).toBeVisible()
  })

  test('modo oscuro: la lista y el reporte se pintan con los tokens del tema', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockPasses(page, { pending: () => [VISIT] })
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/reservations/passes')
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    await darkMode(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText('Ana López')).toBeVisible({ timeout: 15_000 })
    // R2b-35: `.dark td { color }` (theme.css) pisa el color puesto en el <td>; el nuestro va en un hijo y debe sobrevivir.
    const color = (l: ReturnType<Page['locator']>) => l.evaluate(el => getComputedStyle(el).color)
    const report = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: /expired \(lost payments\)/i }) })
    const expiredCell = report.getByRole('row').filter({ hasText: 'TotalPass' }).getByRole('cell').nth(3)
    await expect(expiredCell).toHaveText('2')
    expect(await color(expiredCell.locator('.text-destructive'))).not.toBe(await color(expiredCell))
    const arrivedCell = page.getByRole('row').filter({ hasText: 'Ana López' }).getByRole('cell').nth(2)
    expect(await color(arrivedCell.locator('.text-muted-foreground'))).not.toBe(await color(arrivedCell))
    await page.screenshot({ path: 'test-results/passes-visits-dark.png', fullPage: true })
  })
})

/** Hoy en la zona del venue (America/Mexico_City, UTC-6 sin horario de verano) a la hora dada, en UTC. */
function todayInVenueAt(hourLocal: number): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  return `${day}T${String(hourLocal + 6).padStart(2, '0')}:00:00.000Z`
}

/** Clase de 60 min (64 px de alto) ligada a TotalPass, con 2 de 3 lugares para pases ocupados. */
const classSession = (id: string, hourLocal: number, enrolled: number) => ({
  id,
  venueId: 'venue-alpha',
  productId: 'p1',
  product: { id: 'p1', name: `Yoga ${hourLocal}h`, price: 150, maxParticipants: 12 },
  startsAt: todayInVenueAt(hourLocal),
  endsAt: todayInVenueAt(hourLocal + 1),
  capacity: 12,
  enrolled,
  available: 12 - enrolled,
  status: 'SCHEDULED',
  assignedStaffId: null,
  assignedStaff: null,
  internalNotes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  passes: { taken: 2, cap: 3, sessionCap: null },
})
/** 7/12 = sin aviso de lugares; 10/12 = con «2 spots left» en la MISMA fila que el indicador de pases. */
const SESSIONS = [classSession('s1', 10, 7), classSession('s2', 12, 10)]

async function openCalendar(page: Page, view: 'day' | 'week') {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
  await page.route('**/api/v1/dashboard/venues/*/class-sessions?*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSIONS) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/reservations/calendar?*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reservations: [] }) }),
  )
  await hideDevtools(page)
  await page.addInitScript(v => localStorage.setItem('avoqado:calendar-view', v), view)
  await page.goto('/venues/venue-alpha/reservations/calendar')
  const blocks = SESSIONS.map(s => page.locator('[data-reservation="true"]').filter({ hasText: s.product.name }))
  for (const block of blocks) await expect(block).toBeVisible({ timeout: 15_000 })
  // el calendario abre en la hora actual: se lleva la primera clase a la vista para la captura
  await blocks[0].scrollIntoViewIfNeeded()
  return blocks
}

/** La caja de `inner` cae entera dentro de la del bloque (que es overflow-hidden: lo que sale, no se ve). */
async function expectInsideBlock(block: ReturnType<Page['locator']>, inner: ReturnType<Page['locator']>) {
  await expect(inner).toBeVisible()
  const b = await block.boundingBox()
  const l = await inner.boundingBox()
  expect(b && l).toBeTruthy()
  expect(l!.x).toBeGreaterThanOrEqual(b!.x)
  expect(l!.y).toBeGreaterThanOrEqual(b!.y)
  expect(l!.x + l!.width).toBeLessThanOrEqual(b!.x + b!.width)
  expect(l!.y + l!.height).toBeLessThanOrEqual(b!.y + b!.height)
}

/**
 * El indicador de pases (boleto + «2/3», nombre completo «Passes: 2 of 3») y los inscritos («7/12», «10/12») ENTEROS dentro
 * del bloque, y la fila de inscritos en UN renglón (R2b-34: antes se partía y empujaba el «10/12» fuera del bloque).
 */
async function expectEnrolledRowFits(block: ReturnType<Page['locator']>, enrolled: string) {
  const passes = block.getByRole('img', { name: 'Passes: 2 of 3' })
  await expect(passes).toHaveAttribute('title', 'Passes: 2 of 3')
  await expect(passes).toHaveText('2/3')
  await expectInsideBlock(block, passes)
  expect(await passes.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  const count = block.getByText(enrolled, { exact: true })
  await expectInsideBlock(block, count)
  // un solo renglón: la fila no es más alta que una línea de texto-xs (16 px)
  const row = passes.locator('xpath=..')
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(16)
}

test.describe('Pases — calendario de clases (R2b-33/34: jsdom no mide)', () => {
  test('vista día (la de arranque): pases e inscritos completos dentro del bloque de 60 min', async ({ page }) => {
    const blocks = await openCalendar(page, 'day')
    await page.screenshot({ path: 'test-results/passes-calendar-day-light.png' })
    await expectEnrolledRowFits(blocks[0], '7/12')
    await expectEnrolledRowFits(blocks[1], '10/12')
  })

  // R2b-39 (full-testing, Issue 1): el mismo dedazo en los lugares de UNA clase (diálogo de la clase en el calendario).
  test('lugares de la clase: teclear «e» no se guarda como vacío; sólo los dígitos llegan al server', async ({ page }) => {
    const puts: unknown[] = []
    const blocks = await openCalendar(page, 'day')
    await page.route('**/api/v1/dashboard/venues/*/class-sessions/s1', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...SESSIONS[0], passes: { taken: 2, cap: 4, sessionCap: 4 } }),
      }),
    )
    await page.route('**/api/v1/dashboard/venues/*/pass-integrations/capacity/sessions/s1', route => {
      puts.push(route.request().postDataJSON())
      return route.fulfill(ok({ saved: true }))
    })
    await blocks[0].click()
    const input = page.locator('[data-tour="class-session-pass-cap-input"]')
    await expect(input).toHaveValue('4', { timeout: 15_000 })
    await input.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('e')
    await expect(input).toHaveValue('')
    await page.keyboard.type('2')
    await page.locator('[data-tour="class-session-pass-cap-save"]').click()
    // 🔴 la prueba: ningún PUT con `maxSpots:null`; llega el 2 que se ve
    await expect.poll(() => puts.length).toBe(1)
    expect(puts).toEqual([{ maxSpots: 2 }])
    await expect(input).toHaveValue('2')
  })

  // R2b-34 (arreglado): a 1280 px la columna de la semana mide ~119 px. El indicador compacto no se parte ni se encoge;
  // si falta espacio, el que se recorta es «2 spots left».
  test('vista semana a 1280 px: pases e inscritos completos dentro del bloque de 60 min', async ({ page }) => {
    const blocks = await openCalendar(page, 'week')
    await page.screenshot({ path: 'test-results/passes-calendar-week-light.png' })
    await blocks[0].screenshot({ path: 'test-results/passes-calendar-week-block-7of12-light.png' })
    await blocks[1].screenshot({ path: 'test-results/passes-calendar-week-block-10of12-light.png' })
    await expectEnrolledRowFits(blocks[0], '7/12')
    await expectEnrolledRowFits(blocks[1], '10/12')
  })
})
