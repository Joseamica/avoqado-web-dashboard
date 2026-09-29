// e2e/tests/billing/plan-page.spec.ts
//
// The "Plan" page end to end (spec 2026-09-27): every function by area, adding functions to "Your selection",
// the phone layout (no horizontal scroll, the selection drops to a fixed bar), and the cancel dialog
// ("keep my plan" on the right, the reason reaches the server). App E2E locale is English.
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)

const VENUE = createMockVenue({
  id: 'venue-alpha',
  slug: 'venue-alpha',
  permissions: ['home:read', 'settings:read', 'billing:read', 'billing:subscriptions:read', 'billing:subscriptions:manage'],
})

async function hideDevtools(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      document.head.appendChild(style)
    }
    if (document.head) hide()
    else document.addEventListener('DOMContentLoaded', hide)
  })
}

test('shows every function by area, adds functions to the selection and fits a phone', async ({ page }) => {
  await setupApiMocks(page, {
    userRole: StaffRole.OWNER,
    venues: [VENUE],
    planState: { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false },
  })
  await hideDevtools(page)
  await page.goto('/venues/venue-alpha/settings/billing/subscriptions')
  const grid = page.locator('[data-tour="feature-grid"]')
  await expect(grid.getByRole('heading', { name: 'Features · all 5' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-tour="plan-option-free"]')).toHaveAttribute('aria-checked', 'true')
  await grid.getByRole('checkbox', { name: 'Select Loyalty program' }).click()
  await grid.getByRole('checkbox', { name: 'Select Reservations and appointments' }).click()
  await expect(page.locator('[data-tour="plan-selection"]')).toContainText(/328\.00/)
  await expect(page.locator('[data-tour="plan-hint"]')).toContainText('Pro includes these 2')
  // A laptop: the grid shares the width with the app sidebar, the settings menu and "Your selection", so its column
  // is narrow. Nothing inside a tile spills (a price running under its badge counts) and every tile ends inside the
  // grid; the list names the tiles that don't. Below 1280 "Your selection" stacks under the grid and the fixed bar
  // carries the total and the button; from 1280 the summary sits beside the grid and the bar is gone.
  const bar = page.locator('[data-tour="plan-selection-bar"]')
  for (const width of [1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await expect
      .poll(
        () =>
          grid.evaluate(section => {
            const right = section.getBoundingClientRect().right
            return [...section.querySelectorAll<HTMLElement>('[data-tour^="feature-tile-"]')]
              .filter(
                tile =>
                  tile.getBoundingClientRect().right > right + 1 ||
                  [tile, ...tile.querySelectorAll<HTMLElement>('*')].some(el => el.scrollWidth > el.clientWidth),
              )
              .map(tile => tile.dataset.tour)
          }),
        { message: `tiles at ${width} px` },
      )
      .toEqual([])
    if (width < 1280) await expect(bar).toBeVisible()
    else await expect(bar).toBeHidden()
    if (width === 1100) {
      await page.locator('[data-tour="plan-row"]').evaluate(el => el.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: test.info().outputPath('plan-1100.png'), fullPage: true })
    }
  }
  // From 1024 the app sidebar is a visible column: the bar floats clear of it (1024 is the tightest case, with the
  // sidebar expanded) and the user menu at the bottom of the sidebar stays clickable.
  const sidebar = page.locator('[data-sidebar="sidebar"]').first()
  const userMenu = page
    .locator('[data-sidebar="footer"]')
    .first()
    .getByRole('button', { name: /Test User/ })
  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(bar).toBeVisible()
  const sidebarBox = await sidebar.boundingBox()
  expect.soft(sidebarBox!.width, 'sidebar expanded, not the icon rail').toBeGreaterThan(150)
  expect.soft((await bar.boundingBox())!.x, 'bar starts right of the sidebar').toBeGreaterThan(sidebarBox!.x + sidebarBox!.width)
  for (const width of [1100, 1200, 1279]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(bar).toBeVisible()
    await userMenu.click({ trial: true, timeout: 3_000 })
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  // The page scrolls inside the dashboard shell, so fullPage alone would capture wherever the clicks left it.
  await page.locator('[data-tour="plan-row"]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: test.info().outputPath('plan-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  // Only the plan's own blocks are measured: the dashboard shell is outside this change. Nothing scrolls inside a
  // block, and the block itself ends inside the screen (a block wider than the screen has scrollWidth == clientWidth).
  for (const tour of ['plan-row', 'feature-grid', 'plan-selection']) {
    await expect
      .poll(
        () =>
          page
            .locator(`[data-tour="${tour}"]`)
            .evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= window.innerWidth),
        { message: tour },
      )
      .toBe(true)
  }
  await expect(page.locator('[data-tour="plan-selection-bar"]')).toBeVisible()
  await expect(page.locator('[data-tour="plan-selection-bar"]')).toContainText('Monthly total')
  await expect(page.locator('[data-tour="plan-selection-bar"]')).toContainText(/328\.00/)
  await page.locator('[data-tour="plan-selection"]').evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: test.info().outputPath('plan-mobile.png'), fullPage: true })
})

test('cancelling keeps the plan on the right and sends the reason', async ({ page }) => {
  await setupApiMocks(page, {
    userRole: StaffRole.OWNER,
    venues: [VENUE],
    // No `origin`: an older server. The page derives a classic Pro from the subscription (originOf).
    planState: {
      hasPlan: true,
      state: 'active',
      planTier: 'PRO',
      planName: 'Avoqado Pro',
      interval: 'month',
      price: { base: 999, gross: 1158.84, currency: 'MXN' },
      currentPeriodEnd: '2026-10-27T00:00:00.000Z',
      stripeSubscriptionId: 'sub_e2e',
      grandfathered: false,
    },
    downgradePreview: { required: false },
  })
  await hideDevtools(page)
  let sent: unknown
  await page.route('**/api/v1/dashboard/venues/*/plan/downgrade', async route => {
    sent = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  })
  await page.goto('/venues/venue-alpha/settings/billing/subscriptions')
  await page.locator('[data-tour="plan-cancel"]').click({ timeout: 15_000 })
  const dialog = page.getByRole('dialog')
  const confirm = dialog.locator('[data-tour="cancel-confirm"]')
  const keep = dialog.locator('[data-tour="cancel-keep"]')
  await expect(confirm).toHaveText('Yes, cancel my plan')
  await expect(keep).toHaveText("I'll keep my plan")
  const [confirmBox, keepBox] = await Promise.all([confirm.boundingBox(), keep.boundingBox()])
  expect(confirmBox!.x).toBeLessThan(keepBox!.x)
  expect(Math.round(confirmBox!.width)).toBe(Math.round(keepBox!.width))
  await dialog.getByText("It's too expensive").click()
  await confirm.click()
  await expect.poll(() => sent).toEqual({ keepStaffVenueIds: [], reason: 'TOO_EXPENSIVE' })
})
