/**
 * E2E tests for the "Buy TPV" purchase wizard — Card (Stripe) happy path.
 *
 * Plan 1 · Task 28
 *
 * Covers:
 *   1. Walking through the 4-step wizard with the PAX A910S in cart and
 *      Card payment method — verifies the wizard POSTs the order and
 *      Stripe's hosted-checkout URL is what the app redirects to.
 *   2. Returning from Stripe's success_url (?session_id=…) lands on the
 *      order detail page; the 3-second poll flips the order from
 *      AWAITING_PAYMENT → PAID once the mock returns the new status.
 *   3. Stripe's cancel_url (?cancelled=true) on /tpv shows the
 *      "Pago cancelado" destructive toast.
 */

import { test, expect, Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE_ID = 'venue-alpha'
const VENUE_SLUG = 'venue-alpha'
const ORDER_ID = 'ord_test_1'

/**
 * Build a venue that has all the contact + shipping fields the wizard
 * pre-fills into Step 2. The default `createMockVenue` only sets `address`
 * and `city`, so we extend it here. The Venue type at runtime accepts the
 * extra fields — the `MockSessionVenue` interface is a subset of what the
 * dashboard actually consumes.
 */
function buildTpvVenue() {
  return createMockVenue({
    id: VENUE_ID,
    name: 'Restaurante Alpha',
    slug: VENUE_SLUG,
    address: 'Av. Reforma 100',
    city: 'Ciudad de México',
    // Extra fields the wizard reads from venue but aren't in MockSessionVenue
    ...({
      email: 'alpha@avoqado.io',
      phone: '+52 55 1234 5678',
      state: 'CDMX',
      country: 'México',
      zipCode: '06600',
    } as Record<string, unknown>),
  })
}

/** Mock order payload returned by GET /tpv-orders/:id. */
function makeOrder(opts: { paid?: boolean } = {}) {
  const paid = opts.paid ?? false
  return {
    id: ORDER_ID,
    orderNumber: 'AVO-0001',
    venueId: VENUE_ID,
    currency: 'MXN',
    subtotalCents: 400_000,
    taxCents: 64_000,
    totalCents: 464_000,
    paymentMethod: 'CARD_STRIPE',
    paymentStatus: paid ? 'PAID' : 'AWAITING_PAYMENT',
    fulfillmentStatus: paid ? 'AWAITING_SERIALS' : 'NEW',
    items: [
      {
        id: 'oi_1',
        brand: 'PAX',
        model: 'A910S',
        productName: 'PAX A910S',
        quantity: 1,
        unitPriceCents: 400_000,
        namePrefix: 'PAX A910S',
      },
    ],
    terminals: [],
    contactName: 'Restaurante Alpha',
    contactEmail: 'alpha@avoqado.io',
    contactPhone: '+52 55 1234 5678',
    shippingAddress: 'Av. Reforma 100',
    shippingAddress2: null,
    shippingCity: 'Ciudad de México',
    shippingState: 'CDMX',
    shippingZip: '06600',
    shippingCountry: 'México',
    stripeReceiptUrl: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  }
}

async function setupTpvMocks(page: Page) {
  const venue = buildTpvVenue()
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  // GET /tpv-orders list (empty by default)
  await page.route('**/api/v1/dashboard/venues/*/tpv-orders', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    }
    return route.fallback()
  })
}

test.describe('Buy TPV — Card flow', () => {
  test('creates an order and redirects to Stripe', async ({ page }) => {
    await setupTpvMocks(page)

    // Override the POST /tpv-orders route to return a Stripe redirectUrl.
    // Registered last → LIFO matches it first for the POST request.
    await page.route('**/api/v1/dashboard/venues/*/tpv-orders', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback()
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: ORDER_ID,
            orderNumber: 'AVO-0001',
            redirectUrl: 'https://checkout.stripe.com/mock/cs_test_123',
          },
        }),
      })
    })

    // Stub the Stripe redirect target so Playwright does not actually
    // navigate to checkout.stripe.com (which would be a real network call).
    let redirectedUrl: string | null = null
    await page.route('https://checkout.stripe.com/**', async (route) => {
      redirectedUrl = route.request().url()
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>mock stripe</body></html>',
      })
    })

    await page.goto(`/venues/${VENUE_SLUG}/tpv`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Open the wizard — "Nuevo dispositivo" / "Create New"
    const openWizardBtn = page.locator('[data-tour="tpv-new-btn"]')
    await expect(openWizardBtn).toBeVisible({ timeout: 10_000 })
    await openWizardBtn.click()

    // Step 1 — Add PAX A910S to cart
    const addToCart = page.locator('[data-tour="tpv-cart-add-a910s"]')
    await expect(addToCart).toBeVisible({ timeout: 5_000 })
    await addToCart.click()
    await expect(page.locator('[data-tour="tpv-cart-summary"]')).toContainText('PAX A910S')

    // Advance to Step 2
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 2 — shipping (pre-filled from venue). Wait for the form to
    // render then advance. We don't fill anything — venue data already did.
    await expect(page.getByLabel(/correo|email/i).first()).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 3 — Card is the default; just advance.
    await expect(page.locator('[data-tour="tpv-payment-card"]')).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 4 — accept terms + confirm.
    const termsCheckbox = page.getByRole('checkbox').first()
    await expect(termsCheckbox).toBeVisible({ timeout: 5_000 })
    await termsCheckbox.click()

    // Click confirm and wait for the Stripe redirect to fire.
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Give the redirect handler a moment to capture the request.
    await expect.poll(() => redirectedUrl, { timeout: 5_000 }).toContain('checkout.stripe.com')
    expect(redirectedUrl).toContain('cs_test_123')
  })

  test('returning from Stripe success_url shows the order in PAID state after polling', async ({ page }) => {
    await setupTpvMocks(page)

    // Counter so the second call returns PAID, mimicking the webhook
    // having flipped the status server-side.
    let callCount = 0
    await page.route(`**/api/v1/dashboard/venues/*/tpv-orders/${ORDER_ID}`, async (route) => {
      callCount++
      const paid = callCount > 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeOrder({ paid }) }),
      })
    })

    await page.goto(
      `/venues/${VENUE_SLUG}/tpv/orders/${ORDER_ID}?session_id=cs_test_123`,
    )

    // Order number visible
    await expect(page.getByText('AVO-0001')).toBeVisible({ timeout: 10_000 })

    // Initially "Esperando pago" / "Awaiting payment"
    await expect(page.getByText(/esperando pago|awaiting payment/i).first()).toBeVisible({
      timeout: 5_000,
    })

    // After the 3-second poll, status should flip to "Pagado" / "Paid".
    // refetchInterval = 3s, so wait up to 10s to be safe.
    await expect(page.getByText(/^pagado$|^paid$/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('cancel from Stripe shows toast on /tpv', async ({ page }) => {
    await setupTpvMocks(page)
    await page.goto(`/venues/${VENUE_SLUG}/tpv?cancelled=true`)

    // The toast renders both visible + screen-reader copies of the title,
    // so multiple nodes match — assert the first is visible.
    await expect(page.getByText(/pago cancelado|payment cancelled/i).first()).toBeVisible({
      timeout: 8_000,
    })
  })
})
