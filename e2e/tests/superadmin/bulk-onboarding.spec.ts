import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole } from '../../fixtures/mock-data'

// ── Mock Data ────────────────────────────────────────────────────────

const MOCK_ORGANIZATIONS = [
  { id: 'org-001', name: 'PlayTelecom Corp', slug: 'playtelecom', venueCount: 12 },
  { id: 'org-002', name: 'Restaurantes MX', slug: 'restaurantes-mx', venueCount: 5 },
]

const MOCK_MERCHANT_ACCOUNTS = [
  {
    id: 'merchant-001',
    externalMerchantId: 'BLU-001',
    displayName: 'Blumon Principal',
    alias: null,
    providerId: 'prov-001',
    providerName: 'Blumon',
    active: true,
    environment: 'PRODUCTION',
    hasCredentials: true,
  },
]

const MOCK_BULK_RESPONSE = {
  success: true,
  summary: {
    venuesCreated: 3,
    venuesFailed: 0,
    terminalsCreated: 2,
    terminalsFailed: 0,
    paymentConfigsCreated: 3,
    pricingStructuresCreated: 3,
    settlementConfigsCreated: 15,
  },
  venues: [
    {
      index: 0,
      name: 'Venue Reforma',
      venueId: 'v-001',
      slug: 'venue-reforma',
      status: 'ACTIVE',
      terminals: [{ id: 't-001', serialNumber: 'SN001', status: 'INACTIVE' }],
      paymentConfigured: true,
      pricingConfigured: true,
      settlementConfigured: true,
    },
    {
      index: 1,
      name: 'Venue Polanco',
      venueId: 'v-002',
      slug: 'venue-polanco',
      status: 'ACTIVE',
      terminals: [{ id: 't-002', serialNumber: 'SN002', status: 'INACTIVE' }],
      paymentConfigured: true,
      pricingConfigured: true,
      settlementConfigured: true,
    },
    {
      index: 2,
      name: 'Venue Condesa',
      venueId: 'v-003',
      slug: 'venue-condesa',
      status: 'ACTIVE',
      terminals: [],
      paymentConfigured: true,
      pricingConfigured: true,
      settlementConfigured: true,
    },
  ],
  errors: [],
}

// ── Helpers ──────────────────────────────────────────────────────────

function isApiPath(url: URL, segment: string): boolean {
  return url.pathname.includes('/api/') && url.pathname.includes(segment)
}

async function setupSuperadminWithBulkMocks(page: Page) {
  await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN })

  // Organizations list
  await page.route(
    (url) => isApiPath(url, '/organizations/list'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ organizations: MOCK_ORGANIZATIONS }),
      }),
  )

  // Merchant accounts list
  await page.route(
    (url) => isApiPath(url, '/merchant-accounts/list'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_MERCHANT_ACCOUNTS }),
      }),
  )
}

async function navigateToBulkOnboarding(page: Page) {
  await page.goto('/superadmin/bulk-onboarding')
  // Wait for the page header to be visible
  await expect(page.getByText('Carga Masiva de Venues')).toBeVisible({ timeout: 15_000 })
  // Hide TanStack Query devtools overlay that intercepts pointer events in dev mode
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
}

async function selectOrganization(page: Page, orgName: string) {
  const orgSelect = page.getByRole('combobox').first()
  await orgSelect.click({ force: true })
  await page.getByRole('option', { name: new RegExp(orgName) }).click()
}

async function clickContinue(page: Page) {
  await page.getByRole('button', { name: /Continuar/i }).click({ force: true })
}

async function goToStep3(page: Page) {
  await selectOrganization(page, 'PlayTelecom')
  await clickContinue(page) // → Step 2
  await clickContinue(page) // → Step 3
  await expect(page.getByText('No hay venues todavía').or(page.locator('table'))).toBeVisible({ timeout: 10_000 })
}

