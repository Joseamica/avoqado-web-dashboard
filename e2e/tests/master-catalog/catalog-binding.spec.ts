import { expect, test, type Page } from '@playwright/test'
import { createAuthStatusResponse, createMockUser, createMockVenue, StaffRole } from '../../fixtures/mock-data'

const ORG_ID = 'org-catalog-binding'

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
    id: 'venue-binding',
    slug: 'catalog-binding',
    organizationId: ORG_ID,
    organization: { id: ORG_ID, name: 'Grupo Asignaciones' },
    role: StaffRole.OWNER,
  })
  const user = createMockUser(StaffRole.OWNER, [venue], {
    organizationId: ORG_ID,
    organizationMemberships: [
      { organizationId: ORG_ID, organizationName: 'Grupo Asignaciones', role: 'OWNER', masterCatalogVisible: true },
    ],
  } as never)
  await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route(`**/api/v1/organizations/${ORG_ID}/stats`, route =>
    route.fulfill({ json: { id: ORG_ID, name: 'Grupo Asignaciones', venueCount: 1, staffCount: 1 } }),
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

async function fillTarget(page: Page) {
  await page.getByLabel('ID del artículo').fill('item-1')
  await page.getByLabel('ID de la sucursal').fill('venue-binding')
}

test.describe('Master catalog bindings', () => {
  test('conflict remains non-confirmable and exposes LINK, CREATE and SKIP proposals', async ({ page }) => {
    await setupOwner(page)
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/bindings/preview`, route =>
      route.fulfill({
        json: {
          success: true,
          data: {
            bindingBatchId: 'binding-conflict',
            previewToken: 'binding-token',
            targetHash: 'c'.repeat(64),
            expiresAt: '2099-08-10T00:00:00.000Z',
            canConfirm: false,
            lines: [
              {
                catalogItemId: 'item-1',
                venueId: 'venue-binding',
                proposal: 'LINK',
                decision: null,
                status: 'READY',
                errorCode: null,
                candidates: [],
                readiness: 'READY',
              },
              {
                catalogItemId: 'item-2',
                venueId: 'venue-binding',
                proposal: 'CREATE',
                decision: null,
                status: 'READY',
                errorCode: null,
                candidates: [],
                readiness: 'NOT_REQUIRED',
              },
              {
                catalogItemId: 'item-3',
                venueId: 'venue-binding',
                proposal: 'SKIP',
                decision: null,
                status: 'CONFLICT',
                errorCode: 'CATALOG_BINDING_CONFLICT',
                candidates: [],
                readiness: 'INVALID',
              },
            ],
          },
        },
      }),
    )
    await page.goto(`/organizations/${ORG_ID}/master-catalog/bindings`)
    await closeQueryDevtools(page)
    await fillTarget(page)
    await page.getByRole('button', { name: 'Preparar asignaciones' }).click()

    const proposals = page.getByRole('table', { name: 'Propuestas de asignación' })
    await expect(proposals).toContainText('LINK')
    await expect(proposals).toContainText('CREATE')
    await expect(proposals).toContainText('SKIP')
    await expect(page.getByRole('button', { name: 'Confirmar asignaciones' })).toBeDisabled()
  })

  test('ready preview confirms exactly once with its bearer', async ({ page }) => {
    await setupOwner(page)
    let confirmations = 0
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/bindings/preview`, route =>
      route.fulfill({
        json: {
          success: true,
          data: {
            bindingBatchId: 'binding-ready',
            previewToken: 'binding-token',
            targetHash: 'd'.repeat(64),
            expiresAt: '2099-08-10T00:00:00.000Z',
            canConfirm: true,
            lines: [
              {
                catalogItemId: 'item-1',
                venueId: 'venue-binding',
                proposal: 'SKIP',
                decision: { decision: 'SKIP' },
                status: 'READY',
                errorCode: null,
                candidates: [],
                readiness: 'NOT_REQUIRED',
              },
            ],
          },
        },
      }),
    )
    await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/bindings/confirm`, async route => {
      confirmations += 1
      expect(route.request().postDataJSON()).toMatchObject({
        bindingBatchId: 'binding-ready',
        previewToken: 'binding-token',
        confirm: true,
      })
      await route.fulfill({ json: { success: true, data: { bindingBatchId: 'binding-ready', state: 'APPLIED', lines: [] } } })
    })
    await page.goto(`/organizations/${ORG_ID}/master-catalog/bindings`)
    await closeQueryDevtools(page)
    await fillTarget(page)
    await page.getByRole('button', { name: 'Preparar asignaciones' }).click()
    await page.getByRole('button', { name: 'Confirmar asignaciones' }).click()

    await expect(page.getByRole('status')).toHaveText('APPLIED')
    expect(confirmations).toBe(1)
  })
})
