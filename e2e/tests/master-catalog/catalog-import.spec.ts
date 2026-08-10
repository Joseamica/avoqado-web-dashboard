import { expect, test, type Page } from '@playwright/test'
import { createAuthStatusResponse, createMockUser, createMockVenue, StaffRole } from '../../fixtures/mock-data'

const ORG_ID = 'org-catalog-import'

async function closeQueryDevtools(page: Page) {
  const closeButton = page.getByRole('button', { name: 'Close Tanstack query devtools' }).first()
  await closeButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
  if (await closeButton.isVisible()) await closeButton.click()
}

async function setupOwner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('avoqado_session_hint', 'true')
  })
  const venue = createMockVenue({
    id: 'venue-import',
    slug: 'catalog-import',
    organizationId: ORG_ID,
    organization: { id: ORG_ID, name: 'Grupo Importación' },
    role: StaffRole.OWNER,
  })
  const user = createMockUser(StaffRole.OWNER, [venue], {
    organizationId: ORG_ID,
    organizationMemberships: [{ organizationId: ORG_ID, organizationName: 'Grupo Importación', role: 'OWNER', masterCatalogVisible: true }],
  } as never)
  await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route(`**/api/v1/organizations/${ORG_ID}/stats`, route =>
    route.fulfill({ json: { id: ORG_ID, name: 'Grupo Importación', venueCount: 1, staffCount: 1 } }),
  )
  await page.route(`**/api/v1/organizations/${ORG_ID}/venues`, route => route.fulfill({ json: [venue] }))
  await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/access`, route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          organizationId: ORG_ID,
          orgRole: 'OWNER',
          entitlementActive: true,
          moduleActive: true,
          config: {
            schemaVersion: 1,
            catalogCoreEnabled: true,
            identifiersEnabled: false,
            regionalPricingEnabled: false,
            governanceMode: 'ADVISORY',
          },
          reasonCode: 'ACCESSIBLE',
          canRead: true,
          canMutateContent: true,
          canConfigureControlPlane: false,
        },
      },
    }),
  )
  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill({ json: createAuthStatusResponse(user) }))
}

test.describe('Master catalog import', () => {
  test('invalid workbook stays staged and exposes its durable error download', async ({ page }) => {
    await setupOwner(page)
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/imports/preview`, route =>
      route.fulfill({
        json: {
          success: true,
          data: {
            importBatchId: 'batch-invalid',
            canConfirm: false,
            previewToken: null,
            targetHash: 'a'.repeat(64),
            expiresAt: '2099-08-10T00:00:00.000Z',
            errors: [{ sheet: 'Items', row: 2, column: 'unit', code: 'CATALOG_FIELD_REQUIRED', message: 'Falta unidad' }],
            errorCount: 1,
            errorsTruncated: false,
            blockingReasons: [{ code: 'CATALOG_IMPORT_VALIDATION_FAILED', message: 'Hay filas inválidas' }],
          },
        },
      }),
    )
    await page.goto(`/organizations/${ORG_ID}/master-catalog/imports`)
    await closeQueryDevtools(page)
    await page
      .getByLabel('Archivo XLSX')
      .setInputFiles({
        name: 'catalogo.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('xlsx'),
      })
    await page.getByRole('button', { name: 'Revisar archivo' }).click()

    await expect(page.getByText('Falta unidad')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Descargar errores' })).toHaveAttribute(
      'href',
      `/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/imports/batch-invalid/errors.xlsx`,
    )
  })

  test('ready workbook has one final confirmation and sends the staged bearer once', async ({ page }) => {
    await setupOwner(page)
    let confirmations = 0
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/imports/preview`, route =>
      route.fulfill({
        json: {
          success: true,
          data: {
            importBatchId: 'batch-ready',
            canConfirm: true,
            previewToken: 'one-time-token',
            targetHash: 'b'.repeat(64),
            expiresAt: '2099-08-10T00:00:00.000Z',
            errors: [],
            errorCount: 0,
            errorsTruncated: false,
            blockingReasons: [],
          },
        },
      }),
    )
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/imports/batch-ready/confirm`, async route => {
      confirmations += 1
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ previewToken: 'one-time-token', confirm: true })
      expect(body.idempotencyKey).toMatch(/^catalog-import-/)
      await route.fulfill({ json: { success: true, data: { importBatchId: 'batch-ready', state: 'APPLIED', appliedItemIds: ['item-1'] } } })
    })
    await page.goto(`/organizations/${ORG_ID}/master-catalog/imports`)
    await closeQueryDevtools(page)
    await page
      .getByLabel('Archivo XLSX')
      .setInputFiles({
        name: 'catalogo.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('xlsx'),
      })
    await page.getByRole('button', { name: 'Revisar archivo' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar importación' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Confirmar importación' }).click()

    await expect(page.getByRole('status')).toContainText('Importación aplicada')
    expect(confirmations).toBe(1)
  })
})
