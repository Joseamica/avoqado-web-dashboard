import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole } from '../../fixtures/mock-data'

/**
 * Happy-path E2E for the "Agregar AngelPay" wizard.
 *
 * NOTE: written without an iterative run — if a selector misses, run
 * `npm run test:e2e -- angelpay-wizard` and adjust. The wizard uses hardcoded
 * Spanish (superadmin screens are i18n-exempt) so text selectors are stable.
 */

const MOCK_VENUE = {
  id: 'venue-ap-1',
  name: 'Venue AngelPay Test',
  slug: 'venue-angelpay-test',
  email: 'venue@test.io',
  address: '',
  phone: '',
  active: true,
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  revenue: 0,
  commission: 0,
  transactionCount: 0,
}

function jsonRoute(body: unknown, status = 200) {
  return (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/** Register wizard-specific mocks AFTER setupApiMocks (LIFO — later wins). */
async function setupWizardMocks(page: Page): Promise<{ getCapturedPayload: () => unknown }> {
  await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN })

  let capturedPayload: unknown = null

  // Merchant-accounts list (the page itself) — empty.
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts'),
    jsonRoute({ data: [] }),
  )
  // Venues list (venue step).
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/venues'),
    jsonRoute({ data: [MOCK_VENUE] }),
  )
  // Existing AngelPay logins for the venue — none.
  await page.route(
    url => url.pathname.includes('/angelpay-accounts'),
    jsonRoute({ data: [] }),
  )
  // Venue terminals — none.
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/terminals'),
    jsonRoute({ data: [] }),
  )
  // Venue payment config — none (404 => PRIMARY slot is free).
  await page.route(
    url => url.pathname.includes('/venue-pricing/config/'),
    jsonRoute({ message: 'not found' }, 404),
  )
  // The transactional endpoint — capture the payload, return success.
  await page.route(
    url => url.pathname.endsWith('/full-setup-angelpay'),
    route => {
      capturedPayload = route.request().postDataJSON()
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            merchantAccountId: 'ma-new-1',
            angelpayUserAccountId: 'login-new-1',
            venuePaymentConfigUpdated: true,
            terminalIds: [],
            settlementIds: [],
          },
          message: 'Cuenta AngelPay configurada exitosamente',
        }),
      })
    },
  )

  return { getCapturedPayload: () => capturedPayload }
}

test.describe('AngelPay wizard', () => {
  test('creates an AngelPay account through the full happy path', async ({ page }) => {
    const { getCapturedPayload } = await setupWizardMocks(page)

    await page.goto('/superadmin/merchant-accounts')
    const openBtn = page.getByRole('button', { name: 'Agregar AngelPay' })
    await expect(openBtn).toBeVisible({ timeout: 15_000 })
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
    await openBtn.click()

    // Wizard opened.
    await expect(page.getByRole('heading', { name: 'Agregar cuenta AngelPay' })).toBeVisible()

    const next = () => page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 1 — Venue.
    await page.getByRole('button', { name: MOCK_VENUE.name }).click()
    await next()

    // Step 2 — Login (new).
    await page.getByRole('button', { name: /Conectar una cuenta nueva/ }).click()
    await page.getByPlaceholder('correo@ejemplo.com').fill('nuevo@avoqado.io')
    await page.getByPlaceholder('123456').fill('123456')
    await next()

    // Step 3 — Merchant.
    await page.getByPlaceholder('9814275').fill('9814275')
    await page.getByPlaceholder('Núm. de afiliación').fill('AF-001')
    await page.getByPlaceholder('Nombre del comercio').fill('Comercio Test')
    await page.getByRole('checkbox').check() // confirm-id checkbox
    await next()

    // Step 4 — Slot (PRIMARY default, free).
    await next()

    // Steps 5-8 — Terminals, Cost, Pricing, Settlement (optional, skip through).
    await next()
    await next()
    await next()
    await next()

    // Step 9 — Summary → Confirm.
    await page.getByRole('button', { name: /Confirmar y crear/ }).click()

    // The transactional endpoint received the request.
    await expect.poll(() => getCapturedPayload(), { timeout: 10_000 }).not.toBeNull()
    const payload = getCapturedPayload() as Record<string, any>
    expect(payload.venueId).toBe(MOCK_VENUE.id)
    expect(payload.login.mode).toBe('new')
    expect(payload.login.email).toBe('nuevo@avoqado.io')
    expect(payload.merchant.externalMerchantId).toBe('9814275')
    expect(payload.slot.accountType).toBe('PRIMARY')
    expect(payload.slot.mode).toBe('fill')
  })

  test('does not show the wizard until the button is clicked', async ({ page }) => {
    await setupWizardMocks(page)
    await page.goto('/superadmin/merchant-accounts')
    await expect(page.getByRole('button', { name: 'Agregar AngelPay' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Agregar cuenta AngelPay' })).toHaveCount(0)
  })
})
