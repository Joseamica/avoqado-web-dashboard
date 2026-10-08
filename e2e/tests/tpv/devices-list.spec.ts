/**
 * Lista de Dispositivos — rediseño A1 (8-oct-2026, elegido por el founder).
 *
 * Una sola tabla estilo Square con columna «Sistema»; acciones en un menú «⋯» (el ↻ de la
 * lista vieja reiniciaba la terminal a un clic); tarjetas cuando el contenido es angosto.
 * Datos con la forma real de `GET /dashboard/venues/:id/tpvs` (fila completa de Terminal).
 *
 * Cubre las tres pruebas obligatorias de testing-and-git.md: la búsqueda va al servidor y
 * el buscador conserva el foco; vacío/sin resultados/error se distinguen; y las acciones.
 */

import { test, expect, Page, Route } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
// El dashboard toma el idioma del navegador (src/i18n.ts); las aserciones son en español.
test.use({ locale: 'es-MX' })

const VENUE_ID = 'venue-alpha'
const VENUE_SLUG = 'venue-alpha'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

function capabilities(opts: { payment?: boolean; commands?: string[] } = {}) {
  return {
    requiresActivation: !!opts.payment,
    canManagePaymentConfiguration: !!opts.payment,
    canAcceptTerminalPaymentRequests: !!opts.payment,
    customerDisplay: { presence: 'UNKNOWN', invertibility: 'UNKNOWN', canRequestInversion: false, observedAt: null, stale: true },
    supportedRemoteCommands: opts.commands ?? [],
  }
}

const TPV_COMMANDS = ['RESTART', 'MAINTENANCE_MODE', 'EXIT_MAINTENANCE', 'LOCK', 'UNLOCK']

function device(overrides: Record<string, unknown>) {
  return {
    venueId: VENUE_ID,
    status: 'ACTIVE',
    isLocked: false,
    config: null,
    serialNumber: null,
    deviceUid: null,
    brand: null,
    model: null,
    modelIdentifier: null,
    osVersion: null,
    formFactor: null,
    version: null,
    systemInfo: null,
    selfRegistered: false,
    activatedAt: null,
    todayPaymentCount: 0,
    todayPaymentTotal: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  }
}