async function addVenuesViaQuickAdd(page: Page, names: string[]) {
  await page.getByRole('button', { name: /Agregar múltiples/i }).first().click({ force: true })
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.locator('textarea').fill(names.join('\n'))
  await dialog.getByRole('button', { name: new RegExp(`Agregar ${names.length} venues`) }).click({ force: true })
  // Wait for venues to appear
  await expect(page.getByText(names[0])).toBeVisible({ timeout: 5_000 })
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Bulk Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to avoid draft restoration prompts
    await page.addInitScript(() => {
      localStorage.removeItem('avoqado-bulk-onboarding-draft')
    })
  })

  test('1 — Page loads with step indicator showing 5 steps', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    // Step indicator labels (use .first() since text may appear in multiple places)
    const stepBar = page.locator('.rounded-2xl.border').first()
    await expect(stepBar.getByText('Pricing')).toBeVisible()
    await expect(stepBar.getByText('Venues')).toBeVisible()
    await expect(stepBar.getByText('Revisión')).toBeVisible()
    await expect(stepBar.getByText('Resultados')).toBeVisible()
  })

  test('2 — Step 1: Cannot continue without selecting organization', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    const continueBtn = page.getByRole('button', { name: /Continuar/i })
    await expect(continueBtn).toBeDisabled()
  })

  test('3 — Step 1: Selecting organization enables Continue button', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    await selectOrganization(page, 'PlayTelecom')

    const continueBtn = page.getByRole('button', { name: /Continuar/i })
    await expect(continueBtn).toBeEnabled()
  })

  test('4 — Step 1 → Step 2: Navigates to Pricing step', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    await selectOrganization(page, 'PlayTelecom')
    await clickContinue(page)

    // Step 2 content should be visible
    await expect(page.getByText('Tasas por Tipo de Tarjeta')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Días de Liquidación')).toBeVisible()
  })

  test('5 — Step 2: Pricing inputs are pre-filled with defaults', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    await selectOrganization(page, 'PlayTelecom')
    await clickContinue(page)

    // Wait for step 2 to render
    await expect(page.getByText('Tasas por Tipo de Tarjeta')).toBeVisible({ timeout: 5_000 })

    // Default debit rate should be pre-filled (percentage format)
    const debitInput = page.locator('input[type="number"]').first()
    await expect(debitInput).toHaveValue('2.5')
  })

  test('6 — Step 3: Adding venues via quick add', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    await addVenuesViaQuickAdd(page, ['Venue Reforma', 'Venue Polanco', 'Venue Condesa'])

    // Venues should appear in the table
    await expect(page.getByText('Venue Reforma')).toBeVisible()
    await expect(page.getByText('Venue Polanco')).toBeVisible()
    await expect(page.getByText('Venue Condesa')).toBeVisible()

    // Header should show count
    await expect(page.getByText('3 venues')).toBeVisible()
  })

  test('7 — Step 3: Can add a single venue and open editor drawer', async ({ page }) => {
    test.setTimeout(60_000) // Sheet drawer animation can slow teardown
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    // Add a single venue — the "Agregar Venue" button (not "Agregar múltiples")
    const addBtn = page.getByRole('button', { name: 'Agregar Venue' }).first()
    await addBtn.click({ force: true })

    // Editor drawer should open (Sheet component)
    await expect(page.getByText('Editar Venue')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Información básica')).toBeVisible()
  })

  test('8 — Step 3: Duplicate venue creates a copy', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    await addVenuesViaQuickAdd(page, ['Mi Venue Original'])

    // Open the dropdown menu on the venue row — click the "..." button
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.locator('button').last().click()

    // Wait for menu to open then click Duplicate
    await expect(page.getByRole('menuitem', { name: /Duplicar/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('menuitem', { name: /Duplicar/i }).click()

    // Should now have 2 venues
    await expect(page.getByText('2 venues')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Mi Venue Original (copia)')).toBeVisible()
  })

  test('9 — Step 4: Review shows summary and venue list', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    await addVenuesViaQuickAdd(page, ['Venue Reforma', 'Venue Polanco'])

    await clickContinue(page) // → Step 4

    // Review page should show default config summary
    await expect(page.getByText('Configuración por defecto')).toBeVisible({ timeout: 5_000 })

    // Should show venues in the review table
    await expect(page.getByText('Venue Reforma')).toBeVisible()
    await expect(page.getByText('Venue Polanco')).toBeVisible()
  })

  test('10 — Full flow: Submit sends correct POST body and shows results', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)

    let capturedBody: Record<string, unknown> | null = null

    // Mock the bulk creation endpoint
    await page.route(
      (url) => isApiPath(url, '/venues/bulk'),
      async (route) => {
        if (route.request().method() === 'POST') {
          capturedBody = route.request().postDataJSON()
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_BULK_RESPONSE),
          })
        }
        return route.fulfill({ status: 200, body: '{}' })
      },
    )

    await navigateToBulkOnboarding(page)
    await goToStep3(page)
    await addVenuesViaQuickAdd(page, ['Venue Reforma', 'Venue Polanco', 'Venue Condesa'])

    await clickContinue(page) // → Step 4

    // Review page should be visible
    await expect(page.getByText('Configuración por defecto')).toBeVisible({ timeout: 5_000 })

    // Click submit button
    await page.getByRole('button', { name: /Crear 3 Venues/i }).click({ force: true })

    // Confirmation dialog
    const confirmDialog = page.locator('[role="alertdialog"]')
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
    await confirmDialog.getByRole('button', { name: /Crear Venues/i }).click({ force: true })

    // Step 5: Results should appear
    await expect(page.getByText('Creación completada')).toBeVisible({ timeout: 15_000 })

    // Verify POST body was sent correctly
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.organizationId).toBe('org-001')
    expect((capturedBody!.venues as any[]).length).toBe(3)
    expect((capturedBody!.venues as any[])[0].name).toBe('Venue Reforma')
    expect(capturedBody!.defaultPricing).toBeDefined()
    expect((capturedBody!.defaultPricing as any).debitRate).toBe(0.025)
    expect(capturedBody!.defaultSettlement).toBeDefined()

    // Results table should show each venue slug
    await expect(page.getByText('venue-reforma')).toBeVisible()
    await expect(page.getByText('venue-polanco')).toBeVisible()
    await expect(page.getByText('venue-condesa')).toBeVisible()

    // Navigation buttons should be visible
    await expect(page.getByRole('button', { name: /Ir a Venues/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Crear otro lote/i })).toBeVisible()
  })

  test('11 — Step 3: Import JSON adds venues to list', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    // Open import dialog
    await page.getByRole('button', { name: /Importar JSON/i }).click({ force: true })
    const importDialog = page.locator('[role="dialog"]')
    await expect(importDialog).toBeVisible({ timeout: 5_000 })

    // Paste JSON
    await importDialog.locator('textarea').fill(JSON.stringify([
      { name: 'Imported Venue 1', city: 'CDMX', address: 'Av. Reforma 123' },
      { name: 'Imported Venue 2', city: 'Monterrey' },
    ]))

    await importDialog.getByRole('button', { name: /Importar/i }).click({ force: true })

    // Venues should appear in the table
    await expect(page.getByText('Imported Venue 1')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Imported Venue 2')).toBeVisible()
    await expect(page.getByText('2 venues')).toBeVisible()
  })

  test('12 — Step 3: Delete removes venue from list', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)
    await goToStep3(page)

    await addVenuesViaQuickAdd(page, ['Venue A', 'Venue B'])

    // Open dropdown on first venue — click the "..." button
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.locator('button').last().click()

    // Wait for menu to open then click delete
    await expect(page.getByRole('menuitem', { name: /Eliminar/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('menuitem', { name: /Eliminar/i }).click()

    // Should now show 1 venue
    await expect(page.getByText(/^1 venue/)).toBeVisible({ timeout: 5_000 })
  })

  test('13 — Back button navigates between steps correctly', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    await selectOrganization(page, 'PlayTelecom')
    await clickContinue(page)

    // Verify we're on step 2
    await expect(page.getByText('Tasas por Tipo de Tarjeta')).toBeVisible({ timeout: 5_000 })

    // Go back
    await page.getByRole('button', { name: /Atrás/i }).click({ force: true })

    // Should be back on step 1 — check for step 1-specific content
    await expect(page.getByText('Todos los venues se crearán dentro de esta organización')).toBeVisible({ timeout: 5_000 })
  })

  test('14 — Volver button on step 1 navigates to /superadmin/venues', async ({ page }) => {
    await setupSuperadminWithBulkMocks(page)
    await navigateToBulkOnboarding(page)

    // Step 1 should have "Volver" not "Atrás"
    const backBtn = page.getByRole('button', { name: /Volver/i })
    await expect(backBtn).toBeVisible()
    await backBtn.click({ force: true })

    await page.waitForURL('**/superadmin/venues**', { timeout: 10_000 })
  })
})
