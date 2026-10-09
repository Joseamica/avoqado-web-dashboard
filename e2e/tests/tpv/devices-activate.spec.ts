/**
 * «Activar» en la lista de Dispositivos: dos caminos (getActivationRoute).
 *
 * - Terminal creada por superadmin (INACTIVE, ya con serie): genera código. Antes abría el modal de
 *   serie y el server lo rechazaba («is not in PENDING_ACTIVATION status»).
 * - Terminal comprada (PENDING_ACTIVATION, sin serie): sigue pidiendo la serie, como siempre.
 */

import { test, expect, Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ locale: 'es-MX' })

const VENUE_ID = 'venue-alpha'
const VENUE_SLUG = 'venue-alpha'

const capabilities = {
  requiresActivation: true,
  canManagePaymentConfiguration: true,
  canAcceptTerminalPaymentRequests: true,
  customerDisplay: { presence: 'UNKNOWN', invertibility: 'UNKNOWN', canRequestInversion: false, observedAt: null, stale: true },
  supportedRemoteCommands: [],
}

function terminal(overrides: Record<string, unknown>) {
  return {
    venueId: VENUE_ID,
    type: 'TPV_ANDROID',
    isLocked: false,
    lastHeartbeat: null,
    activatedAt: null,
    brand: 'NEXGO',
    model: 'N86',
    systemInfo: null,
    capabilities,
    todayPaymentCount: 0,
    todayPaymentTotal: 0,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  }
}

async function setup(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container{display:none!important}'
      document.head.appendChild(style)
    })
  })
  const venue = createMockVenue({ id: VENUE_ID, name: 'Testarudo Cafe', slug: VENUE_SLUG })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  const devices = [
    terminal({ id: 'dev-sa', name: 'Caja 2', status: 'INACTIVE', serialNumber: 'AVQD-N860W175377' }),
    terminal({ id: 'dev-bought', name: 'Terminal comprada', status: 'PENDING_ACTIVATION', serialNumber: null }),
  ]
  await page.route('**/api/v1/dashboard/venues/*/tpvs**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: devices, meta: { total: devices.length, page: 1, pageSize: 20 } }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpv-orders**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )

  const codeRequests: string[] = []
  await page.route('**/api/v1/dashboard/venues/*/tpv/*/activation-code', route => {
    codeRequests.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activationCode: 'K7P2QX', expiresAt: '2026-10-15T10:00:00.000Z', expiresIn: 604800, venueName: 'Testarudo Cafe' }),
    })
  })
  return { codeRequests }
}

function row(page: Page, name: string) {
  return page.locator('tbody tr').filter({ hasText: name })
}

test.describe('Dispositivos — «Activar» elige el camino', () => {
  test('terminal creada por superadmin (INACTIVE con serie): genera código y lo muestra', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { codeRequests } = await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)

    await row(page, 'Caja 2').getByRole('button', { name: 'Más acciones' }).click({ timeout: 15_000 })
    await page.getByRole('menuitem', { name: 'Activar' }).click()

    await expect.poll(() => codeRequests.length).toBe(1)
    expect(codeRequests[0]).toContain('/tpv/dev-sa/activation-code')
    // El diálogo abre en «Código QR»; el código escrito vive en «Código Manual».
    await expect(page.getByRole('tab', { name: 'Código QR' })).toBeVisible()
    await page.getByRole('tab', { name: 'Código Manual' }).click()
    await expect(page.getByText('K7P2QX').first()).toBeVisible()
  })

  test('terminal comprada (PENDING_ACTIVATION): sigue pidiendo el número de serie', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { codeRequests } = await setup(page)
    await page.goto(`/venues/${VENUE_SLUG}/devices`)

    await row(page, 'Terminal comprada').getByRole('button', { name: 'Más acciones' }).click({ timeout: 15_000 })
    await page.getByRole('menuitem', { name: 'Activar' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('textbox')).toBeVisible()
    expect(codeRequests).toHaveLength(0)
  })
})
