/**
 * E2E happy-path del módulo Activos fijos (Contabilidad → Activos fijos):
 *  - la lista pinta los activos del API (tipo, MOI, estado)
 *  - registrar: el tipo precarga la tasa SAT (editable) y el POST manda centavos
 *  - correr depreciación: POST /depreciate + toast con el total del periodo
 *  - editar: el formulario abre precargado y el PATCH manda solo el cambio esperado
 *  - dar de baja: POST /:id/dispose con precio → toast de ganancia
 *
 * Los servicios fiscales leen `res.data` CRUDO (sin wrapper {success,data}) — los mocks
 * devuelven el body tal cual lo manda el server. Playwright routes son LIFO: lo específico
 * se registra DESPUÉS de setupApiMocks. Locale default de E2E: inglés (fallbackLng 'en').
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const raw = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })

const ASSET_TYPES = [
  { key: 'EQUIPO_COMPUTO', label: 'Equipo de cómputo', annualRate: 0.3, satRef: 'LISR 34-VII', satAccountGroup: '156', moiCapCents: null },
  { key: 'MOBILIARIO_OFICINA', label: 'Mobiliario y equipo de oficina', annualRate: 0.1, satRef: 'LISR 34-III', satAccountGroup: '155', moiCapCents: null },
]

const LAPTOP = {
  id: 'fa1',
  organizationId: 'org1',
  rfc: 'EKU9003173C9',
  venueId: 'venue-alpha',
  description: 'Laptop del mostrador',
  assetType: 'EQUIPO_COMPUTO',
  assetTypeLabel: 'Equipo de cómputo',
  moiCents: 30_000_00,
  depreciableBaseCents: 30_000_00,
  annualRate: 0.3,
  acquisitionDate: '2026-03-15',
  inServiceDate: '2026-03-15',
  salvageValueCents: 0,
  status: 'ACTIVE',
  sourceExpenseId: null,
  createdAt: '2026-03-15T18:00:00Z',
}

interface Captured {
  register: any
  patch: { assetId: string | null; body: any }
  depreciate: any
  dispose: { assetId: string | null; body: any }
}

async function setupFixedAssetMocks(page: Page): Promise<Captured> {
  const captured: Captured = { register: null, patch: { assetId: null, body: null }, depreciate: null, dispose: { assetId: null, body: null } }

  const venue = createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    // La ruta es PermissionProtectedRoute("accounting:read") — otorgarlo explícito.
    permissions: ['menu:read', 'orders:read', 'payments:read', 'reports:read', 'settings:read', 'accounting:read', 'accounting:manage'],
  })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  // Gate determinista: la página es FeatureGate CFDI (PREMIUM).
  await page.route('**/api/v1/dashboard/venues/*/plan-tier*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tier: 'PREMIUM', grandfathered: false, exempt: false } }) }),
  )

  await page.route('**/api/v1/dashboard/venues/*/accounting/asset-types', route => route.fulfill(raw({ assetTypes: ASSET_TYPES })))

  // GET lista + POST registrar comparten URL → branch por método.
  await page.route('**/api/v1/dashboard/venues/*/accounting/fixed-assets', route => {
    if (route.request().method() === 'POST') {
      captured.register = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...LAPTOP, id: 'fa2', description: captured.register.description }),
      })
    }
    return route.fulfill(raw({ needsFiscalSetup: false, assets: [LAPTOP] }))
  })

  await page.route('**/api/v1/dashboard/venues/*/accounting/fixed-assets/depreciate', route => {
    captured.depreciate = route.request().postDataJSON()
    return route.fulfill(raw({ needsFiscalSetup: false, period: '2026-07', assetsProcessed: 1, assetsDepreciated: 1, totalPeriodCents: 750_00, posted: true }))
  })

  await page.route('**/api/v1/dashboard/venues/*/accounting/fixed-assets/*/dispose', route => {
    captured.dispose.assetId = route.request().url().split('/fixed-assets/')[1]?.split('/')[0] ?? null
    captured.dispose.body = route.request().postDataJSON()
    return route.fulfill(
      raw({
        asset: { ...LAPTOP, status: 'DISPOSED' },
        accumulatedDepreciationCents: 12_000_00,
        bookValueCents: 18_000_00,
        proceedsCents: 20_000_00,
        gainLossCents: 2_000_00,
      }),
    )
  })

  // PATCH editar (después de /dispose y /depreciate: LIFO → los específicos ya ganan).
  await page.route('**/api/v1/dashboard/venues/*/accounting/fixed-assets/*', route => {
    if (route.request().method() === 'PATCH') {
      captured.patch.assetId = route.request().url().split('/fixed-assets/')[1] ?? null
      captured.patch.body = route.request().postDataJSON()
      return route.fulfill(raw({ ...LAPTOP, annualRate: captured.patch.body.annualRate ?? LAPTOP.annualRate }))
    }
    return route.fallback()
  })

  return captured
}

