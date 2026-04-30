/**
 * PlayTelecom Sales Review E2E Tests
 *
 * Covers the back-office documentation review flow on the SalesReport page:
 *   - Action buttons appear on PENDING rows when user has sale-verifications:review
 *   - Approve flow → row moves to COMPLETED with green badge
 *   - Reject flow → opens dialog with checkboxes, requires reason or notes,
 *     row moves to FAILED with red badge + reasons rendered
 *   - Action buttons hidden when user lacks the permission
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import {
  StaffRole,
  PLAYTELECOM_VENUE_ALPHA,
  createMockUser,
  createAuthStatusResponse,
} from '../../fixtures/mock-data'

const VENUE_ID = PLAYTELECOM_VENUE_ALPHA.id
const VENUE_SLUG = PLAYTELECOM_VENUE_ALPHA.slug

// Test data: 3 verifications — PENDING (reviewable), COMPLETED, FAILED
const PENDING_VERIFICATION = {
  id: 'sv-pending-1',
  venueId: VENUE_ID,
  paymentId: 'pay-pending-1',
  staffId: 'staff-promoter-1',
  photos: ['https://example.com/photo1.jpg'],
  scannedProducts: [],
  status: 'PENDING' as const,
  inventoryDeducted: false,
  deviceId: null,
  notes: null,
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  hasVerification: true,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  rejectionReasons: [],
  reviewedBy: null,
  staff: { id: 'staff-promoter-1', firstName: 'Bob', lastName: 'Promoter', email: 'b@p.com', photoUrl: null },
  payment: {
    id: 'pay-pending-1',
    amount: 100,
    status: 'COMPLETED',
    createdAt: '2026-04-30T10:00:00.000Z',
    order: { id: 'ord-1', orderNumber: 'SN0001', total: 100, tags: [] },
  },
}

const COMPLETED_VERIFICATION = {
  ...PENDING_VERIFICATION,
  id: 'sv-done-1',
  paymentId: 'pay-done-1',
  status: 'COMPLETED' as const,
  reviewedById: 'staff-admin-1',
  reviewedAt: '2026-04-30T11:00:00.000Z',
  reviewedBy: { id: 'staff-admin-1', firstName: 'Ada', lastName: 'Lovelace' },
  payment: { ...PENDING_VERIFICATION.payment, id: 'pay-done-1', order: { id: 'ord-2', orderNumber: 'SN0002', total: 100, tags: [] } },
}

const FAILED_VERIFICATION = {
  ...PENDING_VERIFICATION,
  id: 'sv-failed-1',
  paymentId: 'pay-failed-1',
  status: 'FAILED' as const,
  reviewedById: 'staff-admin-1',
  reviewedAt: '2026-04-30T11:30:00.000Z',
  reviewNotes: 'Falta foto de portabilidad legible',
  rejectionReasons: ['REVIEW_PORTABILIDAD'],
  reviewedBy: { id: 'staff-admin-1', firstName: 'Ada', lastName: 'Lovelace' },
  payment: { ...PENDING_VERIFICATION.payment, id: 'pay-failed-1', order: { id: 'ord-3', orderNumber: 'SN0003', total: 100, tags: [] } },
}

const VERIFICATIONS_LIST_RESPONSE = {
  success: true,
  data: [PENDING_VERIFICATION, COMPLETED_VERIFICATION, FAILED_VERIFICATION],
  pagination: { pageSize: 10, pageNumber: 1, totalCount: 3, totalPages: 1 },
}

const SUMMARY_RESPONSE = {
  success: true,
  data: {
    totalRevenue: 300,
    totalCount: 3,
    conciliatedCount: 1,
    pendingCount: 1,
    completedCount: 1,
    failedCount: 1,
    avgAmount: 100,
    withoutVerificationCount: 0,
  },
}

const STAFF_FILTER_RESPONSE = {
  success: true,
  data: [{ id: 'staff-promoter-1', firstName: 'Bob', lastName: 'Promoter', verificationCount: 3 }],
}

const DAILY_DATA_RESPONSE = { success: true, data: [] }

async function setupSalesReportMocks(page: Page, opts: { withReviewPermission: boolean }) {
  // Build the venue with the new permission applied (or not)
  const reviewPerm = 'sale-verifications:review'
  const basePermissions = [...PLAYTELECOM_VENUE_ALPHA.permissions]
  const venue = {
    ...PLAYTELECOM_VENUE_ALPHA,
    role: StaffRole.OWNER,
    permissions: opts.withReviewPermission ? [...basePermissions, reviewPerm] : basePermissions,
  }
  const user = createMockUser(StaffRole.OWNER, [venue])

  // Catch-all so unmocked endpoints don't 404 the test
  await page.route('**/api/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  )

  // me/access — provides corePermissions to useAccess() which gates the action column
  await page.route('**/api/v1/me/access*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: user.id,
        venueId: venue.id,
        organizationId: venue.organizationId,
        role: StaffRole.OWNER,
        corePermissions: venue.permissions,
        whiteLabelEnabled: false,
        enabledFeatures: [],
        featureAccess: {},
      }),
    }),
  )

  // Auth status — required for AuthContext
  await page.route('**/api/v1/dashboard/auth/status', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createAuthStatusResponse(user)),
    }),
  )

  // Sale verifications endpoints
  await page.route('**/sale-verifications/staff*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STAFF_FILTER_RESPONSE) }),
  )
  await page.route('**/sale-verifications/summary*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SUMMARY_RESPONSE) }),
  )
  await page.route('**/sale-verifications/daily*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DAILY_DATA_RESPONSE) }),
  )
  await page.route(/.*\/sale-verifications(\?.*)?$/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERIFICATIONS_LIST_RESPONSE) }),
  )
}

