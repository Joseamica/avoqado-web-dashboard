/**
 * «Crear terminal» del superadmin dentro del venue (maqueta G, 8-oct-2026).
 *
 * «Activar ya, sin código» antes sólo existía en la app avoqado-superadmin. Aquí: crea SIN código y
 * luego PATCH `status: ACTIVE` a la ruta de superadmin (la que sella `activatedAt` en el server).
 * También cubre el respaldo del detalle («Activar sin código») y que «Mostrar órdenes» ya no se ofrece.
 */

import { test, expect, Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ locale: 'es-MX' })

const VENUE_ID = 'venue-alpha'
const VENUE_SLUG = 'venue-alpha'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

type Call = { method: string; url: string; body: any }

async function setup(page: Page, opts: { activationCode?: string; pendingDevice?: boolean } = {}) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container{display:none!important}'
      document.head.appendChild(style)
    })
  })
  const venue = createMockVenue({ id: VENUE_ID, name: 'Testarudo Cafe', slug: VENUE_SLUG })
  venue.permissions = [...venue.permissions, 'tpv:command']
  await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN, venues: [venue] })

  const calls: Call[] = []
  const capabilities = {
    requiresActivation: true,
    canManagePaymentConfiguration: true,
    canAcceptTerminalPaymentRequests: true,
    customerDisplay: { presence: 'UNSUPPORTED', invertibility: 'UNSUPPORTED', canRequestInversion: false, observedAt: null, stale: true },
    supportedRemoteCommands: [],
  }
  const pending = {
    id: 'dev-new',
    venueId: VENUE_ID,
    name: 'Caja 2',
    type: 'TPV_ANDROID',
    status: 'INACTIVE',
    serialNumber: 'AVQD-N860W175377',
    brand: 'NEXGO',
    model: 'N86',
    lastHeartbeat: null,
    activatedAt: null,
    isLocked: false,
    customerDisplayInverted: false,
    customerDisplayRequest: null,
    capabilities,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
  }

  await page.route('**/api/v1/dashboard/venues/*/tpvs**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: opts.pendingDevice ? [pending] : [], meta: { total: opts.pendingDevice ? 1 : 0, page: 1, pageSize: 20 } }),
    }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpv-orders**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/tpv/dev-new', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pending) }),
  )
  // Superadmin: la lista de terminales con cuentas y la de cuentas de comercio.
  await page.route('**/api/v1/dashboard/superadmin/terminals?**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/superadmin/merchant-accounts**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/superadmin/terminals', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    const body = route.request().postDataJSON()
    calls.push({ method: 'POST', url: route.request().url(), body })
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...pending, name: body.name, serialNumber: body.serialNumber },
        ...(body.generateActivationCode && opts.activationCode
          ? { activationCode: { activationCode: opts.activationCode, expiresAt: '2026-10-15T10:00:00.000Z', expiresIn: 604800 } }
          : {}),
      }),
    })
  })
  await page.route('**/api/v1/dashboard/superadmin/terminals/*', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    calls.push({ method: 'PATCH', url: route.request().url(), body: route.request().postDataJSON() })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ...pending, status: 'ACTIVE', activatedAt: '2026-10-08T10:05:00.000Z' } }),
    })
  })
  return { calls }
}

async function openCreate(page: Page) {
  await page.goto(`/venues/${VENUE_SLUG}/devices`)
  await page.getByRole('button', { name: 'Crear terminal' }).click({ timeout: 15_000 })
  await expect(page.getByText('Nueva terminal').first()).toBeVisible()
}

test.describe('Crear terminal (superadmin)', () => {
  test('«Activar ya, sin código»: crea sin código y luego la marca Activa en la ruta de superadmin', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    const { calls } = await setup(page)
    await openCreate(page)

    await page.locator('#tpv-create-serial').fill('N860W175377')
    await page.locator('#tpv-create-name').fill('Caja 2')
    await page.locator('[data-tour="tpv-create-activation-activate-now"]').click()
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/crear-terminal.png`, fullPage: true })
    await page.getByRole('button', { name: 'Crear y activar' }).click()

    await expect.poll(() => calls.map(c => c.method)).toEqual(['POST', 'PATCH'])
    expect(calls[0].body).toMatchObject({
      venueId: VENUE_ID,
      serialNumber: 'AVQD-N860W175377',
      name: 'Caja 2',
      type: 'TPV_ANDROID',
      brand: 'NEXGO',
      model: 'N86',
      generateActivationCode: false,
    })
    // Hereda los ajustes de la organización: no manda overrides.
    expect(calls[0].body.configOverrides).toBeUndefined()
    expect(calls[1].url).toContain('/api/v1/dashboard/superadmin/terminals/dev-new')
    expect(calls[1].body).toEqual({ status: 'ACTIVE' })
    await expect(page.getByText('Terminal creada y activada', { exact: true })).toBeVisible()
  })

  test('«Con código» (default): el código queda a la vista y no se activa nada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { calls } = await setup(page, { activationCode: 'A3F9K2' })
    await openCreate(page)

    await page.locator('[data-tour="tpv-create-model-pax-a910s"]').click()
    await page.locator('#tpv-create-serial').fill('AVQD-2841653112')
    await page.locator('#tpv-create-name').fill('Caja 3')
    await page.getByRole('button', { name: 'Crear y generar código' }).click()

    await expect(page.getByTestId('activation-code')).toHaveText('A3F9K2')
    expect(calls).toHaveLength(1)
    // El prefijo no se duplica aunque lo tecleen.
    expect(calls[0].body).toMatchObject({ serialNumber: 'AVQD-2841653112', brand: 'PAX', model: 'A910S', generateActivationCode: true })
  })

  test('«Mostrar órdenes» ya no se ofrece al personalizar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await setup(page)
    await openCreate(page)
    await page.getByRole('radio', { name: /Personalizar sólo esta terminal/ }).click()
    await expect(page.getByText('Mostrar Órdenes', { exact: false })).toHaveCount(0)
  })

  test('detalle: «Activar sin código» para una terminal pendiente', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { calls } = await setup(page, { pendingDevice: true })
    await page.goto(`/venues/${VENUE_SLUG}/devices/dev-new`)
    await page.locator('[data-tour="tpv-detail-activate-without-code"]').click({ timeout: 15_000 })
    await expect.poll(() => calls).toEqual([
      { method: 'PATCH', url: expect.stringContaining('/superadmin/terminals/dev-new'), body: { status: 'ACTIVE' } },
    ])
  })
})