async function gotoFixedAssets(page: Page) {
  await page.goto('/venues/venue-alpha/contabilidad/activos-fijos')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => {
    const panel = document.querySelector('.tsqd-parent-container')
    if (panel) (panel as HTMLElement).style.display = 'none'
  })
}

test.describe('Fixed assets — register · depreciate · edit · dispose (happy paths)', () => {
  test('lists the assets returned by the API', async ({ page }) => {
    await setupFixedAssetMocks(page)
    await gotoFixedAssets(page)

    await expect(page.getByRole('heading', { name: /Fixed assets/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Laptop del mostrador')).toBeVisible()
    await expect(page.getByText('Equipo de cómputo')).toBeVisible()
    await expect(page.getByText('30,000')).toHaveCount(2) // MOI + base depreciable
    await expect(page.getByText('30.0%')).toBeVisible()
  })

  test('register: picking a type pre-fills the SAT rate and the POST carries cents', async ({ page }) => {
    const captured = await setupFixedAssetMocks(page)
    await gotoFixedAssets(page)

    await page.getByRole('button', { name: 'Register asset' }).click()
    await page.locator('#fa-desc').fill('Refrigerador industrial')
    await page.locator('#fa-type').selectOption('EQUIPO_COMPUTO')
    await expect(page.locator('#fa-rate')).toHaveValue('30') // tasa SAT precargada, editable
    await page.locator('#fa-monto').fill('35000')

    await page.getByRole('button', { name: 'Register', exact: true }).click()
    await expect(page.getByText('Asset registered').first()).toBeVisible({ timeout: 10_000 })
    expect(captured.register).toMatchObject({ description: 'Refrigerador industrial', assetType: 'EQUIPO_COMPUTO', moiCents: 3_500_000, annualRate: 0.3 })
  })

  test('run depreciation posts the period and reports the total in a toast', async ({ page }) => {
    const captured = await setupFixedAssetMocks(page)
    await gotoFixedAssets(page)

    await page.getByRole('button', { name: 'Run depreciation' }).click()
    await expect(page.getByText(/Depreciation run: 1 assets/).first()).toBeVisible({ timeout: 10_000 })
    expect(captured.depreciate).toMatchObject({ period: expect.stringMatching(/^\d{4}-\d{2}$/) })
  })

  test('edit: the form opens pre-filled and the PATCH carries the changed rate', async ({ page }) => {
    const captured = await setupFixedAssetMocks(page)
    await gotoFixedAssets(page)

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    // Precargado desde el activo.
    await expect(page.locator('#fa-desc')).toHaveValue('Laptop del mostrador')
    await expect(page.locator('#fa-monto')).toHaveValue('30000')
    await expect(page.locator('#fa-rate')).toHaveValue('30')

    await page.locator('#fa-rate').fill('20')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Asset updated').first()).toBeVisible({ timeout: 10_000 })
    expect(captured.patch.assetId).toBe('fa1')
    expect(captured.patch.body).toMatchObject({ annualRate: 0.2, moiCents: 3_000_000 })
  })

  test('dispose: sale price posts to /dispose and the gain toast shows', async ({ page }) => {
    const captured = await setupFixedAssetMocks(page)
    await gotoFixedAssets(page)

    await page.getByRole('button', { name: 'Dispose', exact: true }).click()
    await page.locator('#dispose-price').fill('20000')
    await page.getByRole('button', { name: 'Confirm disposal' }).click()

    await expect(page.getByText(/Asset disposed — gain of/).first()).toBeVisible({ timeout: 10_000 })
    expect(captured.dispose.assetId).toBe('fa1')
    expect(captured.dispose.body).toMatchObject({ proceedsCents: 2_000_000, disposalDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })
})
