import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const TEST_ORG_ID = 'org-playtelecom-001'

function json(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) }
}

const FAILED_ROW = {
  id: 'sv-stuck-1',
  paymentId: 'pay-1',
  status: 'FAILED',
  isPortabilidad: false,
  saleType: 'LINEA_NUEVA',
  photos: [],
  serialNumbers: ['8952140063883196217F'],
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: 'me ayudas a corregir la forma de pago, era un ESIM $100',
  rejectionReasons: ['OTHER'],
  createdAt: '2026-05-29T20:45:00.000Z',
  updatedAt: '2026-05-29T20:45:00.000Z',
  venue: { id: 'venue-bae-001', name: 'SAMS CLUB CAMPESTRE (6315)', city: 'San Luis Potosí', slug: 'bae-pozos' },
  staff: { id: 's1', firstName: 'Ignacio', lastName: 'Mitre', email: null, photoUrl: null },
  reviewedBy: null,
  payment: { id: 'pay-1', amount: 0, method: 'OTHER', paymentForm: 'NONE', status: 'COMPLETED', createdAt: '2026-05-29T20:45:00.000Z' },
  category: { id: 'c1', name: 'E-SIM de promotor' },
  registeredFromVenue: null,
  terminal: null,
}

const PENDING_ROW = {
  ...FAILED_ROW,
  id: 'sv-pending-1',
  paymentId: 'pay-2',
  status: 'PENDING',
  reviewNotes: null,
  rejectionReasons: [],
  payment: { ...FAILED_ROW.payment, id: 'pay-2' },
}

async function setupMocks(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('lang', 'es') } catch { /* ignore */ }
  })
  const venue = createMockVenue({
    id: 'venue-bae-001',
    name: 'SAMS CLUB CAMPESTRE (6315)',
    slug: 'bae-pozos',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'PlayTelecom' },
    modules: [{ module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true }],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  await page.route('**/api/**', route => route.fulfill(json({})))
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/stats`, route =>
    route.fulfill(json({ id: TEST_ORG_ID, name: 'PlayTelecom', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/venues`, route => route.fulfill(json([venueWithRole])))
  await page.route('**/api/v1/notifications*', route => route.fulfill(json({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } })))
  await page.route('**/api/v1/dashboard/venues/*/role-config', route => route.fulfill(json(DEFAULT_ROLE_CONFIGS)))
  await page.route('**/api/v1/me/access*', route =>
    route.fulfill(json({
      userId: user.id, venueId: venueWithRole.id, organizationId: TEST_ORG_ID, role: StaffRole.OWNER,
      corePermissions: venueWithRole.permissions, whiteLabelEnabled: true, enabledFeatures: [], featureAccess: {},
    })),
  )

  const base = `**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications`
  await page.route(`${base}/summary*`, route =>
    route.fulfill(json({ success: true, data: { totalRevenue: 0, confirmedRevenue: 0, totalCount: 1, completedCount: 0, pendingCount: 0, failedCount: 1, withoutVerificationCount: 0 } })),
  )
  // List — registered before auth/status; serves the single FAILED row.
  await page.route(`${base}?*`, route => route.fulfill(json({ success: true, data: [FAILED_ROW], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } })))
  await page.route(`${base}`, route => route.fulfill(json({ success: true, data: [FAILED_ROW], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } })))

  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))
}

test.describe('SalesDetail — admin edit', () => {
  test('OWNER sees Editar on a FAILED row, edits it, and the PATCH is sent', async ({ page }) => {
    await setupMocks(page)

    // Capture the edit PATCH (registered last so LIFO matches it first).
    let patchBody: any = null
    await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications/sv-stuck-1`, route => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() || '{}')
        return route.fulfill(json({ success: true, data: { id: 'sv-stuck-1', status: 'COMPLETED' } }))
      }
      return route.fulfill(json({}))
    })

    await page.goto(`/organizations/${TEST_ORG_ID}/sales/detail`)
    // Hide TanStack Query devtools overlay — it intercepts pointer events in dev mode
    await page.addStyleTag({
      content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }`,
    })
    await expect(page.getByRole('heading', { name: 'Ventas — Detalle' })).toBeVisible({ timeout: 15_000 })

    // The Editar button exists on the stuck row (this fails before Task 8).
    await page.getByRole('button', { name: 'Editar' }).first().click({ force: true })

    // Modal opens; correct monto + forma de pago + estado + motivo.
    await expect(page.getByRole('heading', { name: 'Editar venta' })).toBeVisible()
    await page.getByLabel('Monto (MXN)').fill('100')
    await page.getByLabel('Motivo del cambio *').fill('era un ESIM $100, no gratis')
    await page.getByRole('button', { name: 'Guardar' }).click({ force: true })

    await expect.poll(() => patchBody).not.toBeNull()
    expect(patchBody.amount).toBe(100)
    expect(patchBody.reason).toContain('ESIM')
    // Lock the payload contract — a regression that drops a field must fail here.
    expect(patchBody).toHaveProperty('status')
    expect(patchBody).toHaveProperty('paymentForm')
    expect(patchBody).toHaveProperty('isPortabilidad')
  })

  test('back-office can "Rechazar" a PENDING sale → terminal REJECT_FINAL review', async ({ page }) => {
    await setupMocks(page)

    // Serve a PENDING row (so Aprobar / Revisar / Rechazar appear). Registered after
    // setupMocks → LIFO matches it first.
    const base = `**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications`
    await page.route(`${base}?*`, route =>
      route.fulfill(json({ success: true, data: [PENDING_ROW], pagination: { pageSize: 25, pageNumber: 1, totalCount: 1, totalPages: 1 } })),
    )

    // Capture the review PATCH for this row.
    let reviewBody: any = null
    await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications/sv-pending-1/review`, route => {
      if (route.request().method() === 'PATCH') {
        reviewBody = JSON.parse(route.request().postData() || '{}')
        return route.fulfill(json({ success: true, data: { id: 'sv-pending-1', status: 'REJECTED' } }))
      }
      return route.fulfill(json({}))
    })

    await page.goto(`/organizations/${TEST_ORG_ID}/sales/detail`)
    await page.addStyleTag({ content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }` })
    await expect(page.getByRole('heading', { name: 'Ventas — Detalle' })).toBeVisible({ timeout: 15_000 })

    // The "Rechazar" action is available on the PENDING row.
    await page.getByRole('button', { name: 'Rechazar', exact: true }).first().click({ force: true })

    // Terminal dialog: distinct from "Revisar", says it will mark the sale RECHAZADA.
    await expect(page.getByRole('heading', { name: 'Rechazar venta' })).toBeVisible()
    await expect(page.getByText('RECHAZADA', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Rechazar venta' }).click({ force: true })

    await expect.poll(() => reviewBody).not.toBeNull()
    expect(reviewBody.decision).toBe('REJECT_FINAL')
  })
})
