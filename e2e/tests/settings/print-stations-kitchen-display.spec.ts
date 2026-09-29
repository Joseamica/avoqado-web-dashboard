/**
 * E2E — Pantalla de cocina por estación (etapa 3 del KDS, fase 3.2).
 *
 * Cubre la regla obligatoria «escribir y VER el resultado» (.claude/rules/testing-and-git.md): prender la pantalla de
 * una estación cambia su tarjeta SIN recargar — la prueba es la tarjeta, no el toast. Además: antes del lanzamiento el
 * dueño no ve la casilla, y un negocio sin Pro ve el plan en vez de prenderla. El locale de las E2E es inglés.
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

/** Cierra las DevTools de TanStack si estorban (mismo helper que settings-hub.spec.ts). */
async function closeTanStackDevTools(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'printers:read', 'printers:manage', 'billing:read'],
})

const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const FREE = { planTier: 'GRATIS', grandfathered: false } as const

function estacion(over: Record<string, unknown> = {}) {
  return {
    id: 'st_bar',
    venueId: 'venue-alpha',
    name: 'Bar',
    printerId: 'pr_1',
    copies: 1,
    isDefault: false,
    isPacking: false,
    hasKitchenDisplay: false,
    kitchenDisplaySince: null,
    active: true,
    displayOrder: 0,
    printer: { id: 'pr_1', name: 'Epson Bar', active: true, lastStatus: null },
    ...over,
  }
}

/** Servidor fingido con ESTADO: la lista refleja lo que la casilla guardó. */
async function mockEstaciones(page: Page, opts: { abierta: boolean }) {
  let station = estacion()
  const puts: unknown[] = []
  await page.route('**/api/v1/dashboard/venues/*/onboarding-state', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { 'platform-welcome-completed': true } }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/print-stations/', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [station], kitchenDisplayOpenToClients: opts.abierta }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/print-stations/*/kitchen-display', async route => {
    const body = route.request().postDataJSON() as { enabled: boolean }
    puts.push(body)
    station = estacion({ hasKitchenDisplay: body.enabled, kitchenDisplaySince: body.enabled ? new Date().toISOString() : null })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: station }) })
  })
  return { puts }
}

async function abrir(page: Page) {
  await page.goto('/venues/venue-alpha/settings/print-stations')
  await expect(page.getByTestId('station-card-st_bar')).toBeVisible({ timeout: 15_000 })
  await closeTanStackDevTools(page)
}

test.describe('Kitchen display per station', () => {
  test('owner turns on the display after confirming and the card updates without reloading', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    const { puts } = await mockEstaciones(page, { abierta: true })
    await abrir(page)
    const card = page.getByTestId('station-card-st_bar')
    await expect(card.getByText('Goes to: Paper')).toBeVisible()

    await card.getByRole('switch', { name: 'Kitchen display for Bar' }).click()
    await page.getByRole('button', { name: 'Turn on display' }).click()

    // 🔴 La prueba es la tarjeta, no el toast: la lista cambió sin recargar.
    await expect(card.getByRole('switch', { name: 'Kitchen display for Bar' })).toBeChecked()
    await expect(card.getByText('Goes to: Paper and display')).toBeVisible()
    expect(puts).toEqual([{ enabled: true }])
  })

  test('before launch the owner does not see the display switch', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockEstaciones(page, { abierta: false })
    await abrir(page)
    await expect(page.getByRole('switch', { name: 'Kitchen display for Bar' })).toHaveCount(0)
  })

  test('a Free venue sees the Pro plan instead of turning it on', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    const { puts } = await mockEstaciones(page, { abierta: true })
    await abrir(page)
    await page.getByRole('switch', { name: 'Kitchen display for Bar' }).click()
    await expect(page.getByText('Kitchen display is part of the Pro plan.')).toBeVisible()
    expect(puts).toEqual([])
  })
})