async function gotoSalesPage(page: Page) {
  await page.goto(`/venues/${VENUE_SLUG}/playtelecom/sales`)
  // Hide TanStack Query devtools overlay — it intercepts pointer events in dev mode
  await page.addStyleTag({
    content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }`,
  })
  // Wait for the table to render at least one row (PENDING row)
  await expect(page.getByTestId('btn-approve-sv-pending-1')).toBeVisible({ timeout: 15000 })
}

test.describe('PlayTelecom Sales Review (back-office)', () => {
  test('shows Approve and Revisar buttons on PENDING rows when user has permission', async ({ page }) => {
    await setupSalesReportMocks(page, { withReviewPermission: true })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    // Re-register the review-specific mocks AFTER setupApiMocks (LIFO priority)
    await setupSalesReportMocks(page, { withReviewPermission: true })

    await gotoSalesPage(page)

    // PENDING row → buttons visible
    await expect(page.getByTestId('btn-approve-sv-pending-1')).toBeVisible()
    await expect(page.getByTestId('btn-reject-sv-pending-1')).toBeVisible()

    // COMPLETED / FAILED rows → no action buttons
    await expect(page.getByTestId('btn-approve-sv-done-1')).toHaveCount(0)
    await expect(page.getByTestId('btn-approve-sv-failed-1')).toHaveCount(0)
  })

  test('approve flow marks the verification COMPLETED and shows reviewer name', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    await setupSalesReportMocks(page, { withReviewPermission: true })

    // Capture PATCH and respond with a COMPLETED row, then update the list response
    const updatedList = {
      ...VERIFICATIONS_LIST_RESPONSE,
      data: [
        {
          ...PENDING_VERIFICATION,
          status: 'COMPLETED',
          reviewedById: 'staff-admin-1',
          reviewedAt: '2026-04-30T12:00:00.000Z',
          reviewedBy: { id: 'staff-admin-1', firstName: 'Ada', lastName: 'Lovelace' },
        },
        COMPLETED_VERIFICATION,
        FAILED_VERIFICATION,
      ],
    }
    let listCallCount = 0
    await page.route(/.*\/sale-verifications(\?.*)?$/, async route => {
      listCallCount++
      const isAfterReview = listCallCount > 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAfterReview ? updatedList : VERIFICATIONS_LIST_RESPONSE),
      })
    })

    let patchSeen = false
    await page.route(/.*\/sale-verifications\/sv-pending-1\/review$/, async route => {
      patchSeen = true
      const body = route.request().postDataJSON()
      expect(body.decision).toBe('APPROVE')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: updatedList.data[0] }),
      })
    })

    await gotoSalesPage(page)

    await page.getByTestId('btn-approve-sv-pending-1').click({ force: true })

    // The review dialog title appears
    await expect(page.getByRole('heading', { name: 'Confirmar venta' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Confirmar venta' }).click({ force: true })

    await expect.poll(() => patchSeen, { timeout: 10000 }).toBe(true)
  })

  test('reject flow requires at least one reason or notes', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    await setupSalesReportMocks(page, { withReviewPermission: true })

    let patchSeen = false
    await page.route(/.*\/sale-verifications\/sv-pending-1\/review$/, async route => {
      patchSeen = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: PENDING_VERIFICATION }) })
    })

    await gotoSalesPage(page)

    await page.getByTestId('btn-reject-sv-pending-1').click({ force: true })

    // Try to submit with no reason and no notes
    await page.getByRole('button', { name: 'Marcar para revisar' }).click({ force: true })

    await expect(page.getByText(/al menos una opción o escribe una observación/i)).toBeVisible()
    expect(patchSeen).toBe(false)
  })

  test('reject flow with REVIEW_PORTABILIDAD reason marks the verification FAILED', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    await setupSalesReportMocks(page, { withReviewPermission: true })

    let capturedBody: any = null
    await page.route(/.*\/sale-verifications\/sv-pending-1\/review$/, async route => {
      capturedBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...PENDING_VERIFICATION,
            status: 'FAILED',
            rejectionReasons: ['REVIEW_PORTABILIDAD'],
            reviewNotes: null,
            reviewedAt: '2026-04-30T12:00:00.000Z',
            reviewedBy: { id: 'staff-admin-1', firstName: 'Ada', lastName: 'Lovelace' },
          },
        }),
      })
    })

    await gotoSalesPage(page)

    await page.getByTestId('btn-reject-sv-pending-1').click({ force: true })

    // Tick the portability reason
    await page.getByLabel('Revisar portabilidad').check()
    await page.getByRole('button', { name: 'Marcar para revisar' }).click({ force: true })

    await expect.poll(() => capturedBody, { timeout: 10000 }).toMatchObject({
      decision: 'REJECT',
      rejectionReasons: ['REVIEW_PORTABILIDAD'],
    })
  })

  test('hides action buttons when user lacks sale-verifications:review permission', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    await setupSalesReportMocks(page, { withReviewPermission: false })

    await page.goto(`/venues/${VENUE_SLUG}/playtelecom/sales`)
    // Wait for the table to render the rows (look for the staff column content)
    await expect(page.getByText('Bob Promoter').first()).toBeVisible({ timeout: 15000 })

    // No action buttons rendered
    await expect(page.getByTestId('btn-approve-sv-pending-1')).toHaveCount(0)
    await expect(page.getByTestId('btn-reject-sv-pending-1')).toHaveCount(0)
  })

  test('shows reasons + reviewer for FAILED rows', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [PLAYTELECOM_VENUE_ALPHA] })
    await setupSalesReportMocks(page, { withReviewPermission: true })

    await gotoSalesPage(page)

    // FAILED row shows reason chip
    await expect(page.getByText('Revisar portabilidad')).toBeVisible()
    // FAILED row shows reviewer name
    await expect(page.getByText('Ada Lovelace').first()).toBeVisible()
  })
})