function buildDevices() {
  return [
    device({
      id: 'dev-pax-black',
      name: 'Testarudo PAX - BLACK',
      type: 'TPV_ANDROID',
      lastHeartbeat: ago(MIN),
      serialNumber: 'AVQD-N860W173400',
      brand: 'NEXGO',
      model: 'NEXGO N86',
      version: '2.12.2-nexgo-prod',
      systemInfo: { osVersion: 'Android XAP OS V1.0', batteryLevel: 76, batteryCharging: true, memory: { used: 18, total: 128 } },
      activatedAt: '2026-10-08T10:00:00.000Z',
      capabilities: capabilities({ payment: true, commands: TPV_COMMANDS }),
      todayPaymentCount: 83,
      todayPaymentTotal: 12337.25,
    }),
    device({
      id: 'dev-pax-white',
      name: 'Testarudo PAX - WHITE',
      type: 'TPV_ANDROID',
      lastHeartbeat: ago(2 * HOUR),
      serialNumber: 'AVQD-2841653112',
      brand: 'PAX',
      model: 'PAX A910S',
      version: '2.10.0',
      systemInfo: { osVersion: 'Android 10', batteryLevel: 50 },
      activatedAt: '2026-09-01T10:00:00.000Z',
      capabilities: capabilities({ payment: true, commands: TPV_COMMANDS }),
      todayPaymentCount: 2,
      todayPaymentTotal: 396,
    }),
    device({
      id: 'dev-nexgo',
      name: 'NEXGO',
      type: 'TPV_ANDROID',
      lastHeartbeat: ago(56 * DAY),
      serialNumber: 'AVQD-N620W100220',
      model: 'NEXGO N62',
      version: '2.7.2-nexgo-prod',
      systemInfo: { osVersion: 'Android XAP OS V1.0', batteryLevel: 13 },
      activatedAt: '2026-08-01T10:00:00.000Z',
      capabilities: capabilities({ payment: true, commands: TPV_COMMANDS }),
    }),
    device({
      // 🔴 El caso del founder: el server lo marcó INACTIVE (no manda heartbeat de salud)
      // pero se está usando ahorita. Antes salía «Inactivo» + «Última conexión: Ahora».
      id: 'dev-sunmi',
      name: 'Sunmi D3',
      type: 'POS_ANDROID',
      status: 'INACTIVE',
      lastHeartbeat: ago(10_000),
      formFactor: 'COUNTERTOP_POS',
      model: 'Sunmi D3',
      osVersion: 'Android 11',
      version: '2.22.2',
      deviceUid: 'c9a989ea-01d7-4418-a594-8d225001c68d',
      selfRegistered: true,
      capabilities: capabilities(),
    }),
    device({
      // La app de Android en la PC: se registra como POS_ANDROID / «Android 14».
      id: 'dev-windows',
      name: 'Caja PC',
      type: 'POS_ANDROID',
      lastHeartbeat: ago(4 * HOUR),
      formFactor: 'TABLET',
      brand: 'Avoqado',
      model: 'Avoqado Windows 11',
      modelIdentifier: 'Windows 11',
      osVersion: 'Android 14',
      version: '2.22.3-escritorio',
      deviceUid: '7e0c41aa-5b1f-4c11-9a2e-3d8e0c6f19bf',
      selfRegistered: true,
      capabilities: capabilities(),
    }),
    device({
      id: 'dev-iphone',
      name: 'iPhone 16 Pro',
      type: 'POS_IOS',
      lastHeartbeat: ago(5 * HOUR),
      formFactor: 'PHONE',
      model: 'iPhone 16 Pro',
      osVersion: 'iOS 18.6',
      version: '1.14.0',
      deviceUid: '37B06327-D122-47EF-8C0A-D62BBE0E92EE',
      selfRegistered: true,
      capabilities: capabilities(),
    }),
  ]
}

type ListMode = { kind: 'ok'; total?: number } | { kind: 'error' }

async function setup(page: Page, mode: ListMode = { kind: 'ok' }) {
  const venue = createMockVenue({ id: VENUE_ID, name: 'Testarudo Cafe', slug: VENUE_SLUG })
  // Un OWNER real tiene `tpv:command` (reiniciar, mantenimiento); el mock base no lo trae.
  venue.permissions = [...venue.permissions, 'tpv:command']
  // El panel de React Query Devtools (sólo en `npm run dev`) tapa los botones de abajo.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container{display:none!important}'
      document.head.appendChild(style)
    })
  })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  const searches: string[] = []
  await page.route('**/api/v1/dashboard/venues/*/tpvs**', async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (mode.kind === 'error') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) })
    }
    const url = new URL(route.request().url())
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    if (search) searches.push(search)
    const all = buildDevices()
    const data = search ? all.filter(d => String(d.name).toLowerCase().includes(search)) : all
    // Un poco de latencia: hace visible un buscador que se desmonte al cargar.
    await new Promise(r => setTimeout(r, 250))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data,
        meta: { total: search ? data.length : (mode.total ?? data.length), page: 1, pageSize: 20, pageCount: 1 },
      }),
    })
  })
  await page.route('**/api/v1/dashboard/venues/*/tpv-orders**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )

  const commands: Array<{ terminalId: string; command: string }> = []
  await page.route('**/api/v1/dashboard/tpv/*/command', async route => {
    const terminalId = route.request().url().split('/tpv/')[1].split('/')[0]
    commands.push({ terminalId, command: route.request().postDataJSON()?.command })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  })

  return { searches, commands }
}

function row(page: Page, name: string) {
  return page.locator('tbody tr').filter({ hasText: name })
}

