/**
 * E2E — External charges to confirm & incidents (§external route phase 1, Task 15).
 *
 * Covers the two read-only work queues that make the external settlement route
 * operable: unconfirmed external-route charges and open incidents. App E2E locale
 * is English (see settings-hub.spec.ts) — except the pre-existing Settings/AreaTickets
 * "Areas" tab trigger, which is hardcoded Spanish text in that file already (not
 * introduced by this task; out of scope to relocalize here).
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

/**
 * Close TanStack Query DevTools if open, then hide via CSS as fallback. Its
 * floating panel intercepts pointer events on anything underneath it (mirrors the
 * same helper in settings-hub.spec.ts and e2e/tests/auth/login.spec.ts).
 */
async function closeTanStackDevTools(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'area-tickets:configure'],
})

const AREA = { id: 'area_1', name: 'Cremería' }

const OVERVIEW = {
  entitlements: { areaTickets: true, scaleIntegration: false, variableWeightBarcode: false },
  effective: { areaTickets: true, scales: false, variableWeightBarcode: false },
  settings: {
    enabled: true,
    allowMixedCart: true,
    claimTtlSeconds: 300,
    checkoutSessionMaxAgeMinutes: 30,
    ticketExpiryPolicy: 'BUSINESS_DAY_CLOSE',
    ticketExpiryMinutes: null,
    deliveryVerificationMode: 'PAPER_OR_SCAN',
    codeSymbology: 'CODE128',
    requireManagerForCancel: true,
    recordWasteOnCancel: false,
    inventoryReservationMode: 'NONE',
  },
  scaleSettings: { enabled: false, variableBarcodeEnabled: false, variableBarcodePrefix: '20' },
  areas: [
    {
      id: AREA.id,
      name: AREA.name,
      fulfillmentMode: 'HOLD_UNTIL_PAID',
      printStationId: null,
      active: true,
      displayOrder: 0,
      settlementRoute: 'EXTERNAL',
      externalConfirmationMode: 'MANUAL',
      externalOfflinePolicy: 'BLOCK',
      externalDeliveryTracking: 'TRACKED',
      _count: { terminals: 1, areaTickets: 3 },
    },
  ],
  terminals: [],
  scaleProfiles: [],
  operations: { tickets: {}, checkouts: {}, paymentReconciliationCount: 0 },
}

const SETTLEMENT_ITEM = {
  id: 'settlement_1',
  status: 'PENDING',
  handoffState: 'HANDED_OFF',
  confirmationMode: 'MANUAL',
  referenceAmount: '150.00',
  externalAmount: null,
  variance: null,
  externalReference: null,
  notes: null,
  createdAt: '2026-08-01T12:00:00.000Z',
  confirmedAt: null,
  confirmedBy: null,
  terminal: null,
  areaTicket: { id: 'ticket_1', code: 'CRE-000123', issuedAt: '2026-08-01T12:00:00.000Z' },
  area: AREA,
}

test.describe('External settlements & incidents queues', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })

    // Specific routes registered AFTER setupApiMocks' catch-all, so they win
    // (Playwright routes are LIFO — last registered checked first).
    await page.route('**/api/v1/dashboard/venues/*/area-tickets', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: OVERVIEW }) }),
    )
    await page.route('**/api/v1/dashboard/venues/*/area-tickets/external-settlements**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [SETTLEMENT_ITEM], nextCursor: null } }),
      }),
    )
    await page.route('**/api/v1/dashboard/venues/*/area-tickets/external-incidents**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], nextCursor: null } }),
      }),
    )
  })

  test('is reachable from the area-tickets settings page (discoverability link)', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings/area-tickets')
    await closeTanStackDevTools(page)
    // Pre-existing tab trigger, hardcoded Spanish in Settings/AreaTickets.tsx — see file header.
    await page.getByRole('tab', { name: 'Áreas' }).click()

    await page.getByRole('button', { name: /view charges to confirm and incidents/i }).click()
    await page.waitForURL('**/settings/area-tickets/external-settlements**', { timeout: 15_000 })

    await expect(page.getByRole('heading', { name: /external charges/i })).toBeVisible()
  })

  test('labels the amount as reference — never as paid — with the settlements tab active by default', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings/area-tickets/external-settlements')
    await closeTanStackDevTools(page)

    // No hash on a fresh load → the settlements tab is the internal default (same
    // read-only-until-clicked hash convention as CommissionsPage.tsx); it only writes
    // the hash back once the user actively switches tabs (covered below).
    await expect(page.getByText(/reference amount/i).first()).toBeVisible()
    await expect(page.getByText(/^paid$/i)).toHaveCount(0)
    await expect(page.getByText('CRE-000123')).toBeVisible()
  })

  test('the two tabs are pill-styled, switch on click, and persist the active tab in the URL hash across reload', async ({
    page,
  }) => {
    await page.goto('/venues/venue-alpha/settings/area-tickets/external-settlements')
    await closeTanStackDevTools(page)

    const settlementsTab = page.getByRole('tab', { name: 'Charges to confirm' })
    const incidentsTab = page.getByRole('tab', { name: 'Incidents' })
    await expect(settlementsTab).toHaveClass(/rounded-full/)
    await expect(incidentsTab).toHaveClass(/rounded-full/)

    await incidentsTab.click()
    await expect(page).toHaveURL(/#incidents$/)
    await expect(page.getByText(/no incidents are open/i)).toBeVisible()

    // Hash survives a hard reload — proves the tab is read from the URL, not just component state.
    await page.reload()
    await expect(page).toHaveURL(/#incidents$/)
    await expect(page.getByText(/no incidents are open/i)).toBeVisible()
  })
})
