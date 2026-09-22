/**
 * E2E — HayCash, socio comercial: la tarjeta del Home y la de Integraciones abren
 * el alta del socio (con la atribución de Avoqado en la URL) en una pestaña nueva,
 * y sólo ADMIN+ la ve en el Home — el financiamiento es decisión del dueño.
 * App E2E locale is English.
 *
 * Set E2E_SCREENSHOT_DIR to also capture screenshots (visual QA).
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const HAYCASH_URL = 'https://haycash.com.mx/onboarding/Avoqado'
const HOME_CARD = '[data-tour="home-haycash-card"]'
const INTEGRATION_CARD = '[data-tour="integration-card-haycash"]'

const venue = () =>
  createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    permissions: ['home:read', 'venues:read', 'settings:read'],
  })

async function captureIfRequested(page: Page, selector: string, name: string) {
  const dir = process.env.E2E_SCREENSHOT_DIR
  if (!dir) return
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
  await page.locator(selector).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false })
}

/**
 * The link opens with `noopener`, so the popup's url() is still empty when the
 * `page` event fires; wait for its navigation instead. The partner's site is
 * stubbed so the test never touches the real network.
 */
async function expectPartnerPopup(context: BrowserContext, open: () => Promise<void>) {
  await context.route(`${HAYCASH_URL}**`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }))
  const popup = context.waitForEvent('page')
  await open()
  await (await popup).waitForURL(HAYCASH_URL)
}

test.describe('HayCash · socio comercial', () => {
  test('OWNER: the Home card opens the HayCash onboarding in a new tab', async ({ page, context }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()] })
    await page.goto('/venues/venue-alpha')
    const card = page.locator(HOME_CARD)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toContainText('HayCash')
    await captureIfRequested(page, HOME_CARD, 'home-haycash-light')

    // Nothing leaves the dashboard: the partner opens in a popup and the Home stays put.
    await expectPartnerPopup(context, () => card.getByRole('button').click())
    await expect(page).toHaveURL(/\/venues\/venue-alpha/)
  })

  test('OWNER: the Integrations catalog lists HayCash as a partner with the same link', async ({ page, context }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()] })
    await page.goto('/venues/venue-alpha/settings/integrations')
    const card = page.locator(INTEGRATION_CARD)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toContainText('Partner')
    await captureIfRequested(page, INTEGRATION_CARD, 'integrations-haycash-light')

    await expectPartnerPopup(context, () => card.getByRole('button').click())
  })

  test('MANAGER: the Home does not offer financing', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.MANAGER, venues: [venue()] })
    await page.goto('/venues/venue-alpha')
    // Anchor on a Home element that renders for every role before asserting absence,
    // so a blank page can't pass as "hidden".
    await expect(page.locator('[data-tour="home-chatbot-overview"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(HOME_CARD)).toHaveCount(0)
  })
})