test.describe('Dispositivos — lista A1', () => {
  test('una tabla con Sistema, batería, app e ID; sin los íconos sueltos de llave y ↻', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)

    await expect(row(page, 'Testarudo PAX - BLACK')).toBeVisible({ timeout: 15_000 })
    for (const header of ['Dispositivo', 'Estado', 'Sistema', 'Batería', 'App', 'ID', 'Ventas hoy']) {
      await expect(page.locator('thead').getByText(header, { exact: true })).toBeVisible()
    }

    // Sistema: la TPV lleva la etiqueta TPV; la PC dice Windows aunque se registre como Android.
    await expect(row(page, 'Testarudo PAX - BLACK')).toContainText('TPV')
    await expect(row(page, 'Testarudo PAX - BLACK')).toContainText('76%')
    await expect(row(page, 'Testarudo PAX - BLACK')).toContainText('AVQD-N860W173400')
    await expect(row(page, 'Testarudo PAX - BLACK')).toContainText('$12,337.25')
    await expect(row(page, 'Caja PC')).toContainText('Windows 11')
    await expect(row(page, 'Caja PC')).not.toContainText('Android')
    await expect(row(page, 'iPhone 16 Pro')).toContainText('iOS 18.6')
    await expect(row(page, 'iPhone 16 Pro')).toContainText('37B06327…92EE')

    // 🔴 El Sunmi INACTIVE pero usado hace 10 s: en línea, sin «Inactivo».
    await expect(row(page, 'Sunmi D3')).toContainText('En línea')
    await expect(row(page, 'Sunmi D3')).not.toContainText('Inactivo')

    // Sin conexión dice hace cuánto; 56 días se marca para revisar.
    await expect(row(page, 'Testarudo PAX - WHITE')).toContainText('Sin conexión · hace 2 h')
    await expect(row(page, 'AVQD-N620W100220')).toContainText('hace 56 días')

    // Ni tarjetas de métricas ni íconos sueltos en las filas.
    await expect(page.locator('tbody .lucide-wrench')).toHaveCount(0)
    await expect(page.locator('tbody .lucide-rotate-cw')).toHaveCount(0)
    await expect(page.getByText('6 dispositivos')).toBeVisible()

    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/lista-escritorio.png`, fullPage: true })
  })

  test('modo oscuro: los estados se leen (captura para revisión)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1600, height: 900 })
    await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)
    await expect(row(page, 'Sunmi D3')).toContainText('En línea', { timeout: 15_000 })
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/lista-oscuro.png`, fullPage: true })
  })

  test('reiniciar vive en el menú «⋯» y pide confirmación antes de mandar el comando', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { commands } = await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)

    const target = row(page, 'Testarudo PAX - BLACK')
    await expect(target).toBeVisible({ timeout: 15_000 })
    await target.getByRole('button', { name: 'Más acciones' }).click()
    await page.getByRole('menuitem', { name: 'Reiniciar' }).click()

    // Abrir el menú no navegó al detalle.
    await expect(page).toHaveURL(new RegExp(`/venues/${VENUE_SLUG}/devices$`))
    await expect(page.getByRole('alertdialog')).toContainText('¿Reiniciar Testarudo PAX - BLACK?')
    expect(commands).toHaveLength(0)

    await page.getByRole('alertdialog').getByRole('button', { name: 'Reiniciar' }).click()
    await expect.poll(() => commands).toEqual([{ terminalId: 'dev-pax-black', command: 'RESTART' }])
  })

  test('buscar va al servidor y el buscador no pierde el foco', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { searches } = await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)
    await expect(row(page, 'Sunmi D3')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Buscar por nombre o serie' }).click()
    const input = page.getByPlaceholder('Buscar por nombre o serie')
    await input.pressSequentially('pax', { delay: 120 })
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('pax')

    await expect.poll(() => searches.at(-1)).toBe('pax')
    await expect(row(page, 'Sunmi D3')).toHaveCount(0)
    await expect(row(page, 'Testarudo PAX - WHITE')).toBeVisible()
    await expect(input).toBeFocused()

    // Sin resultados ≠ lista vacía.
    await input.fill('zzz')
    await expect(page.getByText('Ningún dispositivo coincide con la búsqueda o los filtros.').first()).toBeVisible()
  })

  test('el paginador usa el total del servidor, no las filas de la página', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await setup(page, { kind: 'ok', total: 45 })
    await page.goto(`/venues/${VENUE_SLUG}/devices`)
    await expect(row(page, 'Sunmi D3')).toBeVisible({ timeout: 15_000 })
    // La tabla y las tarjetas (ocultas a este ancho) pintan su paginador: vale el de la tabla.
    await expect(page.getByText('Página 1 de 3').first()).toBeVisible()
    await expect(page.getByText('45 dispositivos')).toBeVisible()
  })

  test('con poco ancho se ven tarjetas con batería, sistema, versión e ID', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 })
    await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)

    const card = page.locator('a').filter({ hasText: 'Testarudo PAX - BLACK' })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('table:visible')).toHaveCount(0)
    await expect(card).toContainText('76%')
    await expect(card).toContainText('AVQD-N860W173400')
    await expect(card).toContainText('v2.12.2')
    await expect(page.locator('a').filter({ hasText: 'Caja PC' })).toContainText('Windows 11')

    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/lista-angosta.png`, fullPage: true })
  })

  test('si el servidor falla, se dice y se puede reintentar (no se ve como lista vacía)', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await setup(page, { kind: 'error' })
    await page.goto(`/venues/${VENUE_SLUG}/devices`)
    await expect(page.getByText('No se pudo cargar la lista de dispositivos.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
    await expect(page.getByText('Todavía no hay dispositivos.')).toHaveCount(0)
  })
})

// ─── Detalle (maqueta E) ─────────────────────────────────────────────────────

async function setupDetail(page: Page, deviceId: string) {
  const { commands } = await setup(page)
  const target = buildDevices().find(d => d.id === deviceId)!
  await page.route(`**/api/v1/dashboard/venues/*/tpv/${deviceId}`, route => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...target, ipAddress: '189.211.109.82', customerDisplayInverted: false, customerDisplayRequest: null }),
    })
  })
  return { commands }
}

test.describe('Dispositivos — detalle E', () => {
  test('datos del aparato en una lista; la memoria va en MB (antes «18 B / 128 B»)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await setupDetail(page, 'dev-pax-black')
    await page.goto(`/venues/${VENUE_SLUG}/devices/dev-pax-black`)

    await expect(page.getByRole('heading', { name: 'Testarudo PAX - BLACK' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Este dispositivo')).toBeVisible()
    await expect(page.getByText('18 MB de 128 MB')).toBeVisible()
    await expect(page.getByText(/\d+ B \/ \d+ B/)).toHaveCount(0)
    await expect(page.getByText('IP 189.211.109.82')).toBeVisible()
    // Un dueño no ve lo de superadmin.
    await expect(page.getByText('Solo superadmin')).toHaveCount(0)

    await expect(page.locator('dl').getByText('Terminal de cobro', { exact: true })).toBeVisible()

    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/detalle-claro.png`, fullPage: true })
  })

  test('modo oscuro del detalle (captura para revisión)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await setupDetail(page, 'dev-pax-black')
    await page.goto(`/venues/${VENUE_SLUG}/devices/dev-pax-black`)
    await expect(page.getByText('18 MB de 128 MB')).toBeVisible({ timeout: 15_000 })
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/detalle-oscuro.png`, fullPage: true })
  })

  test('«Acciones» → Reiniciar pide confirmación', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { commands } = await setupDetail(page, 'dev-pax-black')
    await page.goto(`/venues/${VENUE_SLUG}/devices/dev-pax-black`)

    await page.getByRole('button', { name: 'Acciones' }).click({ timeout: 15_000 })
    await page.getByRole('menuitem', { name: 'Reiniciar' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('¿Reiniciar Testarudo PAX - BLACK?')
    expect(commands).toHaveLength(0)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reiniciar' }).click()
    await expect.poll(() => commands).toEqual([{ terminalId: 'dev-pax-black', command: 'RESTART' }])
  })

  test('la caja de Windows se describe como Windows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await setupDetail(page, 'dev-windows')
    await page.goto(`/venues/${VENUE_SLUG}/devices/dev-windows`)
    await expect(page.getByRole('heading', { name: 'Caja PC' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('dl').getByText('Windows 11', { exact: true })).toBeVisible()
  })
})
