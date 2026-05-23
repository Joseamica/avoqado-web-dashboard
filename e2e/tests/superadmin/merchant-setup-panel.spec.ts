import { test, expect, Page, Locator } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole } from '../../fixtures/mock-data'

/**
 * Happy-path E2E for the MerchantSetupPanel.
 *
 * Replaces the legacy `angelpay-wizard.spec.ts`. The panel is object-centric:
 * each card opens its own dialog, the operator fills it, clicks "Guardar X",
 * and the card flips to "Listo". Once all 7 required cards (venue, login,
 * merchant, slot, cost, pricing, settlement) are "Listo", the "Activar
 * merchant" button enables and POSTs to `/full-setup-angelpay`.
 *
 * NOTE: Test B (full happy path) drives every card through its dialog. If a
 * selector misses, run with --grep "MerchantSetupPanel" and inspect via UI
 * mode. The superadmin screens are hardcoded Spanish (i18n-exempt) so text
 * selectors are stable.
 */

const MOCK_VENUE = {
  id: 'venue-msp-1',
  name: 'Venue MerchantSetupPanel Test',
  slug: 'venue-msp-test',
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
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
}

/**
 * Register all panel mocks AFTER setupApiMocks (Playwright LIFO — later
 * registered wins). Returns a payload-capture handle for the activate POST.
 */
async function setupPanelMocks(page: Page): Promise<{ getCapturedPayload: () => unknown }> {
  await setupApiMocks(page, { userRole: StaffRole.SUPERADMIN })

  let capturedPayload: unknown = null

  // Merchant-accounts page list — empty.
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts'),
    jsonRoute({ data: [] }),
  )
  // Also covers the `/all` shorthand used elsewhere.
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/merchant-accounts/all'),
    jsonRoute({ data: [] }),
  )
  // Venues list — used by VenueCard.
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/venues'),
    jsonRoute({ data: [MOCK_VENUE] }),
  )
  // Existing AngelPay logins for the venue — none.
  await page.route(
    url => url.pathname.includes('/angelpay-accounts'),
    jsonRoute({ data: [] }),
  )
  // Venue terminals — none (no NEXGO → MerchantCard hides auto-discover).
  await page.route(
    url => url.pathname.endsWith('/dashboard/superadmin/terminals'),
    jsonRoute({ data: [] }),
  )
  // Venue payment config — 404 ⇒ PRIMARY slot is free, all slots empty.
  await page.route(
    url => url.pathname.includes('/venue-pricing/config/'),
    jsonRoute({ message: 'not found' }, 404),
  )
  // Aggregators list — empty (operator skips picker).
  await page.route(
    url => url.pathname.includes('/aggregators') && !url.pathname.includes('/generate-token'),
    jsonRoute({ data: [] }),
  )
  // The transactional activate endpoint.
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
            merchantAccountId: 'ma-new-msp-1',
            angelpayUserAccountId: 'login-new-msp-1',
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

/** The shadcn `<Label>` is a Radix Label without htmlFor → Playwright's
 *  built-in getByLabel() can't bridge it. Locate the input by walking from
 *  the label's parent <div> to its sibling input.
 *
 *  Markup pattern across CostCard / PricingCard / SettlementCard:
 *     <div className="space-y-1">
 *       <Label>Débito</Label>
 *       <div><input/> [optional <span>%</span>]</div>
 *     </div>
 *  This locator returns the input next to the label inside that wrapper.
 */
function inputByLabel(dialog: Locator, label: string) {
  return dialog
    .locator(`div:has(> label:text-is("${label}"))`)
    .first()
    .locator('input')
    .first()
}

/** Open the panel from the merchant-accounts page. Hides RQ devtools first
 *  so they never cover the button under test on dev. */
