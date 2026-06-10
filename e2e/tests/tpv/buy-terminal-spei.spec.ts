/**
 * E2E tests for the "Buy TPV" purchase wizard — SPEI (bank transfer) flow.
 *
 * Plan 2 · Task 15
 *
 * Covers:
 *   1. Walking through the 4-step wizard with the PAX A910S in cart and
 *      SPEI payment method — verifies the wizard POSTs the order with no
 *      redirectUrl and lands on the order detail page, where the bank
 *      details (CLABE, beneficiary) are visible.
 *   2. Uploading a comprobante on the detail page flips the UI from
 *      AWAITING_PROOF → PROOF_UPLOADED once the mocked endpoint resolves
 *      and the query re-fetches.
 *
 * NOTE: the magic-link approve/reject pages (`/admin/tpv-orders/:id/approve`)
 * do NOT live in this repo. They were moved to the avoqado-superadmin app
 * (src/features/tpv-orders/ApproveTpvOrderPage.tsx, routed in its router.tsx)
 * one day after this spec was written — sales staff open them from the email
 * magic link against SUPERADMIN_URL (see avoqado-server
 * src/services/dashboard/terminalOrder/urls.ts). The original test 3 here
 * permanently 404'd against the dashboard and was removed; coverage belongs
 * in avoqado-superadmin.
 */

import { test, expect, Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE_ID = 'venue-alpha'
const VENUE_SLUG = 'venue-alpha'
const ORDER_ID = 'ord_spei_1'

/**
 * Same venue as the card test — pre-filled contact + shipping so
 * Step 2 of the wizard can advance without user input.
 */
function buildTpvVenue() {
  return createMockVenue({
    id: VENUE_ID,
    name: 'Restaurante Alpha',
    slug: VENUE_SLUG,
    address: 'Av. Reforma 100',
    city: 'Ciudad de México',
    ...({
      email: 'alpha@avoqado.io',
      phone: '+52 55 1234 5678',
      state: 'CDMX',
      country: 'México',
      zipCode: '06600',
    } as Record<string, unknown>),
  })
}

/** Build a SPEI order payload for GET /tpv-orders/:id. */
function makeSpeiOrder(opts: { paymentStatus?: 'AWAITING_PROOF' | 'PROOF_UPLOADED' } = {}) {
  const paymentStatus = opts.paymentStatus ?? 'AWAITING_PROOF'
  return {
    id: ORDER_ID,
    orderNumber: 'AVO-0002',
    venueId: VENUE_ID,
    currency: 'MXN',
    subtotalCents: 400_000,
    taxCents: 64_000,
    totalCents: 464_000,
    paymentMethod: 'SPEI' as const,
    paymentStatus,
    fulfillmentStatus: 'NEW' as const,
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
    speiRecipient: {
      beneficiary: 'SERVICIOS TECNOLOGICOS AVO SA DE CV',
      clabe: '699180600007741022',
      bank: 'STP',
      rfc: 'STA241210PW8',
    },
  }
}

async function setupSpeiMocks(page: Page) {
  const venue = buildTpvVenue()
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  // GET /tpv-orders list (empty by default — the Pedidos tab shows nothing)
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

test.describe('Buy TPV — SPEI flow', () => {
  test('creates a SPEI order and shows bank details on the detail page', async ({ page }) => {
    await setupSpeiMocks(page)

    // POST /tpv-orders for SPEI returns redirectUrl: null + orderId we navigate to.
    // Registered AFTER the catch-all GET above → LIFO matches POST first.
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
            orderNumber: 'AVO-0002',
            redirectUrl: null,
          },
        }),
      })
    })

    // GET /tpv-orders/:id returns the SPEI order with bank details.
    await page.route(`**/api/v1/dashboard/venues/*/tpv-orders/${ORDER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeSpeiOrder() }),
      })
    })

    await page.goto(`/venues/${VENUE_SLUG}/tpv`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    // Open the wizard
    const openWizardBtn = page.locator('[data-tour="tpv-new-btn"]')
    await expect(openWizardBtn).toBeVisible({ timeout: 10_000 })
    await openWizardBtn.click()

    // Step 1 — Add PAX A910S to cart
    const addToCart = page.locator('[data-tour="tpv-cart-add-a910s"]')
    await expect(addToCart).toBeVisible({ timeout: 5_000 })
    await addToCart.click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 2 — shipping pre-filled, just advance
    await expect(page.getByLabel(/correo|email/i).first()).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 3 — pick SPEI instead of the default Card.
    await expect(page.locator('[data-tour="tpv-payment-spei"]')).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-tour="tpv-payment-spei"]').click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Step 4 — accept terms + confirm.
    const termsCheckbox = page.getByRole('checkbox').first()
    await expect(termsCheckbox).toBeVisible({ timeout: 5_000 })
    await termsCheckbox.click()
    await page.locator('[data-tour="tpv-wizard-next"]').click()

    // Should land on the order detail page (no Stripe redirect).
    await expect(page).toHaveURL(new RegExp(`/tpv/orders/${ORDER_ID}`), { timeout: 10_000 })

    // Bank details visible
    await expect(page.getByText('699180600007741022')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('SERVICIOS TECNOLOGICOS AVO SA DE CV')).toBeVisible()
  })

  test('uploading comprobante flips status to PROOF_UPLOADED', async ({ page }) => {
    await setupSpeiMocks(page)

    // The GET returns AWAITING_PROOF until `uploaded` flips to true,
    // mimicking the server-side state change. React Query re-fetches
    // after the upload mutation invalidates the cache.
    let uploaded = false
    await page.route(`**/api/v1/dashboard/venues/*/tpv-orders/${ORDER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: makeSpeiOrder({
            paymentStatus: uploaded ? 'PROOF_UPLOADED' : 'AWAITING_PROOF',
          }),
        }),
      })
    })

    // POST /upload-proof flips the flag and resolves.
    await page.route(
      `**/api/v1/dashboard/venues/*/tpv-orders/${ORDER_ID}/upload-proof`,
      async (route) => {
        uploaded = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: ORDER_ID, paymentStatus: 'PROOF_UPLOADED' },
          }),
        })
      },
    )

    await page.goto(`/venues/${VENUE_SLUG}/tpv/orders/${ORDER_ID}`)

    // Dropzone visible (means we're in AWAITING_PROOF state).
    await expect(
      page.getByText(/arrastra el comprobante|drag your receipt/i).first(),
    ).toBeVisible({ timeout: 10_000 })

    // Use the hidden file input directly (the dropzone wraps it).
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'comprobante.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock'),
    })

    // UI should flip to PROOF_UPLOADED — look for the confirmation message.
    await expect(
      page.getByText(/recibimos tu comprobante|we received your receipt/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  // The former "magic-link approve page" test lived here. That page belongs
  // to the avoqado-superadmin app (see file header note) — testing it against
  // the dashboard can only ever render the 404 page.
})
