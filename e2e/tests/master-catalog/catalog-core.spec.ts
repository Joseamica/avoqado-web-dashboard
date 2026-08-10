import { expect, test, type Page } from '@playwright/test'
import { createAuthStatusResponse, createMockUser, createMockVenue, StaffRole } from '../../fixtures/mock-data'

const ORG_ID = 'org-catalog-e2e'

async function setupCatalog(page: Page, role: StaffRole.OWNER | StaffRole.VIEWER) {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
    localStorage.setItem('avoqado_session_hint', 'true')
  })
  const venue = createMockVenue({
    id: 'venue-catalog',
    slug: 'catalog-venue',
    organizationId: ORG_ID,
    organization: { id: ORG_ID, name: 'Grupo Catálogo' },
    role,
  })
  const user = createMockUser(role, [venue], {
    organizationId: ORG_ID,
    organizationMemberships: [{ organizationId: ORG_ID, organizationName: 'Grupo Catálogo', role, masterCatalogVisible: true }],
  } as never)

  await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route(`**/api/v1/organizations/${ORG_ID}/venues`, route => route.fulfill({ json: [venue] }))
  await page.route(`**/api/v1/organizations/${ORG_ID}/stats`, route =>
    route.fulfill({ json: { id: ORG_ID, name: 'Grupo Catálogo', venueCount: 1, staffCount: 1 } }),
  )
  await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/access`, route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          organizationId: ORG_ID,
          orgRole: role,
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
          canMutateContent: role === StaffRole.OWNER,
          canConfigureControlPlane: false,
        },
      },
    }),
  )
  await page.route(`**/api/v1/dashboard/organizations/${ORG_ID}/master-catalog/items*`, route =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: 'item-1',
              sku: '000123',
              name: 'Jarabe de agave',
              kind: 'RETAIL_PRODUCT',
              status: 'ACTIVE',
              revision: 1,
              bindingSummary: { total: 2 },
            },
          ],
          nextCursor: null,
        },
      },
    }),
  )
  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill({ json: createAuthStatusResponse(user) }))
}

test.describe('Master catalog items', () => {
  test('OWNER navigates the real catalog shell and preserves text SKUs', async ({ page }) => {
    await setupCatalog(page, StaffRole.OWNER)
    await page.goto(`/organizations/${ORG_ID}/master-catalog/items`)

    await expect(page.getByRole('heading', { name: 'Artículos corporativos' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Artículos corporativos' })).toContainText('000123')
    await expect(page.getByRole('link', { name: 'Crear artículo' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Importar' })).toHaveAttribute('href', `/organizations/${ORG_ID}/master-catalog/imports`)
  })

  test('VIEWER sees the same tenant data without mutation actions', async ({ page }) => {
    await setupCatalog(page, StaffRole.VIEWER)
    await page.goto(`/organizations/${ORG_ID}/master-catalog/items`)

    await expect(page.getByRole('table', { name: 'Artículos corporativos' })).toContainText('Jarabe de agave')
    await expect(page.getByRole('link', { name: 'Crear artículo' })).toHaveCount(0)
  })
})