async function openPanel(page: Page) {
  await page.goto('/superadmin/merchant-accounts')
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
  const openBtn = page.getByRole('button', { name: 'Agregar AngelPay' })
  await expect(openBtn).toBeVisible({ timeout: 15_000 })
  await openBtn.click()
  // The panel uses FullScreenModal — its DialogPrimitive.Title renders as the
  // string "Nuevo merchant AngelPay" inside the modal header. There is no
  // semantic heading, so we just look for the text inside the activate
  // container (the activate button is the most reliable anchor for the panel).
  await expect(page.locator('[data-tour="setup-panel-activate"]')).toBeVisible({
    timeout: 5_000,
  })
}

test.describe('MerchantSetupPanel — smoke', () => {
  test('panel opens and exposes the 9 cards + disabled Activar button', async ({ page }) => {
    await setupPanelMocks(page)
    await openPanel(page)

    // All 9 cards are mounted via their data-tour anchors.
    const cardTours = [
      'setup-panel-card-venue',
      'setup-panel-card-login',
      'setup-panel-card-merchant',
      'setup-panel-card-slot',
      'setup-panel-card-cost',
      'setup-panel-card-pricing',
      'setup-panel-card-settlement',
      'setup-panel-card-revenue-share',
      'setup-panel-card-terminals',
    ]
    for (const tour of cardTours) {
      await expect(page.locator(`[data-tour="${tour}"]`)).toBeVisible()
    }

    // Activar merchant is rendered, but starts disabled (0/7 required complete).
    const activateBtn = page.locator('[data-tour="setup-panel-activate"]')
    await expect(activateBtn).toBeVisible()
    await expect(activateBtn).toBeDisabled()

    // Header progress reads "X de 7 obligatorios" right after opening. The
    // settlement card has sane defaults (T+1/T+1/T+3/T+3), so the panel mounts
    // with settlement already valid — that's intentional. We only assert the
    // shape of the indicator, not the count.
    await expect(page.getByText(/\d de 7 obligatorios ✓/)).toBeVisible()
  })
})

test.describe('MerchantSetupPanel — happy path', () => {
  test('fills required cards in order and activates the merchant', async ({ page }) => {
    const { getCapturedPayload } = await setupPanelMocks(page)
    await openPanel(page)

    // 1) VENUE — pick MOCK_VENUE.
    await page.locator('[data-tour="setup-panel-card-venue"]').click()
    const venueDialog = page.getByRole('dialog')
    await expect(venueDialog.getByText('Selecciona el venue')).toBeVisible()
    // Wait for venues to load then click the row by venue name.
    await venueDialog.getByRole('button', { name: new RegExp(MOCK_VENUE.name) }).click()
    // VenueCard closes itself; card now shows "Listo".
    await expect(
      page.locator('[data-tour="setup-panel-card-venue"]').getByText('Listo'),
    ).toBeVisible()

    // 2) LOGIN — new account, fill email + 6-digit PIN, click "Usar esta cuenta".
    await page.locator('[data-tour="setup-panel-card-login"]').click()
    const loginDialog = page.getByRole('dialog')
    await expect(loginDialog.getByText('Cuenta AngelPay')).toBeVisible()
    await loginDialog.getByPlaceholder('correo@ejemplo.com').fill('nuevo@avoqado.io')
    await loginDialog.getByPlaceholder('123456').fill('123456')
    await loginDialog.getByRole('button', { name: 'Usar esta cuenta' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-login"]').getByText('Listo'),
    ).toBeVisible()

    // 3) MERCHANT — manual create. The dialog opens directly into the form
    // because there are no existing merchants linked to this brand-new login.
    await page.locator('[data-tour="setup-panel-card-merchant"]').click()
    const merchDialog = page.getByRole('dialog')
    await expect(merchDialog.getByText('Datos del merchant')).toBeVisible()
    await merchDialog.getByPlaceholder('9814275').fill('9814275')
    await merchDialog.getByPlaceholder('Núm. de afiliación').fill('AF-001')
    await merchDialog.getByPlaceholder('Nombre del comercio').fill('Comercio MSP Test')
    // The "Confirmo que el ID …" checkbox.
    await merchDialog.getByRole('checkbox').check()
    await merchDialog.getByRole('button', { name: 'Guardar merchant' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-merchant"]').getByText('Listo'),
    ).toBeVisible()

    // 4) SLOT — PRIMARY is free (mocked 404). Default draft picks PRIMARY +
    // 'fill', but the dialog needs to be re-confirmed via a click on the slot
    // row to flip the draft from 'empty' to 'fill'.
    await page.locator('[data-tour="setup-panel-card-slot"]').click()
    const slotDialog = page.getByRole('dialog')
    await expect(slotDialog.getByText('Slot del venue')).toBeVisible()
    await slotDialog.getByRole('button', { name: /^PRIMARY/ }).click()
    await slotDialog.getByRole('button', { name: 'Guardar slot' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-slot"]').getByText('Listo'),
    ).toBeVisible()

    // 5) COST — 4 percent rates. PercentField inputs are type="number" with
    // a "%" suffix span. shadcn Label has no htmlFor; walk from the label's
    // wrapper to its sibling input via inputByLabel().
    await page.locator('[data-tour="setup-panel-card-cost"]').click()
    const costDialog = page.getByRole('dialog')
    await expect(costDialog.getByText('Costo del procesador').first()).toBeVisible()
    await inputByLabel(costDialog, 'Débito').fill('1')
    await inputByLabel(costDialog, 'Crédito').fill('2')
    await inputByLabel(costDialog, 'Amex').fill('3')
    await inputByLabel(costDialog, 'Internacional').fill('4')
    await costDialog.getByRole('button', { name: 'Guardar costo' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-cost"]').getByText('Listo'),
    ).toBeVisible()

    // 6) PRICING — same shape as cost.
    await page.locator('[data-tour="setup-panel-card-pricing"]').click()
    const pricingDialog = page.getByRole('dialog')
    await expect(pricingDialog.getByText('Precio al venue').first()).toBeVisible()
    await inputByLabel(pricingDialog, 'Débito').fill('2')
    await inputByLabel(pricingDialog, 'Crédito').fill('3')
    await inputByLabel(pricingDialog, 'Amex').fill('4')
    await inputByLabel(pricingDialog, 'Internacional').fill('5')
    await pricingDialog.getByRole('button', { name: 'Guardar precio' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-pricing"]').getByText('Listo'),
    ).toBeVisible()

    // 7) SETTLEMENT — defaults already populate T+1/T+1/T+3/T+3, so the card
    // is already "Listo" out of the box. Open and confirm just to capture
    // the operator's intent (and to mirror the real flow).
    await page.locator('[data-tour="setup-panel-card-settlement"]').click()
    const settlementDialog = page.getByRole('dialog')
    await expect(settlementDialog.getByText('Liquidación').first()).toBeVisible()
    await settlementDialog.getByRole('button', { name: 'Guardar liquidación' }).click()
    await expect(
      page.locator('[data-tour="setup-panel-card-settlement"]').getByText('Listo'),
    ).toBeVisible()

    // All 7 required cards are now "Listo".
    await expect(page.getByText('7 de 7 obligatorios ✓')).toBeVisible()

    // Activate.
    const activateBtn = page.locator('[data-tour="setup-panel-activate"]')
    await expect(activateBtn).toBeEnabled()
    await activateBtn.click()

    // The transactional endpoint received the request.
    await expect.poll(() => getCapturedPayload(), { timeout: 10_000 }).not.toBeNull()
    const payload = getCapturedPayload() as Record<string, any>
    expect(payload.venueId).toBe(MOCK_VENUE.id)
    expect(payload.login.mode).toBe('new')
    expect(payload.login.email).toBe('nuevo@avoqado.io')
    expect(payload.login.pin).toBe('123456')
    expect(payload.merchant.mode).toBe('create')
    expect(payload.merchant.externalMerchantId).toBe('9814275')
    expect(payload.merchant.affiliation).toBe('AF-001')
    expect(payload.slot.accountType).toBe('PRIMARY')
    expect(payload.slot.mode).toBe('fill')
    expect(payload.cost).toBeTruthy()
    expect(payload.pricing).toBeTruthy()
    expect(payload.settlement).toBeTruthy()
  })
})
